jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

let mockToday = '2026-10-10';
let mockForms: { forms: Map<number, PlayerForm> } | null = null;
jest.mock('../useTeamData', () => ({
  useNhlToday: () => mockToday,
  useTeamForms: () => ({ data: mockForms, loading: mockForms === null, refreshing: false, error: null, refresh: async () => undefined }),
  goaliesKey: (goalies: Array<{ playerId: number; team: string }>) => goalies.map((goalie) => `${goalie.playerId}:${goalie.team}`).join(','),
}));
const mockLoadGoalieNights = jest.fn();
jest.mock('../../services/nhl/goalieStarts', () => ({
  loadGoalieNights: (...args: unknown[]) => mockLoadGoalieNights(...args),
}));

// @ts-expect-error no types for react-test-renderer
import { act, create } from 'react-test-renderer';
import React from 'react';
import type { PlayerForm } from '../../services/fantasy/form';
import type { GoalieOutlook } from '../../services/fantasy/goalieOutlook';
import type { GoalieNight } from '../../services/nhl/goalieStarts';
import type { FantasyPlayer, FantasyTeam } from '../../types/fantasy';
import { useGoalieOutlook } from '../useGoalieOutlook';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** React logs this on every create(); the suite knowingly uses the renderer, like the rest of the repo. */
const DEPRECATION = 'react-test-renderer is deprecated';
const logError = console.error;
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith(DEPRECATION)) return;
    logError(...args);
  });
});
afterAll(() => jest.restoreAllMocks());

// Detroit on Oct 10, the night after Gibson started against Seattle.
const GIBSON = 8476434;
const TARASOV = 8480193;
const LARKIN = 8477946;

const player = (playerId: number, playerName: string, teamAbbrev: string, position: string, extra: Partial<FantasyPlayer> = {}): FantasyPlayer =>
  ({ playerId, playerName, teamAbbrev, position, rosterPosition: 'BN', ...extra });

const team = {
  players: [
    player(GIBSON, 'John Gibson', 'DET', 'G'),
    player(TARASOV, 'Dmitri Tarasov', 'DET', 'G'),
    player(LARKIN, 'Dylan Larkin', 'DET', 'C'),
    player(8478048, 'Igor Shesterkin', 'NYR', 'G', { injuredReserve: true }),
  ],
} as FantasyTeam;

const NIGHTS = new Map<number, GoalieNight>([
  [GIBSON, { backToBack: 'second', firstNightStarter: 'him' }],
  [TARASOV, { backToBack: 'second', firstNightStarter: 'partner' }],
]);

function form(playerId: number, startShare: number): PlayerForm {
  return {
    playerId, isGoalie: true, basis: 'current', seasonGp: 3, seasonRate: 4, recentGp: 0, recentRate: null,
    trend: 'unknown', value: 4 * startShare, startShare, season: null, recent: null,
  };
}

const FORMS = { forms: new Map([[GIBSON, form(GIBSON, 0.7)], [TARASOV, form(TARASOV, 0.3)]]) };

let latest: ReadonlyMap<number, GoalieOutlook> = new Map();
function Probe({ date, forTeam = team }: { date: string; forTeam?: FantasyTeam | null }) {
  latest = useGoalieOutlook(forTeam, date);
  return null;
}

let renderer: { update: (element: React.ReactElement) => void; unmount: () => void } | null = null;
async function show(date: string, forTeam: FantasyTeam | null = team) {
  await act(async () => {
    if (renderer) renderer.update(<Probe date={date} forTeam={forTeam} />);
    else renderer = create(<Probe date={date} forTeam={forTeam} />);
  });
}

beforeEach(() => {
  mockToday = '2026-10-10';
  mockForms = FORMS;
  mockLoadGoalieNights.mockReset();
  mockLoadGoalieNights.mockResolvedValue(NIGHTS);
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  latest = new Map();
});

describe('useGoalieOutlook', () => {
  it('gives each of my goalies playing that night his outlook', async () => {
    await show('2026-10-10');
    expect(latest.get(GIBSON)).toMatchObject({ outlook: 'unlikely', reason: 'Started last night — backups usually get the second half of a back-to-back' });
    expect(latest.get(TARASOV)).toMatchObject({ outlook: 'likely', reason: 'Back-to-back — his partner started last night' });
    expect(latest.has(LARKIN)).toBe(false);
  });

  it('asks for my goalies off IR, on that night, as of today', async () => {
    await show('2026-10-10');
    expect(mockLoadGoalieNights).toHaveBeenCalledTimes(1);
    expect(mockLoadGoalieNights).toHaveBeenCalledWith(
      [{ playerId: GIBSON, team: 'DET' }, { playerId: TARASOV, team: 'DET' }],
      '2026-10-10',
      '2026-10-10',
      { force: false },
    );
  });

  it('says “today” for the first night when the view is tomorrow', async () => {
    await show('2026-10-11');
    expect(latest.get(GIBSON)?.reason).toBe('Started today — backups usually get the second half of a back-to-back');
  });

  it('is empty until the forms load', async () => {
    mockForms = null;
    await show('2026-10-10');
    expect(latest.size).toBe(0);
  });

  it('skips the network for a team without goalies', async () => {
    await show('2026-10-10', { players: [player(LARKIN, 'Dylan Larkin', 'DET', 'C')] } as FantasyTeam);
    expect(mockLoadGoalieNights).not.toHaveBeenCalled();
    expect(latest.size).toBe(0);
  });

  it('never shows one night’s read on another while the new night loads', async () => {
    await show('2026-10-10');
    expect(latest.size).toBe(2);
    mockLoadGoalieNights.mockReturnValue(new Promise(() => undefined));
    await show('2026-10-11');
    expect(latest.size).toBe(0);
  });
});
