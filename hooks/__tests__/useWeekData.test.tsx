jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) },
}));
const mockLoadPlayerForms = jest.fn();
const mockLoadWeekSchedule = jest.fn();
jest.mock('../../services/fantasy/loaders', () => ({
  ...jest.requireActual('../../services/fantasy/loaders'),
  loadPlayerForms: (...args: unknown[]) => mockLoadPlayerForms(...args),
  loadWeekSchedule: (...args: unknown[]) => mockLoadWeekSchedule(...args),
}));
const mockLoadWeekGoalieNights = jest.fn();
jest.mock('../../services/nhl/goalieStarts', () => ({
  ...jest.requireActual('../../services/nhl/goalieStarts'),
  loadWeekGoalieNights: (...args: unknown[]) => mockLoadWeekGoalieNights(...args),
}));

// @ts-expect-error no types for react-test-renderer
import { act, create } from 'react-test-renderer';
import React from 'react';
import { busyNight, game, player, week } from '../../services/fantasy/__tests__/fixtures';
import type { PlayerForm } from '../../services/fantasy/form';
import { startChance } from '../../services/fantasy/goalieOutlook';
import { DEFAULT_SCORING } from '../../services/fantasy/scoring';
import type { GoalieNight, GoalieNights } from '../../services/nhl/goalieStarts';
import type { FantasyTeam } from '../../types/fantasy';
import { useWeekData, type WeekData } from '../useCoach';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const DEPRECATION = 'react-test-renderer is deprecated';
const logError = console.error;
beforeAll(() => {
  // Dev builds pin "today" this way (services/nhl/dates).
  process.env.EXPO_PUBLIC_DEV_DATE = '2026-10-14';
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith(DEPRECATION)) return;
    logError(...args);
  });
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_DEV_DATE;
  jest.restoreAllMocks();
});

const MONDAY = '2026-10-12';
const GIBSON = 8476434; // DET: Tuesday + Wednesday (today), and he started Tuesday
const SHESTERKIN = 8478048; // the opponent's goalie, NYR on Wednesday

const team: FantasyTeam = {
  id: 'team-1',
  name: 'Beauties',
  platform: 'yahoo',
  leagueSize: 12,
  minGoalieStarts: 0,
  slots: { C: 0, LW: 0, RW: 0, F: 0, D: 0, UTIL: 0, G: 1 },
  scoring: { ...DEFAULT_SCORING },
  players: [player(GIBSON, 'John Gibson', 'DET', 'G')],
  opponentName: 'Rival',
  opponent: [player(SHESTERKIN, 'Igor Shesterkin', 'NYR', 'G')],
  hiddenPickupIds: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

function form(playerId: number, startShare: number): PlayerForm {
  return {
    playerId, isGoalie: true, basis: 'current', seasonGp: 3, seasonRate: 5, recentGp: 0, recentRate: null,
    trend: 'unknown', value: 5 * startShare, startShare, season: null, recent: null,
  };
}

const night = (backToBack: GoalieNight['backToBack'], firstNightStarter: GoalieNight['firstNightStarter'] = 'unknown'): GoalieNight =>
  ({ backToBack, firstNightStarter });
const NIGHTS: GoalieNights = new Map([
  [GIBSON, new Map([['2026-10-13', night('first')], ['2026-10-14', night('second', 'him')]])],
  [SHESTERKIN, new Map([['2026-10-14', night(null)]])],
]);

let latest: WeekData | null = null;
function Probe() {
  latest = useWeekData(team);
  return null;
}

let renderer: { unmount: () => void } | null = null;
async function show() {
  await act(async () => {
    renderer = create(<Probe />);
  });
}

beforeEach(() => {
  mockLoadWeekSchedule.mockResolvedValue(week(MONDAY, {
    '2026-10-13': [game('2026-10-13', 'DET', 'OTT')],
    '2026-10-14': [game('2026-10-14', 'DET', 'MTL'), game('2026-10-14', 'NYR', 'COL'), ...busyNight('2026-10-14')],
  }));
  mockLoadPlayerForms.mockResolvedValue({
    forms: new Map([[GIBSON, form(GIBSON, 0.7)], [SHESTERKIN, form(SHESTERKIN, 0.65)]]),
    teamStrength: new Map(),
    seasonId: 20262027,
    previousSeasonId: 20252026,
    hasCurrentSeason: true,
  });
  mockLoadWeekGoalieNights.mockReset();
  mockLoadWeekGoalieNights.mockResolvedValue(NIGHTS);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  latest = null;
});

describe('useWeekData — goalie nights', () => {
  it('loads both sides’ goalies for the week', async () => {
    await show();
    expect(mockLoadWeekGoalieNights).toHaveBeenCalledWith(
      [{ playerId: GIBSON, team: 'DET' }, { playerId: SHESTERKIN, team: 'NYR' }],
      MONDAY,
      '2026-10-14',
      { force: false },
    );
  });

  it('plans each goalie night with its start chance and marks the back-to-back', async () => {
    await show();
    const plan = latest!.plan!;
    const tuesday = startChance({ startShare: 0.7, backToBack: 'first' });
    const tonight = startChance({ startShare: 0.7, backToBack: 'second', firstNightStarter: 'him' });
    expect(plan.week.goalieStarts).toBeCloseTo(tuesday + tonight);
    expect(plan.remaining.goalieStarts).toBeCloseTo(tonight);
    expect(plan.players[GIBSON].byDate['2026-10-14'].backToBack).toBe('second');
    expect(latest!.opponentPlan!.week.goalieStarts).toBeCloseTo(startChance({ startShare: 0.65, backToBack: null }));
  });

  it('plans with flat start shares until the nights load', async () => {
    let resolve: (nights: GoalieNights) => void = () => undefined;
    mockLoadWeekGoalieNights.mockReturnValue(new Promise<GoalieNights>((done) => { resolve = done; }));
    await show();
    expect(latest!.plan!.week.goalieStarts).toBeCloseTo(0.7 + 0.7);
    expect(latest!.loading).toBe(false);
    await act(async () => resolve(NIGHTS));
    expect(latest!.plan!.week.goalieStarts).toBeLessThan(1);
  });

  it('keeps its return shape (plus the plan inputs pickups share), and refreshes the nights with everything else', async () => {
    await show();
    expect(Object.keys(latest!).sort()).toEqual(['error', 'forms', 'loading', 'matchup', 'monday', 'opponentPlan', 'plan', 'planInputs', 'refresh', 'refreshing', 'schedule']);
    expect(latest!.planInputs?.startChanceOn).toEqual(expect.any(Function));
    await act(async () => latest!.refresh());
    expect(mockLoadWeekGoalieNights).toHaveBeenLastCalledWith(expect.any(Array), MONDAY, '2026-10-14', { force: true });
  });
});
