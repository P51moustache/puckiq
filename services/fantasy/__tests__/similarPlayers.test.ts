import { positionGroup, SIMILAR_LIMIT, similarPlayers, type SimilarInput } from '../similarPlayers';
import { buildGoalieForm, buildSkaterForm } from '../form';
import type { PickupCandidate } from '../pickups';
import type { LineupSlots } from '../../../types/fantasy';
import { player } from './fixtures';

/** No active slots, so "likely rostered" is only the bench: the top 3 skaters and the top goalie. */
const BENCH_ONLY: LineupSlots = { C: 0, LW: 0, RW: 0, F: 0, D: 0, UTIL: 0, G: 0 };

function skater(id: number, position: string, value: number, seasonRate = 1): PickupCandidate {
  return { playerId: id, name: `Skater ${id}`, team: 'SEA', position, form: { ...buildSkaterForm(id, {}), value, seasonRate } };
}

function goalie(id: number, value: number, startShare: number): PickupCandidate {
  return { playerId: id, name: `Goalie ${id}`, team: 'SEA', position: 'G', form: { ...buildGoalieForm(id, {}), value, startShare } };
}

/** Three stars (the likely-rostered cut), then a spread of forwards and D around a 2.0 value. */
const STARS = [skater(1, 'C', 4.5, 9), skater(2, 'R', 4.4, 8.9), skater(3, 'D', 4.2, 8.8)];
const POOL = [
  ...STARS,
  skater(10, 'C', 2.1),
  skater(11, 'L', 1.8),
  skater(12, 'R', 2.4),
  skater(13, 'C', 0.9),
  skater(14, 'D', 2.0),
  skater(15, 'D', 1.9),
  skater(16, 'L', 1.9),
  goalie(20, 3.0, 0.9),
  goalie(21, 2.0, 0.3),
  goalie(22, 1.5, 0.2),
];

function input(overrides: Partial<SimilarInput> = {}): SimilarInput {
  return {
    player: { playerId: 99, position: 'C', value: 2.0 },
    candidates: POOL,
    team: { players: [], opponent: [], hiddenPickupIds: [], leagueSize: 1, slots: BENCH_ONLY },
    ...overrides,
  };
}

const ids = (rows: PickupCandidate[]) => rows.map((row) => row.playerId);

describe('positionGroup', () => {
  it('groups centres and wingers as forwards; D and G stand alone', () => {
    expect(['C', 'L', 'LW', 'R', 'RW'].map(positionGroup)).toEqual(['F', 'F', 'F', 'F', 'F']);
    expect(positionGroup('D')).toBe('D');
    expect(positionGroup('G')).toBe('G');
    expect(positionGroup('')).toBeNull();
  });
});

describe('similarPlayers', () => {
  it('picks up to three forwards nearest his value, the higher value first on a tie', () => {
    // 16 (1.9) and 10 (2.1) are both 0.1 away: the higher value goes first.
    expect(ids(similarPlayers(input()))).toEqual([10, 16, 11]);
    expect(SIMILAR_LIMIT).toBe(3);
  });

  it('keeps to his position group', () => {
    expect(ids(similarPlayers(input({ player: { playerId: 99, position: 'D', value: 2.0 } })))).toEqual([14, 15]);
    expect(ids(similarPlayers(input({ player: { playerId: 99, position: 'G', value: 2.0 } })))).toEqual([21, 22]);
  });

  it('leaves out the stars a league this size almost always rosters', () => {
    // Nearest to 4.5 would be the stars (4.4, 4.5); the best available forwards come instead.
    const rows = similarPlayers(input({ player: { playerId: 99, position: 'C', value: 4.5 } }));
    expect(ids(rows)).toEqual([12, 10, 16]);
    expect(similarPlayers(input({ player: { playerId: 99, position: 'G', value: 3.0 } })).map((row) => row.playerId)).not.toContain(20);
  });

  it('never suggests him, my players, my opponent’s, ones I marked taken, or a League Room’s', () => {
    const rows = similarPlayers(input({
      player: { playerId: 10, position: 'C', value: 2.0 },
      team: {
        players: [player(16, 'Mine', 'SEA', 'L')],
        opponent: [player(11, 'Theirs', 'SEA', 'L')],
        hiddenPickupIds: [12],
        leagueSize: 1,
        slots: BENCH_ONLY,
      },
      takenIds: new Set([13]),
    }));
    expect(rows).toEqual([]);
  });

  it('returns nothing for an unknown position or a zero limit', () => {
    expect(similarPlayers(input({ player: { playerId: 99, position: '', value: 2 } }))).toEqual([]);
    expect(similarPlayers(input({ limit: 0 }))).toEqual([]);
  });
});
