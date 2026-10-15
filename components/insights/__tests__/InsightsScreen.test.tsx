import React from 'react';
// @ts-expect-error no types for react-test-renderer
import { act } from 'react-test-renderer';
import { createTeam } from '../../../services/teams';
import type { CoachMove } from '../../../services/fantasy/coach';
import { player } from '../../../services/fantasy/__tests__/fixtures';
import InsightsScreen from '../../screens/InsightsScreen';
import { detailForMove, detailForWaiver } from '../insightDetails';
import { render, press, unmountAll } from '../../week/__tests__/support/render';
import {
  allText,
  byTestId,
  oneByTestId,
} from '../../week/__tests__/support/tree';

jest.mock('react-native', () =>
  jest.requireActual('../../week/__tests__/support/mocks').reactNativeMock(),
);
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('../../../services/analytics/track', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../PageHeader', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../coach/TeamSwitcher', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../coach/HockeyHero', () => ({ HockeyHero: () => null }));
jest.mock('../../coach/PlayerAvatar', () =>
  jest.requireActual('../../week/__tests__/support/mocks').playerAvatarMock(),
);
jest.mock('../InsightsTrades', () => ({ InsightsTrades: () => null }));
jest.mock('../../TeamsProvider', () => ({
  useTeams: () => ({ team: mockTeam }),
}));
jest.mock('../../SubscriptionProvider', () => ({
  useSubscription: () => ({ isPremium: mockPro }),
}));
jest.mock('../../PaywallProvider', () => ({
  usePaywall: () => ({ openPaywall: jest.fn() }),
}));
jest.mock('../../league/LeagueProvider', () => ({
  useRoomTakenIds: () => new Set(),
}));
jest.mock('../../sheets/PlayerSheet', () => ({
  usePlayerSheet: () => ({ openPlayer: mockOpenPlayer }),
}));
jest.mock('../../../hooks/useCoach', () => ({
  useNight: () => ({
    moves: mockMoves,
    forms: { data: { forms: new Map() } },
    night: { data: { news: [] } },
    loading: false,
    error: null,
    refreshing: false,
  }),
  usePickups: () => ({
    rows: [],
    loading: false,
    error: null,
    refreshing: false,
  }),
}));

const mockTeam = createTeam({
  players: [
    player(1, 'First player', 'EDM', 'C'),
    player(2, 'Second player', 'NJD', 'C'),
  ],
});
const mockMoves: CoachMove[] = [
  {
    id: 'overflow',
    kind: 'overflow',
    severity: 2,
    title: 'Choose your starters',
    detail: 'Compare both players before choosing who starts.',
    playerIds: [1, 2],
  },
  {
    id: 'empty',
    kind: 'empty',
    severity: 2,
    title: 'An open defense slot',
    detail: 'A pickup can add a usable game.',
    playerIds: [],
    slot: 'D',
  },
];
const mockPush = jest.fn();
const mockTrack = jest.fn();
const mockOpenPlayer = jest.fn();
let mockPro = true;
beforeEach(() => {
  jest.clearAllMocks();
  mockPro = true;
});
afterEach(unmountAll);

it('opens the full group insight and the selected player after native dismissal', () => {
  const root = render(<InsightsScreen />);
  press(oneByTestId(root, 'insight-featured'));
  expect(allText(root)).toContain(mockMoves[0].detail);
  expect(byTestId(root, 'insight-player-1')).toHaveLength(1);
  expect(byTestId(root, 'insight-player-2')).toHaveLength(1);
  const dismiss = root.findByType('Modal').props.onDismiss;
  press(oneByTestId(root, 'insight-player-2'));
  expect(mockOpenPlayer).not.toHaveBeenCalled();
  act(() => dismiss());
  expect(mockOpenPlayer).toHaveBeenCalledWith(2, 'roster', 'tonight');
  expect(byTestId(root, 'insight-player-2')).toHaveLength(0);
});

it('routes a lineup insight to the optimizer after dismissal', () => {
  const root = render(<InsightsScreen />);
  press(oneByTestId(root, 'insight-featured'));
  const dismiss = root.findByType('Modal').props.onDismiss;
  press(oneByTestId(root, 'insight-action'));
  expect(mockPush).not.toHaveBeenCalled();
  act(() => dismiss());
  expect(mockPush).toHaveBeenCalledWith('/lineup');
});

it('routes an empty-slot insight to pickups without inventing a player', () => {
  const root = render(<InsightsScreen />);
  press(oneByTestId(root, 'insight-move-empty'));
  expect(allText(root)).toContain('Find pickups for my lineup');
  expect(byTestId(root, 'insight-player-1')).toHaveLength(0);
  const dismiss = root.findByType('Modal').props.onDismiss;
  press(oneByTestId(root, 'insight-action'));
  act(() => dismiss());
  expect(mockPush).toHaveBeenCalledWith('/pickups');
});

it('closes details without triggering player or navigation actions', () => {
  const root = render(<InsightsScreen />);
  press(oneByTestId(root, 'insight-featured'));
  const dismiss = root.findByType('Modal').props.onDismiss;
  press(oneByTestId(root, 'insight-close'));
  act(() => dismiss());
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockOpenPlayer).not.toHaveBeenCalled();
});

it('keeps move ordering and removes missing or repeated roster references', () => {
  const detail = detailForMove(
    { ...mockMoves[0], playerIds: [2, 999, 2, 1] },
    mockTeam.players,
  );
  expect(detail.players.map((p) => p.id)).toEqual([2, 1]);
  expect(detail.players.every((p) => p.owned)).toBe(true);
});

it('keeps additional insight details behind the existing Pro gate', () => {
  mockPro = false;
  const root = render(<InsightsScreen />);
  expect(byTestId(root, 'insight-move-empty')).toHaveLength(0);
  press(oneByTestId(root, 'insight-featured'));
  expect(byTestId(root, 'insight-player-2')).toHaveLength(1);
  expect(mockTrack).toHaveBeenCalledWith('advice_open', expect.objectContaining({ move_kind: 'overflow' }));
  const dismiss = root.findByType('Modal').props.onDismiss;
  press(oneByTestId(root, 'insight-action'));
  act(() => dismiss());
  expect(mockTrack).toHaveBeenCalledWith('advice_action', expect.objectContaining({ action: 'lineup', gated: false }));
});

it('presents a waiver target with the measured schedule counts and pickup context', () => {
  const detail = detailForWaiver({
    playerId: 3,
    name: 'Waiver player',
    team: 'DET',
    position: 'C',
    usableGames: 3,
    offNightGames: 2,
    emptyFills: 1,
  });
  expect(detail.detail).toContain(
    '3 usable games left this week, 2 off-night games, and 1 empty slots filled',
  );
  expect(detail.detail).toContain('Estimated availability; check your league.');
  expect(detail.players[0]).toMatchObject({ id: 3, owned: false });
  expect(detail.action).toBe('pickups');
});
