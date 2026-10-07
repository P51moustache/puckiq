/**
 * One realistic week for Week tests, solved by the real planner.
 *
 * Lineup: 1 C · 1 D · 1 G. Today is Wednesday Oct 14, so Monday and Tuesday are past.
 *   Mon  EDM @ TOR (busy)      McDavid counts; Draisaitl, Matthews lost to the bench
 *   Tue  VAN @ EDM (off-night) McDavid counts; Draisaitl bench   ← EDM back-to-back
 *   Wed  NYR @ COL (busy)      Makar, Shesterkin count            ← today
 *   Thu  BOS @ TOR (busy)      Matthews counts
 *   Fri  no NHL games
 *   Sat  EDM, TOR, COL (busy)  McDavid, Makar count; Draisaitl, Matthews bench
 *   Sun  NJD @ NYR (off-night) Shesterkin counts
 */

import type { WeekData } from '../../../../hooks/useCoach';
import { compareWeeks } from '../../../../services/fantasy/matchup';
import { DEFAULT_SCORING } from '../../../../services/fantasy/scoring';
import { buildWeekPlan, type WeekPlan } from '../../../../services/fantasy/weekPlan';
import { addDays } from '../../../../services/nhl/dates';
import type { WeekSchedule } from '../../../../services/nhl/schedule';
import type { FantasyPlayer, FantasyTeam, LineupSlots } from '../../../../types/fantasy';
import { busyNight, game, player, week } from '../../../../services/fantasy/__tests__/fixtures';

export const MONDAY = '2026-10-12';
export const TODAY = '2026-10-14';
export const NEXT_MONDAY = addDays(MONDAY, 7);

export const MCDAVID = 8478402;
export const DRAISAITL = 8477934;
export const MATTHEWS = 8479318;
export const MAKAR = 8480069;
export const SHESTERKIN = 8478048;
export const ON_IR = 8470005;
export const MACKINNON = 8477492;
export const HUGHES = 8480800;

export const SLOTS: LineupSlots = { C: 1, LW: 0, RW: 0, F: 0, D: 1, UTIL: 0, G: 1 };

export const ROSTER: FantasyPlayer[] = [
  player(MCDAVID, 'Connor McDavid', 'EDM', 'C'),
  player(DRAISAITL, 'Leon Draisaitl', 'EDM', 'C'),
  player(MATTHEWS, 'Auston Matthews', 'TOR', 'C'),
  player(MAKAR, 'Cale Makar', 'COL', 'D'),
  player(SHESTERKIN, 'Igor Shesterkin', 'NYR', 'G'),
  player(ON_IR, 'On Reserve', 'EDM', 'C', { injuredReserve: true }),
  player(1_756_000_000_000_001, 'Typed Name', '', 'C'),
];

export const OPPONENT: FantasyPlayer[] = [
  player(MACKINNON, 'Nathan MacKinnon', 'COL', 'C'),
  player(HUGHES, 'Quinn Hughes', 'VAN', 'D'),
];

const VALUES = new Map<number, number>([
  [MCDAVID, 5],
  [DRAISAITL, 4],
  [MATTHEWS, 3.5],
  [MAKAR, 3],
  [SHESTERKIN, 4],
  [MACKINNON, 4.5],
  [HUGHES, 3],
]);

export function thisWeekSchedule(): WeekSchedule {
  return week(MONDAY, {
    '2026-10-12': [game('2026-10-12', 'EDM', 'TOR'), ...busyNight('2026-10-12')],
    '2026-10-13': [game('2026-10-13', 'VAN', 'EDM')],
    '2026-10-14': [game('2026-10-14', 'NYR', 'COL'), ...busyNight('2026-10-14')],
    '2026-10-15': [game('2026-10-15', 'BOS', 'TOR'), ...busyNight('2026-10-15')],
    '2026-10-17': [
      game('2026-10-17', 'CGY', 'EDM'),
      game('2026-10-17', 'TOR', 'MTL'),
      game('2026-10-17', 'DAL', 'COL'),
      ...busyNight('2026-10-17'),
    ],
    '2026-10-18': [game('2026-10-18', 'NJD', 'NYR')],
  });
}

/** Next week: every day still ahead, EDM twice, nobody else. */
export function nextWeekSchedule(): WeekSchedule {
  return week(NEXT_MONDAY, {
    [addDays(NEXT_MONDAY, 1)]: [game(addDays(NEXT_MONDAY, 1), 'EDM', 'SEA'), ...busyNight(addDays(NEXT_MONDAY, 1))],
    [addDays(NEXT_MONDAY, 3)]: [game(addDays(NEXT_MONDAY, 3), 'WPG', 'EDM'), ...busyNight(addDays(NEXT_MONDAY, 3))],
  });
}

export function planFor(players: FantasyPlayer[], schedule: WeekSchedule = thisWeekSchedule(), today = TODAY): WeekPlan {
  return buildWeekPlan({ schedule, players, slots: SLOTS, values: VALUES, today });
}

export function makeTeam(overrides: Partial<FantasyTeam> = {}): FantasyTeam {
  return {
    id: 'team-1',
    name: 'Beauties',
    platform: 'yahoo',
    leagueSize: 12,
    minGoalieStarts: 0,
    slots: SLOTS,
    scoring: { ...DEFAULT_SCORING },
    players: ROSTER,
    opponentName: '',
    opponent: [],
    hiddenPickupIds: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

/** What `useWeekData` returns for a team and week, with the real planner behind it. */
export function weekDataFor(team: FantasyTeam, weekOffset: 0 | 1, overrides: Partial<WeekData> = {}): WeekData {
  const schedule = weekOffset === 0 ? thisWeekSchedule() : nextWeekSchedule();
  const plan = planFor(team.players, schedule);
  const opponentPlan = team.opponent.length > 0 ? planFor(team.opponent, schedule) : null;
  return {
    monday: schedule.monday,
    schedule: { data: schedule, loading: false, refreshing: false, error: null, refresh: async () => undefined },
    forms: { data: null, loading: false, refreshing: false, error: null, refresh: async () => undefined },
    plan,
    opponentPlan,
    matchup: opponentPlan ? compareWeeks(plan, opponentPlan) : null,
    loading: false,
    refreshing: false,
    error: null,
    refresh: async () => undefined,
    ...overrides,
  } as WeekData;
}
