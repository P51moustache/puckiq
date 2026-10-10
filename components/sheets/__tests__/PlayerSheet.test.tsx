jest.mock('react-native', () => ({
  ...require('../../week/__tests__/support/mocks').reactNativeMock(),
  Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return { Ionicons: (props: object) => React.createElement('Ionicons', props) };
});
jest.mock('../../coach/PlayerAvatar', () => require('../../week/__tests__/support/mocks').playerAvatarMock());
jest.mock('../../coach/EdgePanel', () => ({ EdgePanel: () => null }));
jest.mock('../../TeamsProvider', () => ({ useTeams: () => ({ team: mockTeam, updateTeam: mockUpdateTeam }) }));
jest.mock('../../SubscriptionProvider', () => ({ useSubscription: () => ({ isPremium: mockIsPremium }) }));
jest.mock('../../PaywallProvider', () => ({ usePaywall: () => ({ openPaywall: mockOpenPaywall }) }));
jest.mock('../../league/LeagueProvider', () => ({ useRoomTakenIds: () => mockRoomTaken }));
jest.mock('../../../services/analytics/track', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
jest.mock('../../../services/fantasy/loaders', () => ({ loadPickupPool: (...args: unknown[]) => mockLoadPickupPool(...args) }));
jest.mock('../../../hooks/useHideAllowance', () => ({ useHideAllowance: () => ({ allowed: mockHidesAllowed, record: mockRecordHide }) }));
jest.mock('../../../hooks/usePlayerDetail', () => ({ usePlayerDetail: (id: number) => mockUsePlayerDetail(id) }));
jest.mock('../../../hooks/useResource', () => ({ useResource: (key: string | null, load: unknown) => mockUseResource(key, load) }));
jest.mock('../../../hooks/useCoach', () => ({
  useNhlToday: () => '2026-10-13',
  useWeekSchedule: () => ({ data: mockSchedule, error: null, loading: false, refreshing: false, refresh: jest.fn() }),
  useNight: (team: unknown, offset: number, enabled: boolean) => mockUseNight(team, offset, enabled),
}));

import React from 'react';
// @ts-expect-error no types for react-test-renderer
import { act } from 'react-test-renderer';
import type { FantasyPlayer, FantasyTeam } from '../../../types/fantasy';
import { buildSkaterForm, type PlayerForm } from '../../../services/fantasy/form';
import type { PickupCandidate } from '../../../services/fantasy/pickups';
import type { PlayerStatus } from '../../../services/fantasy/coach';
import { formatPuckDrop } from '../../../services/nhl/dates';
import type { GameLogRow, PlayerProfile } from '../../../services/nhl/player';
import type { TeamStrength } from '../../../services/nhl/teams';
import { createTeam } from '../../../services/teams';
import { busyNight, game, week } from '../../../services/fantasy/__tests__/fixtures';
import { PlayerSheetProvider, usePlayerSheet } from '../PlayerSheet';
import { press, render, unmountAll } from '../../week/__tests__/support/render';
import { allText, byTestId, oneByTestId, type Node } from '../../week/__tests__/support/tree';

const MCDAVID = 8478402;
const EBERLE = 8474586;
const TUE = '2026-10-13';
const PUCK_DROP = `${TUE}T23:00:00Z`;

const mockAlert = jest.fn();
const mockTrack = jest.fn();
const mockOpenPaywall = jest.fn();
const mockRecordHide = jest.fn();
const mockLoadPickupPool = jest.fn();
let mockHidesAllowed = true;
let mockIsPremium = false;
let mockTeam: FantasyTeam | null = null;
let mockRoomTaken = new Set<number>();
let mockStatuses = new Map<number, PlayerStatus>();
let mockUpdated: FantasyTeam | null = null;
let mockFormSettled = true;
let mockNightLoading = false;
const mockUpdateTeam = jest.fn((update: (team: FantasyTeam) => FantasyTeam) => {
  mockUpdated = update(mockTeam!);
});

/** EDM tonight vs MTL (MTL allows the 3rd-most goals), then Thu @ BOS. */
const mockSchedule = week('2026-10-12', {
  [TUE]: [game(TUE, 'MTL', 'EDM'), ...busyNight(TUE)],
  '2026-10-15': [game('2026-10-15', 'EDM', 'BOS'), ...busyNight('2026-10-15')],
});
const strength = new Map<string, TeamStrength>(
  Array.from({ length: 32 }, (_, index) => {
    const team = index === 0 ? 'MTL' : `T${index}`;
    return [team, { team, gamesPlayed: 5, goalsAgainstPerGame: 3, goalsForPerGame: 3, matchupRank: index === 0 ? 3 : 16, offenseRank: 16 }];
  }),
);

const mockUseNight = jest.fn((_team: unknown, _offset: number, enabled: boolean) => ({
  forms: { data: { teamStrength: strength }, loading: false },
  night: { data: enabled && !mockNightLoading ? { statuses: mockStatuses } : null, loading: enabled && mockNightLoading },
  day: { starters: [{ slot: 'C', playerId: MCDAVID }], bench: [] },
}));

function skater(id: number, name: string, team: string, position: string, value: number, seasonRate: number): PickupCandidate {
  return { playerId: id, name, team, position, form: { ...buildSkaterForm(id, {}), value, seasonRate } };
}

/** Twelve stars a 4-team league rosters, then the players actually around. */
const mockPool: PickupCandidate[] = [
  ...Array.from({ length: 12 }, (_, index) => skater(8400000 + index, `Star ${index}`, 'COL', 'C', 5, 9 - index / 100)),
  skater(EBERLE, 'Jordan Eberle', 'SEA', 'R', 3.0, 2),
  skater(8475000, 'Depth Winger', 'SJS', 'L', 2.6, 1.5),
  skater(8476000, 'Steady Defender', 'NSH', 'D', 3.1, 1.4),
];

const mockResourceKeys: { key: string | null; load: unknown }[] = [];
function mockUseResource(key: string | null, load: unknown) {
  mockResourceKeys.push({ key, load });
  const data = key?.startsWith('pool|') ? { candidates: mockPool, hasCurrentSeason: true, teamStrength: new Map() } : null;
  return { data, error: null, loading: false, refreshing: false, refresh: jest.fn() };
}

function profile(playerId: number, name: string, team: string, position: string): PlayerProfile {
  return { playerId, name, team, teamName: '', position, sweaterNumber: 97, headshot: null, age: 29, shoots: 'L', isActive: true };
}

function logRow(index: number, points: number): GameLogRow {
  return {
    gameId: 2026020100 + index, date: `2026-10-0${9 - index}`, opponent: `OP${index}`, isHome: index % 2 === 0, goals: 0, assists: points,
    points, ppp: 0, shots: 3, plusMinus: 0, pim: 0, toi: '20:00', started: false, decision: null, saves: 0, shotsAgainst: 0,
    goalsAgainst: 0, shutout: false,
  };
}

const LOG = [2, 1, 0, 3, 1, 0, 2, 1].map((points, index) => logRow(index, points));
const hotForm = (id: number, value: number): PlayerForm => ({ ...buildSkaterForm(id, {}), basis: 'current', value, trend: 'hot' });

const DETAILS: Record<number, { profile: PlayerProfile; form: PlayerForm; log: GameLogRow[] }> = {
  [MCDAVID]: { profile: profile(MCDAVID, 'Connor McDavid', 'EDM', 'C'), form: hotForm(MCDAVID, 3.0), log: LOG },
  [EBERLE]: { profile: profile(EBERLE, 'Jordan Eberle', 'SEA', 'R'), form: hotForm(EBERLE, 3.0), log: [] },
};
let mockDetailState: 'ready' | 'loading' | 'error' = 'ready';
const mockUsePlayerDetail = jest.fn((id: number) => {
  const detail = DETAILS[id];
  const ready = mockDetailState === 'ready' && detail;
  return {
    data: ready ? { profile: detail.profile, form: detail.form, log: { seasonId: 20262027, games: detail.log }, logIsPrevious: false, news: [] } : null,
    error: mockDetailState === 'error' ? 'boom' : null,
    loading: mockDetailState === 'loading',
    refreshing: false,
    refresh: jest.fn(),
    formSettled: !!ready && mockFormSettled,
  };
});

const mcdavid: FantasyPlayer = { playerId: MCDAVID, playerName: 'Connor McDavid', teamAbbrev: 'EDM', position: 'C', rosterPosition: 'BN' };
const NO_SLOTS = { C: 0, LW: 0, RW: 0, F: 0, D: 0, UTIL: 0, G: 0 };

let sheet: ReturnType<typeof usePlayerSheet>;
function Launcher() {
  sheet = usePlayerSheet();
  return null;
}

function openCard(playerId: number, context: 'roster' | 'pickup' | 'browse' = 'roster'): Node {
  const root = render(
    <PlayerSheetProvider>
      <Launcher />
    </PlayerSheetProvider>,
  );
  act(() => sheet.openPlayer(playerId, context, 'myteam'));
  return root;
}

const has = (root: Node, id: string) => byTestId(root, id).length > 0;

let nowSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  // Tuesday afternoon: tonight's game is still to come.
  nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.parse(`${TUE}T16:00:00Z`));
  mockHidesAllowed = true;
  mockIsPremium = false;
  mockRoomTaken = new Set();
  mockStatuses = new Map();
  mockDetailState = 'ready';
  mockFormSettled = true;
  mockNightLoading = false;
  mockUpdated = null;
  mockResourceKeys.length = 0;
  mockTeam = { ...createTeam({ name: 'Beauties', players: [mcdavid], leagueSize: 4, slots: NO_SLOTS }) };
});

afterEach(() => {
  unmountAll();
  nowSpy.mockRestore();
});

describe('PlayerSheet', () => {
  it('shows a skeleton and a close button while he loads, and Retry when he fails', () => {
    mockDetailState = 'loading';
    const loading = openCard(MCDAVID);
    expect(has(loading, 'loading-rows')).toBe(true);
    expect(has(loading, 'player-sheet-close')).toBe(true);
    unmountAll();
    mockDetailState = 'error';
    expect(has(openCard(MCDAVID), 'error-banner')).toBe(true);
  });

  it('gives my own player Remove, eligibility and the IR toggle', () => {
    const root = openCard(MCDAVID, 'roster');
    expect(has(root, 'player-remove')).toBe(true);
    expect(has(root, 'player-add')).toBe(false);
    expect(has(root, 'player-hide')).toBe(false);
    expect(has(root, 'eligible-C')).toBe(true);
    expect(has(root, 'player-ir-toggle')).toBe(true);

    press(oneByTestId(root, 'eligible-LW'));
    expect(mockUpdated?.players[0].eligible).toEqual(['C', 'LW']);

    press(oneByTestId(root, 'player-remove'));
    const [title, , buttons] = mockAlert.mock.calls[0];
    expect(title).toBe('Remove Connor McDavid?');
    act(() => buttons[1].onPress());
    expect(mockUpdated?.players).toEqual([]);
    expect(has(root, 'player-sheet')).toBe(false);
  });

  it('gives a pickup Add and Already taken, and adds him to my team', () => {
    mockTeam = { ...mockTeam!, players: [] };
    const root = openCard(MCDAVID, 'pickup');
    expect(has(root, 'player-remove')).toBe(false);
    expect(has(root, 'player-hide')).toBe(true);
    expect(has(root, 'eligible-C')).toBe(false);
    press(oneByTestId(root, 'player-add'));
    expect(mockUpdated?.players.map((player) => player.playerId)).toEqual([MCDAVID]);
    expect(has(root, 'player-sheet')).toBe(false);
  });

  it('marks a pickup taken, or opens the paywall once the sheet has closed when the free marks are used', () => {
    mockTeam = { ...mockTeam!, players: [] };
    let root = openCard(MCDAVID, 'pickup');
    press(oneByTestId(root, 'player-hide'));
    expect(mockRecordHide).toHaveBeenCalled();
    expect(mockUpdated?.hiddenPickupIds).toEqual([MCDAVID]);
    unmountAll();

    mockHidesAllowed = false;
    root = openCard(MCDAVID, 'pickup');
    const { onDismiss } = root.findByType('Modal').props;
    press(oneByTestId(root, 'player-hide'));
    expect(has(root, 'player-sheet')).toBe(false);
    expect(mockOpenPaywall).not.toHaveBeenCalled();
    act(() => onDismiss());
    expect(mockOpenPaywall).toHaveBeenCalledWith('pickups_hide');
  });

  it('locks recent form and all but 5 log games for free users; Pro sees them', () => {
    const free = openCard(MCDAVID);
    const freeText = allText(free);
    expect(freeText).toContain('Recent form & trend');
    expect(freeText).toContain('See all 8 games with Pro');
    expect(freeText).toContain('Last 5 games');
    expect(freeText.match(/OP\d/g)).toHaveLength(10); // 5 bars + 5 log rows
    unmountAll();

    mockIsPremium = true;
    const pro = allText(openCard(MCDAVID));
    expect(pro).not.toContain('Recent form & trend');
    expect(pro).not.toContain('See all');
    expect(pro).toContain('Last 8 games');
    expect(pro.match(/OP\d/g)).toHaveLength(16);
  });

  it('tells a free user he plays tonight, without the lineup call', () => {
    const root = openCard(MCDAVID);
    const verdict = oneByTestId(root, 'player-verdict');
    const text = allText(verdict);
    expect(text).toContain(`TONIGHT · ${formatPuckDrop(PUCK_DROP)} VS MTL`.toUpperCase());
    expect(text).toContain('Plays tonight');
    expect(text).toContain('Soft matchup: MTL allows the 3rd-most goals');
    expect(text).toContain('Hot: 7 pts in his last 5 games');
    expect(text).not.toMatch(/Start him|best lineup/);
    expect(mockUseNight).toHaveBeenCalledWith(mockTeam, 0, true);
  });

  it('tells Pro to start him, from tonight’s best lineup', () => {
    mockIsPremium = true;
    const verdict = oneByTestId(openCard(MCDAVID), 'player-verdict');
    expect(has(verdict, 'player-verdict-start')).toBe(true);
    expect(allText(verdict)).toContain('In your best lineup at C');
  });

  it('calls a confirmed scratch for free users too', () => {
    mockStatuses = new Map([[MCDAVID, { playerId: MCDAVID, signal: 'scratch', confidence: 'confirmed', note: null }]]);
    const verdict = oneByTestId(openCard(MCDAVID), 'player-verdict');
    expect(allText(verdict)).toContain('Scratched');
    expect(allText(verdict)).toContain('On the NHL scratch list');
  });

  it('holds the verdict until his form and tonight’s night are in, so the call never flips', () => {
    mockFormSettled = false;
    let root = openCard(MCDAVID);
    expect(has(root, 'player-verdict-loading')).toBe(true);
    expect(has(root, 'player-verdict')).toBe(false);
    // The big pickup pool waits for his own numbers, so they never queue behind it.
    expect(mockResourceKeys.filter((entry) => entry.key?.startsWith('pool|'))).toHaveLength(0);
    unmountAll();

    mockFormSettled = true;
    mockNightLoading = true;
    root = openCard(MCDAVID);
    expect(has(root, 'player-verdict-loading')).toBe(true);
    unmountAll();

    // A pickup doesn't wait on my night.
    mockTeam = { ...mockTeam!, players: [] };
    expect(has(openCard(MCDAVID, 'pickup'), 'player-verdict')).toBe(true);
  });

  it('only loads tonight’s night for my own players who still play tonight', () => {
    // After puck drop it can't change the call: tonight is locked, the verdict looks ahead.
    nowSpy.mockReturnValue(Date.parse(`${TUE}T23:30:00Z`));
    const root = openCard(MCDAVID);
    expect(mockUseNight).toHaveBeenLastCalledWith(mockTeam, 0, false);
    expect(allText(oneByTestId(root, 'player-verdict'))).toContain('Locked tonight');
    unmountAll();

    nowSpy.mockReturnValue(Date.parse(`${TUE}T16:00:00Z`));
    mockTeam = { ...mockTeam!, players: [] };
    openCard(MCDAVID, 'pickup');
    expect(mockUseNight).toHaveBeenLastCalledWith(mockTeam, 0, false);
  });

  it('tints this week’s games by matchup and says so for screen readers', () => {
    const root = openCard(MCDAVID);
    const tonight = oneByTestId(root, `player-week-${TUE}`);
    expect(tonight.props.accessibilityLabel).toBe('Tuesday: vs MTL, soft matchup');
    expect(allText(tonight)).toContain('SOFT D');
    expect(oneByTestId(root, 'player-week-2026-10-15').props.accessibilityLabel).toBe('Thursday: at BOS');
  });

  it('suggests similar available players from the Pickups pool and opens one in place', () => {
    const root = openCard(MCDAVID);
    const key = `pool|${TUE}|${JSON.stringify(mockTeam!.scoring)}`;
    const pool = mockResourceKeys.find((entry) => entry.key === key);
    expect(pool).toBeDefined();
    (pool!.load as (force: boolean) => void)(true);
    expect(mockLoadPickupPool).toHaveBeenCalledWith(TUE, mockTeam!.scoring, new Set<number>(), { force: true });

    // Forwards only, nearest value first; the stars a 4-team league rosters are left out.
    const rows = root.findAll((node: Node) => typeof node.type === 'string' && /^similar-player-\d+$/.test(node.props.testID ?? ''));
    expect(rows.map((node: Node) => node.props.testID)).toEqual([`similar-player-${EBERLE}`, 'similar-player-8475000']);

    const scrollBefore = root.findByType('ScrollView');
    press(oneByTestId(root, `similar-player-${EBERLE}`));
    expect(mockTrack).toHaveBeenLastCalledWith('player_open', { context: 'pickup', source: 'similar' });
    expect(mockUsePlayerDetail).toHaveBeenLastCalledWith(EBERLE);
    expect(allText(root)).toContain('EBERLE');
    expect(has(root, 'player-add')).toBe(true);
    // A fresh card: the body (and its scroll position) is new.
    expect(root.findByType('ScrollView')).not.toBe(scrollBefore);
  });

  it('suggests nobody for a player with no NHL numbers yet', () => {
    const blank = DETAILS[MCDAVID];
    DETAILS[MCDAVID] = { ...blank, form: { ...blank.form, basis: 'none' } };
    try {
      expect(has(openCard(MCDAVID), 'player-similar')).toBe(false);
    } finally {
      DETAILS[MCDAVID] = blank;
    }
  });

  it('never suggests players a League Room knows are taken, and hides the section without a team', () => {
    mockRoomTaken = new Set([EBERLE, 8475000]);
    expect(has(openCard(MCDAVID), 'player-similar')).toBe(false);
    unmountAll();
    mockResourceKeys.length = 0;
    mockTeam = null;
    const root = openCard(MCDAVID, 'browse');
    expect(has(root, 'player-similar')).toBe(false);
    expect(mockResourceKeys.filter((entry) => entry.key?.startsWith('pool|'))).toHaveLength(0);
  });
});
