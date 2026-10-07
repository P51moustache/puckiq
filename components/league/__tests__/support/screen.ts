/**
 * Stand-ins for rendering the League screen: every provider and hook it reads comes from one
 * mutable `screen` state that a test sets before rendering. Wire them in each test file with
 * one-liners such as:
 *   jest.mock('../LeagueProvider', () => require('./support/screen').mocks.leagueProvider());
 */

import React from 'react';
import type { FantasyTeam } from '../../../../types/fantasy';
import type { RoomSnapshot } from '../../../../types/league';
import { buildRoomBoard, type LeagueError, type RoomBoardRow } from '../../../../services/league';
import { DEFAULT_SCORING } from '../../../../services/fantasy/scoring';
import { nightSummary } from '../../boardView';
import type { RoomTradeIdea } from '../../tradeIdeas';
import { BEN, busyNight, edmCol, game, hughes, makar, makeTeam, mcdavid, ME, njdVan, shesterkin, thisWeek, TODAY, week } from './fixtures';

type Host = { children?: React.ReactNode; [key: string]: unknown };
function host(name: string) {
  const Host = (props: Host) => React.createElement(name, props);
  Host.displayName = name;
  return Host;
}

/** What `useLeague()` returns: a status, a snapshot and spy actions that succeed. */
export function leagueValue(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    status: 'no_room' as string,
    snapshot: null as RoomSnapshot | null,
    error: null as LeagueError | null,
    notice: null as string | null,
    dismissNotice: jest.fn(),
    refreshing: false,
    refresh: jest.fn(async () => undefined),
    takenIds: new Set<number>(),
    create: jest.fn(async () => null as LeagueError | null),
    join: jest.fn(async (_code: string, _options: object) => null as LeagueError | null),
    leave: jest.fn(async () => null),
    setOpponent: jest.fn(async (_userId: string | null) => null),
    react: jest.fn(async (_userId: string, _emoji: string) => null),
    setDuesPaid: jest.fn(async (_userId: string, _paid: boolean) => null),
    saveDues: jest.fn(async (_dues: object) => null),
    rename: jest.fn(async (_name: string) => null),
    rotateCode: jest.fn(async () => null),
    removeMember: jest.fn(async (_userId: string) => null),
    watch: jest.fn(() => () => undefined),
    ...overrides,
  };
}

/** What `useRoomBoard` returns: the fixture week's board (or given rows, e.g. with live points). */
export function boardFor(rows?: RoomBoardRow[]) {
  return (snapshot: RoomSnapshot | null) => ({
    date: TODAY,
    rows: rows ?? (snapshot ? buildRoomBoard({ snapshot, schedule: thisWeek, today: TODAY, scoring: DEFAULT_SCORING }) : []),
    summary: nightSummary([edmCol, njdVan]),
    loading: false,
    refresh: jest.fn(async () => undefined),
  });
}

export const tradeIdea: RoomTradeIdea = { give: makar, get: hughes, myGain: 2.44, theirGain: 1.6, partnerId: BEN, partnerName: 'Ben’s Bombers' };

/** Last week with games for the recap: EDM–COL Monday; NJD–VAN and EDM–CGY Wednesday. */
function lastWeekWithGames() {
  return week('2026-10-05', {
    '2026-10-05': [game('2026-10-05', 'EDM', 'COL'), ...busyNight('2026-10-05')],
    '2026-10-07': [game('2026-10-07', 'NJD', 'VAN'), game('2026-10-07', 'EDM', 'CGY'), ...busyNight('2026-10-07')],
  });
}

function freshState() {
  return {
    isPremium: false,
    team: makeTeam({ players: [mcdavid, makar, shesterkin] }) as FantasyTeam | null,
    auth: { user: { id: ME } as { id: string } | null, appleSignInReady: true, signInWithApple: jest.fn(async () => true) },
    league: leagueValue(),
    lastWeek: lastWeekWithGames(),
    board: boardFor(),
    trades: (requested: boolean) => ({ data: requested ? [tradeIdea] : null, loading: false, error: null, refreshing: false, refresh: jest.fn() }),
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
    openPlayer: jest.fn(),
    openPaywall: jest.fn(),
    track: jest.fn(),
  };
}

/** The state every stand-in reads. Reset it in beforeEach with `resetScreen()`. */
export const screen = freshState();

export function resetScreen(): void {
  Object.assign(screen, freshState());
}

/** Module factories for jest.mock. */
export const mocks = {
  expoRouter: () => ({
    useRouter: () => screen.router,
    // Focus = mount in these tests.
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
  }),
  vectorIcons: () => ({ Ionicons: host('Ionicons') }),
  pageHeader: () => ({ title, right, accessory }: { title: string; right?: React.ReactNode; accessory?: React.ReactNode }) =>
    React.createElement('PageHeader', { title }, accessory, right),
  /** A default-export component that renders nothing / a named host element. */
  nothing: () => () => null,
  defaultHost: (name: string) => host(name),
  howItWorks: () => ({ HowItWorksButton: host('HowItWorksButton') }),
  playerAvatar: () => ({ PlayerAvatar: () => null, PlayerName: ({ name }: { name: string }) => React.createElement('Text', null, name) }),
  shareCards: () => ({ ShareButton: host('ShareButton'), ShareCardSheet: host('ShareCardSheet') }),
  playerSheet: () => ({ usePlayerSheet: () => ({ openPlayer: screen.openPlayer }) }),
  paywall: () => ({ usePaywall: () => ({ openPaywall: screen.openPaywall }) }),
  subscription: () => ({ useSubscription: () => ({ isPremium: screen.isPremium }) }),
  teams: () => ({ useTeams: () => ({ team: screen.team, teams: screen.team ? [screen.team] : [], ready: true }) }),
  auth: () => ({ useAuthContext: () => screen.auth }),
  leagueProvider: () => ({ useLeague: () => screen.league }),
  roomBoard: () => ({ useRoomBoard: (snapshot: RoomSnapshot | null) => screen.board(snapshot) }),
  tradeIdeas: () => ({ useTradeIdeas: (_snapshot: unknown, _mine: unknown, requested: boolean) => screen.trades(requested) }),
  coachHooks: () => ({ useNhlToday: () => TODAY, useWeekSchedule: () => ({ data: screen.lastWeek }) }),
  track: () => ({ track: (...args: unknown[]) => screen.track(...args) }),
};
