import type { FantasyPlayer, FantasyTeam } from '../../../types/fantasy';
import type { FormsResult } from '../../fantasy/loaders';
import type { FormBasis, PlayerForm } from '../../fantasy/form';
import { game, player, week } from '../../fantasy/__tests__/fixtures';
import type { WeekSchedule } from '../../nhl/schedule';
import { createTeam } from '../../teams';
import { loadReminderInputs, type ReminderSources } from '../reminderInputs';

const LAST_MON = '2026-10-05';
const MON = '2026-10-12';
const NEXT_MON = '2026-10-19';
const WEDNESDAY = '2026-10-14';

const mcdavid = player(8478402, 'Connor McDavid', 'EDM', 'C');
const suzuki = player(8480018, 'Nick Suzuki', 'MTL', 'C');
const SLOTS = { C: 1, LW: 0, RW: 0, F: 0, D: 0, UTIL: 0, G: 0 };

const weeks: Record<string, WeekSchedule> = {
  [LAST_MON]: week(LAST_MON, { '2026-10-11': [game('2026-10-11', 'EDM', 'VAN')] }),
  [MON]: week(MON, { [MON]: [game(MON, 'MTL', 'OTT')] }),
  [NEXT_MON]: week(NEXT_MON, { [NEXT_MON]: [game(NEXT_MON, 'EDM', 'CGY')] }),
};

function form(playerId: number, value: number, basis: FormBasis = 'current'): PlayerForm {
  return {
    playerId, isGoalie: false, basis, seasonGp: 10, seasonRate: value, recentGp: 0, recentRate: null,
    trend: 'unknown', value, startShare: 1, season: null, recent: null,
  };
}

function formsOf(forms: PlayerForm[]): FormsResult {
  return {
    forms: new Map(forms.map((row) => [row.playerId, row])),
    teamStrength: new Map(),
    seasonId: 20262027,
    previousSeasonId: 20252026,
    hasCurrentSeason: true,
  };
}

function teamOf(name: string, players: FantasyPlayer[], opponent: FantasyPlayer[] = []): FantasyTeam {
  return { ...createTeam({ name, players, slots: SLOTS }), opponent };
}

function sources(overrides: Partial<ReminderSources> = {}): ReminderSources {
  return {
    fetchWeek: jest.fn(async (monday: string) => weeks[monday]),
    loadForms: jest.fn(async (players: FantasyPlayer[]) => formsOf(players.map((row) => form(row.playerId, row === mcdavid ? 5 : 3)))),
    ...overrides,
  };
}

describe('loadReminderInputs', () => {
  it('plans this week and next, with last week seeding the lineup this Monday carries', async () => {
    const team = teamOf('Beauties', [mcdavid, suzuki]);
    const source = sources();
    const { schedules, lineups } = await loadReminderInputs([team], WEDNESDAY, source);
    expect((source.fetchWeek as jest.Mock).mock.calls.map(([monday]) => monday)).toEqual([LAST_MON, MON, NEXT_MON]);
    expect(schedules.map((row) => row.monday)).toEqual([MON, NEXT_MON]);
    // McDavid played last Sunday; Monday Suzuki needs his seat.
    expect(lineups.get(team.id)?.get(MON)).toEqual({
      start: [{ playerId: suzuki.playerId, name: 'Suzuki', slot: 'C' }],
      bench: [{ playerId: mcdavid.playerId, name: 'McDavid' }],
      emptySlots: [],
    });
  });

  it('still plans when last week fails to load, with no baseline on the first night', async () => {
    const team = teamOf('Beauties', [mcdavid, suzuki]);
    const source = sources({ fetchWeek: async (monday) => (monday === LAST_MON ? Promise.reject(new Error('offline')) : weeks[monday]) });
    const { schedules, lineups } = await loadReminderInputs([team], WEDNESDAY, source);
    expect(schedules).toHaveLength(2);
    expect(lineups.get(team.id)?.get(MON)).toBeNull();
    expect(lineups.get(team.id)?.get(NEXT_MON)?.start.map((row) => row.name)).toEqual(['McDavid']);
  });

  it('asks for the same players as the screens (roster plus opponent), so their cached requests are shared', async () => {
    const opponent = [player(8477934, 'Leon Draisaitl', 'EDM', 'C')];
    const team = teamOf('Beauties', [mcdavid, suzuki], opponent);
    const source = sources();
    await loadReminderInputs([team], WEDNESDAY, source);
    expect(source.loadForms).toHaveBeenCalledWith([mcdavid, suzuki, ...opponent], team.scoring, WEDNESDAY);
  });

  it('leaves out a team whose forms fail or carry no stats at all', async () => {
    const broken = teamOf('Broken', [mcdavid]);
    const blank = teamOf('Blank', [suzuki]);
    const fine = teamOf('Fine', [mcdavid, suzuki]);
    const source = sources({
      loadForms: async (players) => {
        if (players[0] === mcdavid && players.length === 1) throw new Error('NHL stats are busy');
        if (players[0] === suzuki) return formsOf([form(suzuki.playerId, 0, 'none')]);
        return formsOf(players.map((row) => form(row.playerId, 3)));
      },
    });
    const { lineups } = await loadReminderInputs([broken, blank, fine], WEDNESDAY, source);
    expect([...lineups.keys()]).toEqual([fine.id]);
  });

  it('starts the goalie likely to play when the other is on the second half of a back-to-back', async () => {
    // One G slot. Last Sunday Saros (NSH) started; this Monday both goalies play, and Saros is on a back-to-back he started.
    const saros = player(8477424, 'Juuse Saros', 'NSH', 'G');
    const oettinger = player(8479979, 'Jake Oettinger', 'DAL', 'G');
    const goalieWeeks: Record<string, WeekSchedule> = {
      [LAST_MON]: week(LAST_MON, { '2026-10-11': [game('2026-10-11', 'NSH', 'CHI')] }),
      [MON]: week(MON, { [MON]: [game(MON, 'NSH', 'STL'), game(MON, 'DAL', 'MIN')] }),
      [NEXT_MON]: week(NEXT_MON, {}),
    };
    const team = { ...createTeam({ name: 'Crease', players: [saros, oettinger], slots: { ...SLOTS, C: 0, G: 1 } }), opponent: [] };
    const goalieForm = (playerId: number, value: number): PlayerForm => ({ ...form(playerId, value), isGoalie: true, startShare: 0.65 });
    const loadGoalieNights = jest.fn(async (_goalies: unknown, monday: string) => (monday === MON
      ? new Map([[saros.playerId, new Map([[MON, { backToBack: 'second' as const, firstNightStarter: 'him' as const }]])]])
      : new Map()));
    const source = sources({
      fetchWeek: async (monday) => goalieWeeks[monday],
      loadForms: async () => formsOf([goalieForm(saros.playerId, 4), goalieForm(oettinger.playerId, 3)]),
      loadGoalieNights,
    });
    const { lineups } = await loadReminderInputs([team], MON, source);
    expect(lineups.get(team.id)?.get(MON)).toMatchObject({
      start: [{ name: 'Oettinger', slot: 'G' }],
      bench: [{ name: 'Saros' }],
    });
    // Without the back-to-back read, Saros (the better goalie) keeps the net and nothing changes.
    const flat = await loadReminderInputs([team], MON, { ...source, loadGoalieNights: undefined });
    expect(flat.lineups.get(team.id)?.get(MON)).toMatchObject({ start: [], bench: [] });
  });

  it('loads one team at a time, in the order given', async () => {
    const first = teamOf('First', [mcdavid]);
    const second = teamOf('Second', [suzuki]);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const loadForms = jest.fn(async (players: FantasyPlayer[]) => {
      if (players[0] === mcdavid) await gate;
      return formsOf(players.map((row) => form(row.playerId, 3)));
    });
    const pending = loadReminderInputs([first, second], WEDNESDAY, sources({ loadForms }));
    await new Promise((resolve) => setImmediate(resolve));
    expect(loadForms).toHaveBeenCalledTimes(1);
    release();
    await pending;
    expect(loadForms.mock.calls.map(([players]) => players[0].playerName)).toEqual(['Connor McDavid', 'Nick Suzuki']);
  });
});
