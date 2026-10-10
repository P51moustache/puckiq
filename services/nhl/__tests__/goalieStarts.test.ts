const mockFetchDaySlate = jest.fn();
const mockFetchWeekSchedule = jest.fn();
const mockFetchStartingGoalies = jest.fn();
jest.mock('../schedule', () => ({
  ...jest.requireActual('../schedule'),
  fetchDaySlate: (...args: unknown[]) => mockFetchDaySlate(...args),
  fetchWeekSchedule: (...args: unknown[]) => mockFetchWeekSchedule(...args),
}));
jest.mock('../gamecenter', () => ({
  ...jest.requireActual('../gamecenter'),
  fetchStartingGoalies: (...args: unknown[]) => mockFetchStartingGoalies(...args),
}));

import { busyNight, game, week } from '../../fantasy/__tests__/fixtures';
import { weekdayAbbrev } from '../dates';
import { extractStartingGoalies } from '../gamecenter';
import {
  backToBackRole,
  firstNightStarterOf,
  loadGoalieNights,
  loadWeekGoalieNights,
  teamBackToBacks,
  type GoalieRef,
} from '../goalieStarts';
import type { NhlGame, ScheduleDay } from '../schedule';

// Real ids and the real back-to-back: SEA @ DET on Oct 9 (Grubauer and Gibson started,
// Tarasov relieved Gibson), then DET @ MTL on Oct 10. VAN plays Oct 10 and Oct 11.
const GRUBAUER = 8475831;
const GIBSON = 8476434;
const TARASOV = 8480193;
const DEMKO = 8477967;
const LANKINEN = 8480947;
const STOLARZ = 8476932;
const SKINNER = 8479973;
const SHESTERKIN = 8478048;
const SWAYMAN = 8480280;

const goalie = (playerId: number, team: string): GoalieRef => ({ playerId, team });
const GOALIES = [goalie(GIBSON, 'DET'), goalie(TARASOV, 'DET'), goalie(DEMKO, 'VAN'), goalie(STOLARZ, 'TOR'), goalie(SKINNER, 'EDM')];

const SEA_DET = game('2026-10-09', 'SEA', 'DET', { state: 'OFF' });
const VAN_NJD = game('2026-10-10', 'VAN', 'NJD');

type Goalie = { playerId: number; toi: string; starter?: boolean };
const boxscore = (away: string, awayGoalies: Goalie[], home: string, homeGoalies: Goalie[]) => ({
  awayTeam: { abbrev: away },
  homeTeam: { abbrev: home },
  playerByGameStats: { awayTeam: { goalies: awayGoalies }, homeTeam: { goalies: homeGoalies } },
});

/** Box scores by game id, read through the real extractor. */
let boxscores: Record<number, ReturnType<typeof boxscore>> = {};

/** Oct 9, final: the box score flags both starters. */
const SEA_DET_FINAL = boxscore(
  'SEA', [{ playerId: GRUBAUER, toi: '59:55', starter: true }, { playerId: 8478916, toi: '00:00', starter: false }],
  'DET', [{ playerId: GIBSON, toi: '34:05', starter: true }, { playerId: TARASOV, toi: '25:55', starter: false }],
);

function slates(byDate: Record<string, NhlGame[] | Error>) {
  mockFetchDaySlate.mockImplementation(async (date: string) => {
    const slate = byDate[date];
    if (slate instanceof Error) throw slate;
    return slate ?? [];
  });
}

function octoberSlates(overrides: Record<string, NhlGame[] | Error> = {}) {
  slates({
    '2026-10-09': [SEA_DET, game('2026-10-09', 'PIT', 'CBJ', { state: 'OFF' })],
    '2026-10-10': [game('2026-10-10', 'DET', 'MTL'), VAN_NJD, game('2026-10-10', 'TOR', 'COL')],
    '2026-10-11': [game('2026-10-11', 'VAN', 'NYR'), game('2026-10-11', 'CAR', 'PHI')],
    ...overrides,
  });
}

beforeEach(() => {
  mockFetchDaySlate.mockReset();
  mockFetchWeekSchedule.mockReset();
  mockFetchStartingGoalies.mockReset();
  boxscores = { [SEA_DET.id]: SEA_DET_FINAL };
  mockFetchStartingGoalies.mockImplementation(async (gameId: number) => extractStartingGoalies(boxscores[gameId] ?? {}));
});

describe('backToBackRole', () => {
  it('is the second night after a game, the first night before one, else none', () => {
    expect(backToBackRole(true, false)).toBe('second');
    expect(backToBackRole(false, true)).toBe('first');
    expect(backToBackRole(false, false)).toBeNull();
    expect(backToBackRole(true, true)).toBe('second');
  });
});

describe('teamBackToBacks', () => {
  const day = (date: string, games: NhlGame[]): ScheduleDay => ({ date, dayAbbrev: weekdayAbbrev(date), games });

  it('pairs neighbouring game days', () => {
    const roles = teamBackToBacks([
      day('2026-10-12', [game('2026-10-12', 'EDM', 'TOR')]),
      day('2026-10-13', [game('2026-10-13', 'VAN', 'EDM')]),
      day('2026-10-14', []),
      day('2026-10-15', [game('2026-10-15', 'EDM', 'CGY')]),
    ], 'EDM');
    expect([...roles]).toEqual([['2026-10-12', 'first'], ['2026-10-13', 'second']]);
  });

  it('doesn’t pair across a gap in the days it was given', () => {
    const roles = teamBackToBacks([
      day('2026-10-12', [game('2026-10-12', 'EDM', 'TOR')]),
      day('2026-10-14', [game('2026-10-14', 'EDM', 'CGY')]),
    ], 'EDM');
    expect(roles.size).toBe(0);
  });

  it('ignores postponed and preseason games', () => {
    const roles = teamBackToBacks([
      day('2026-10-12', [game('2026-10-12', 'EDM', 'TOR', { scheduleState: 'PPD' })]),
      day('2026-10-13', [game('2026-10-13', 'VAN', 'EDM')]),
      day('2026-10-14', [game('2026-10-14', 'EDM', 'SEA', { gameType: 1 })]),
    ], 'EDM');
    expect(roles.size).toBe(0);
  });
});

describe('firstNightStarterOf', () => {
  it('reads him, a teammate, or unknown from his team’s starter', () => {
    expect(firstNightStarterOf(GIBSON, GIBSON)).toBe('him');
    expect(firstNightStarterOf(TARASOV, GIBSON)).toBe('partner');
    expect(firstNightStarterOf(GIBSON, undefined)).toBe('unknown');
  });
});

describe('loadGoalieNights', () => {
  it('reads Detroit’s second night from Seattle’s box score, Vancouver’s first night, and Toronto’s plain night', async () => {
    octoberSlates();
    const nights = await loadGoalieNights(GOALIES, '2026-10-10', '2026-10-10');
    expect(nights.get(GIBSON)).toEqual({ backToBack: 'second', firstNightStarter: 'him' });
    expect(nights.get(TARASOV)).toEqual({ backToBack: 'second', firstNightStarter: 'partner' });
    expect(nights.get(DEMKO)).toEqual({ backToBack: 'first', firstNightStarter: 'unknown' });
    expect(nights.get(STOLARZ)).toEqual({ backToBack: null, firstNightStarter: 'unknown' });
    // Edmonton doesn't play that night.
    expect(nights.has(SKINNER)).toBe(false);
    expect(mockFetchDaySlate.mock.calls.map(([date]) => date).sort()).toEqual(['2026-10-09', '2026-10-10', '2026-10-11']);
    // One box score for both Detroit goalies, cached as final.
    expect(mockFetchStartingGoalies.mock.calls).toEqual([[SEA_DET.id, { final: true, force: undefined }]]);
  });

  it('passes a pull-to-refresh through', async () => {
    octoberSlates();
    await loadGoalieNights(GOALIES, '2026-10-10', '2026-10-10', { force: true });
    expect(mockFetchDaySlate).toHaveBeenCalledWith('2026-10-09', { force: true });
    expect(mockFetchStartingGoalies).toHaveBeenCalledWith(SEA_DET.id, { final: true, force: true });
  });

  it('fails soft when last night’s slate doesn’t load', async () => {
    octoberSlates({ '2026-10-09': new Error('offline') });
    const nights = await loadGoalieNights(GOALIES, '2026-10-10', '2026-10-10');
    expect(nights.get(GIBSON)).toEqual({ backToBack: null, firstNightStarter: 'unknown' });
    expect(nights.get(DEMKO)).toEqual({ backToBack: 'first', firstNightStarter: 'unknown' });
    expect(mockFetchStartingGoalies).not.toHaveBeenCalled();
  });

  it('keeps the back-to-back but not the starter when the box score doesn’t say', async () => {
    octoberSlates();
    boxscores = {};
    const nights = await loadGoalieNights(GOALIES, '2026-10-10', '2026-10-10');
    expect(nights.get(GIBSON)).toEqual({ backToBack: 'second', firstNightStarter: 'unknown' });
  });

  it('only trusts the starter of his own team', async () => {
    octoberSlates();
    // Seattle's starter is known, Detroit's isn't (two goalies played, no flags).
    boxscores = { [SEA_DET.id]: boxscore(
      'SEA', [{ playerId: GRUBAUER, toi: '59:55' }],
      'DET', [{ playerId: GIBSON, toi: '34:05' }, { playerId: TARASOV, toi: '25:55' }],
    ) };
    const nights = await loadGoalieNights(GOALIES, '2026-10-10', '2026-10-10');
    expect(nights.get(TARASOV)).toEqual({ backToBack: 'second', firstNightStarter: 'unknown' });
  });

  it('has nothing when the night’s own slate doesn’t load', async () => {
    octoberSlates({ '2026-10-10': new Error('offline') });
    expect((await loadGoalieNights(GOALIES, '2026-10-10', '2026-10-10')).size).toBe(0);
  });

  it('reads tomorrow’s second night once tonight’s first game is under way', async () => {
    octoberSlates({ '2026-10-12': [] });
    const before = await loadGoalieNights(GOALIES, '2026-10-11', '2026-10-10');
    expect(before.get(DEMKO)).toEqual({ backToBack: 'second', firstNightStarter: 'unknown' });
    expect(mockFetchStartingGoalies).not.toHaveBeenCalled();

    // Live box scores carry no starter flags yet: the one Vancouver goalie to play so far started.
    const live = { ...VAN_NJD, state: 'LIVE' };
    octoberSlates({ '2026-10-10': [live], '2026-10-12': [] });
    boxscores = { [VAN_NJD.id]: boxscore(
      'VAN', [{ playerId: DEMKO, toi: '19:36' }, { playerId: LANKINEN, toi: '00:00' }],
      'NJD', [{ playerId: 8474596, toi: '19:36' }],
    ) };
    const during = await loadGoalieNights([goalie(DEMKO, 'VAN'), goalie(LANKINEN, 'VAN')], '2026-10-11', '2026-10-10');
    expect(during.get(DEMKO)).toEqual({ backToBack: 'second', firstNightStarter: 'him' });
    expect(during.get(LANKINEN)).toEqual({ backToBack: 'second', firstNightStarter: 'partner' });
    expect(mockFetchStartingGoalies).toHaveBeenCalledWith(VAN_NJD.id, { final: false, force: undefined });
  });

  it('skips the network without goalies', async () => {
    expect((await loadGoalieNights([], '2026-10-10', '2026-10-10')).size).toBe(0);
    expect(mockFetchDaySlate).not.toHaveBeenCalled();
  });
});

describe('loadWeekGoalieNights', () => {
  const MONDAY = '2026-10-12';
  const TODAY = '2026-10-14';
  const DET_TUESDAY = game('2026-10-13', 'DET', 'OTT', { state: 'OFF' });
  const GOALIES_WEEK = [goalie(SHESTERKIN, 'NYR'), goalie(SKINNER, 'EDM'), goalie(GIBSON, 'DET'), goalie(SWAYMAN, 'BOS')];

  function weekLoads({ before, after }: { before?: NhlGame[] | Error; after?: NhlGame[] | Error } = {}) {
    mockFetchWeekSchedule.mockResolvedValue(week(MONDAY, {
      // NYR: Sunday before + Monday (a past second night); Saturday + Sunday.
      '2026-10-12': [game('2026-10-12', 'NYR', 'NJD'), ...busyNight('2026-10-12')],
      // DET: Tuesday + Wednesday (today's second night, after a final first night).
      '2026-10-13': [DET_TUESDAY],
      // BOS: Wednesday + Thursday (tomorrow's second night; tonight's game hasn't started).
      '2026-10-14': [game('2026-10-14', 'DET', 'MTL'), game('2026-10-14', 'BOS', 'TOR')],
      '2026-10-15': [game('2026-10-15', 'BOS', 'BUF')],
      '2026-10-17': [game('2026-10-17', 'NYR', 'WSH')],
      // EDM: Sunday + the Monday after.
      '2026-10-18': [game('2026-10-18', 'PHI', 'NYR'), game('2026-10-18', 'EDM', 'CGY')],
    }));
    slates({
      '2026-10-11': before ?? [game('2026-10-11', 'VAN', 'NYR', { state: 'OFF' })],
      '2026-10-19': after ?? [game('2026-10-19', 'EDM', 'SEA')],
    });
    boxscores = { [DET_TUESDAY.id]: boxscore(
      'DET', [{ playerId: TARASOV, toi: '60:00', starter: true }, { playerId: GIBSON, toi: '00:00', starter: false }],
      'OTT', [{ playerId: 8480045, toi: '58:40', starter: true }],
    ) };
  }

  it('reads every night of the week, edges included', async () => {
    weekLoads();
    const nights = await loadWeekGoalieNights(GOALIES_WEEK, MONDAY, TODAY);
    expect(Object.fromEntries(nights.get(SHESTERKIN)!)).toEqual({
      '2026-10-12': { backToBack: 'second', firstNightStarter: 'unknown' },
      '2026-10-17': { backToBack: 'first', firstNightStarter: 'unknown' },
      '2026-10-18': { backToBack: 'second', firstNightStarter: 'unknown' },
    });
    expect(Object.fromEntries(nights.get(SKINNER)!)).toEqual({
      '2026-10-18': { backToBack: 'first', firstNightStarter: 'unknown' },
    });
    // Tarasov started Tuesday, so tonight Gibson is the rested one.
    expect(nights.get(GIBSON)!.get('2026-10-14')).toEqual({ backToBack: 'second', firstNightStarter: 'partner' });
    expect(nights.get(SWAYMAN)!.get('2026-10-15')).toEqual({ backToBack: 'second', firstNightStarter: 'unknown' });
  });

  it('reads box scores only for second nights still ahead whose first game has started', async () => {
    weekLoads();
    await loadWeekGoalieNights(GOALIES_WEEK, MONDAY, TODAY);
    expect(mockFetchStartingGoalies.mock.calls).toEqual([[DET_TUESDAY.id, { final: true, force: undefined }]]);
    expect(mockFetchWeekSchedule).toHaveBeenCalledWith(MONDAY, {});
    expect(mockFetchDaySlate.mock.calls.map(([date]) => date).sort()).toEqual(['2026-10-11', '2026-10-19']);
  });

  it('drops the edge roles when the neighbouring slates don’t load', async () => {
    weekLoads({ after: new Error('offline'), before: new Error('offline') });
    const nights = await loadWeekGoalieNights(GOALIES_WEEK, MONDAY, TODAY);
    expect(nights.get(SKINNER)!.get('2026-10-18')).toEqual({ backToBack: null, firstNightStarter: 'unknown' });
    expect(nights.get(SHESTERKIN)!.get('2026-10-12')).toEqual({ backToBack: null, firstNightStarter: 'unknown' });
  });

  it('has nothing when the week’s schedule doesn’t load', async () => {
    weekLoads();
    mockFetchWeekSchedule.mockRejectedValue(new Error('offline'));
    expect((await loadWeekGoalieNights(GOALIES_WEEK, MONDAY, TODAY)).size).toBe(0);
  });
});
