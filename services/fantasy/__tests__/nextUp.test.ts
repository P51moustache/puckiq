import { FULL_ROSTER_MIN, pickNextUp, type NextUpInput, type NextUpPlayer } from '../nextUp';

const player = (overrides: Partial<NextUpPlayer> = {}): NextUpPlayer => ({
  playerId: 8478402,
  name: 'Connor McDavid',
  trend: 'steady',
  opponent: 'MTL',
  softMatchup: false,
  ...overrides,
});

const input = (overrides: Partial<NextUpInput> = {}): NextUpInput => ({
  night: 'tonight',
  date: '2026-10-13',
  phase: 'pre',
  emptySlots: [],
  playing: [player()],
  tomorrowPlaying: 0,
  weekLeft: { games: 24, starts: 18 },
  matchup: null,
  isPro: true,
  ownRoster: 16,
  ...overrides,
});

describe('pickNextUp', () => {
  it('asks for the rest of a short roster before anything else', () => {
    expect(pickNextUp(input({ ownRoster: 6, emptySlots: ['D'] }))).toEqual({
      kind: 'build_roster',
      title: 'Add the rest of your roster',
      detail: '6 of your players are in. Tonight’s calls only cover the players you add.',
      action: { type: 'roster' },
    });
  });

  it('stops asking once the roster is full enough, and never for the sample team', () => {
    expect(pickNextUp(input({ ownRoster: FULL_ROSTER_MIN }))?.kind).not.toBe('build_roster');
    expect(pickNextUp(input({ ownRoster: null }))?.kind).not.toBe('build_roster');
    expect(pickNextUp(input({ ownRoster: 0 }))?.kind).not.toBe('build_roster');
  });

  it('sends an empty slot before lock to Pickups for that night and slot', () => {
    const item = pickNextUp(input({ emptySlots: ['D'] }));
    expect(item).toEqual({
      kind: 'fill_slot',
      title: 'Fill your empty D slot',
      detail: 'Find a pickup who plays tonight',
      action: { type: 'pickups', date: '2026-10-13', slot: 'D' },
    });
  });

  it('names every empty slot and opens Pickups on the first', () => {
    const item = pickNextUp(input({ night: 'tomorrow', date: '2026-10-14', emptySlots: ['RW', 'G'] }));
    expect(item?.title).toBe('Fill 2 empty slots');
    expect(item?.detail).toBe('RW · G — find pickups who play tomorrow');
    expect(item?.action).toEqual({ type: 'pickups', date: '2026-10-14', slot: 'RW' });
  });

  it('points at a hot player who plays tonight', () => {
    const item = pickNextUp(input({ playing: [player({ playerId: 1, trend: 'cold' }), player({ playerId: 2, name: 'Nick Suzuki', trend: 'hot', opponent: '@TOR', softMatchup: true })] }));
    expect(item).toEqual({
      kind: 'hot_player',
      title: 'Nick Suzuki is hot',
      detail: 'Plays @TOR tonight · soft matchup — see his last games',
      action: { type: 'player', playerId: 2 },
    });
  });

  it('moves on to tomorrow once tonight is underway', () => {
    const item = pickNextUp(input({ phase: 'live', emptySlots: ['D'], playing: [player({ trend: 'hot' })], tomorrowPlaying: 6 }));
    expect(item?.kind).toBe('tomorrow');
    expect(item?.title).toBe('Tomorrow: 6 of your players play');
    expect(item?.action).toEqual({ type: 'tomorrow' });
  });

  it('offers tomorrow on a night when none of my players play', () => {
    expect(pickNextUp(input({ playing: [], tomorrowPlaying: 4 }))?.kind).toBe('tomorrow');
  });

  it('does not offer tomorrow before tonight starts when tonight has games', () => {
    const item = pickNextUp(input({ tomorrowPlaying: 6 }));
    expect(item?.kind).toBe('week');
  });

  it('shows the head-to-head when there is an opponent', () => {
    const side = (starts: number) => ({ games: starts, starts, benched: 0, emptySlots: 0, value: starts });
    const item = pickNextUp(input({ phase: 'final', matchup: { mine: side(14), theirs: side(17), verdict: 'behind' } }));
    expect(item).toEqual({
      kind: 'matchup',
      title: 'You’re behind this week',
      detail: '14 games that count left for you, 17 for them',
      action: { type: 'week' },
    });
  });

  it('falls back to planning the week', () => {
    expect(pickNextUp(input())).toEqual({
      kind: 'week',
      title: 'Plan the rest of your week',
      detail: '18 games that count left for your lineup',
      action: { type: 'week' },
    });
  });

  it('shows nothing when there is nothing useful left', () => {
    expect(pickNextUp(input({ playing: [], weekLeft: { games: 0, starts: 0 } }))).toBeNull();
    expect(pickNextUp(input({ playing: [], weekLeft: null }))).toBeNull();
  });

  it('keeps Pro numbers out of the free version', () => {
    const side = (starts: number) => ({ games: starts, starts, benched: 0, emptySlots: 0, value: starts });
    const item = pickNextUp(input({ isPro: false, matchup: { mine: side(14), theirs: side(17), verdict: 'behind' } }));
    expect(item).toEqual({
      kind: 'week',
      title: 'Plan the rest of your week',
      detail: '24 games left for your players this week',
      action: { type: 'week' },
    });
  });

  it('never offers a hot player on the Tomorrow view', () => {
    const item = pickNextUp(input({ night: 'tomorrow', playing: [player({ trend: 'hot' })] }));
    expect(item?.kind).toBe('week');
  });
});
