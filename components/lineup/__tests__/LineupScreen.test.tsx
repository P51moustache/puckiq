jest.mock('react-native', () => ({
  ...require('../../week/__tests__/support/mocks').reactNativeMock(),
  Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('../../PageHeader', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../coach/TeamSwitcher', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../coach/PlayerAvatar', () =>
  require('../../week/__tests__/support/mocks').playerAvatarMock(),
);
jest.mock('../../tonight/CoachMovesSection', () => ({
  CoachMovesSection: () => null,
}));
jest.mock('../../SubscriptionProvider', () => ({
  useSubscription: () => ({ isPremium: mockPro }),
}));
jest.mock('../../PaywallProvider', () => ({
  usePaywall: () => ({ openPaywall: mockPaywall }),
}));
jest.mock('../../sheets/PlayerSheet', () => ({
  usePlayerSheet: () => ({ openPlayer: mockOpenPlayer }),
}));
jest.mock('../../TeamsProvider', () => ({
  useTeams: () => {
    const React = require('react');
    const team = React.useSyncExternalStore(
      (listener: () => void) => {
        mockListeners.add(listener);
        return () => mockListeners.delete(listener);
      },
      () => mockTeam,
    );
    return {
      team,
      ready: true,
      updateTeam: (fn: (team: FantasyTeam) => FantasyTeam) => {
        mockTeam = fn(mockTeam);
        mockListeners.forEach((fn) => fn());
      },
    };
  },
}));
jest.mock('../../../hooks/useCoach', () => ({
  useNhlToday: () => DATE,
  useNight: (_team: FantasyTeam, offset: number) => {
    const date = addDays(DATE, offset);
    const bestDay = { ...mockBest, date };
    return {
      date,
      bestDay,
      day: buildPlannedDay(mockTeam, bestDay, values),
      lineupValues: values,
      night: { data: { games: [game(date, 'EDM', 'NJD')] } },
      loading: false,
      error: null,
      refreshing: false,
      refresh: jest.fn(),
      moves: [],
    };
  },
}));
import React from 'react';
// @ts-expect-error react-test-renderer has no declaration in this project
import { act } from 'react-test-renderer';
import type { FantasyTeam } from '../../../types/fantasy';
import { createTeam } from '../../../services/teams';
import {
  buildPlannedDay,
  setLineupChoice,
} from '../../../services/fantasy/lineupPlan';
import { buildWeekPlan } from '../../../services/fantasy/weekPlan';
import { addDays } from '../../../services/nhl/dates';
import {
  game,
  player,
  week,
} from '../../../services/fantasy/__tests__/fixtures';
import LineupScreen from '../../screens/LineupScreen';
import { render, press, unmountAll } from '../../week/__tests__/support/render';
import {
  allText,
  byTestId,
  oneByTestId,
} from '../../week/__tests__/support/tree';
const DATE = '2026-10-13';
const players = [
  player(8478402, 'High center', 'EDM', 'C'),
  player(8481559, 'Low center', 'NJD', 'C'),
];
const values = new Map([
  [8478402, 10],
  [8481559, 3],
]);
const slots = { C: 1, LW: 0, RW: 0, F: 0, UTIL: 0, D: 1, G: 0 };
const mockBest = buildWeekPlan({
  players,
  values,
  slots,
  today: DATE,
  schedule: week('2026-10-12', { [DATE]: [game(DATE, 'EDM', 'NJD')] }),
}).days.find((d) => d.date === DATE)!;
let mockTeam: FantasyTeam;
let mockPro = true;
const mockListeners = new Set<() => void>();
const mockAlert = jest.fn();
const mockPush = jest.fn();
const mockPaywall = jest.fn();
const mockOpenPlayer = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  mockPro = true;
  mockTeam = setLineupChoice(
    createTeam({ players, slots }),
    DATE,
    8481559,
    'start',
  );
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse(`${DATE}T16:00:00Z`));
});
afterEach(() => {
  unmountAll();
  jest.restoreAllMocks();
  mockListeners.clear();
});
it('compares the saved plan and applies the best lineup with persistent, exact choices', () => {
  const root = render(<LineupScreen />);
  expect(allText(oneByTestId(root, 'lineup-summary'))).toContain('+7.0');
  press(oneByTestId(root, 'lineup-apply'));
  expect(mockTeam.lineupChoices?.[DATE]).toEqual({
    '8478402': 'start',
    '8481559': 'sit',
  });
  expect(allText(root)).toContain('Plan saved');
  expect(allText(root)).toContain('My plan 10.0');
  expect(mockTeam.players).toEqual(players);
});
it('benches a starter from the saved-plan tab and opens player details', () => {
  const root = render(<LineupScreen />);
  press(oneByTestId(root, 'lineup-tab-plan'));
  expect(allText(root)).toContain('Edit my lineup');
  expect(allText(oneByTestId(root, 'lineup-sit-8481559'))).toBe('Bench');
  press(oneByTestId(root, 'lineup-sit-8481559'));
  expect(mockTeam.lineupChoices?.[DATE]?.['8481559']).toBe('sit');
  const row = oneByTestId(root, 'lineup-row-8478402');
  const open = row.findAll(
    (node: any) =>
      node.type === 'Pressable' &&
      node.props.accessibilityLabel === 'View High center',
  )[0];
  press(open);
  expect(mockOpenPlayer).toHaveBeenCalledWith(8478402, 'roster', 'lineup');
});
it('resets edits from the compact comparison action without changing the roster', () => {
  const root = render(<LineupScreen />);
  press(oneByTestId(root, 'lineup-tab-plan'));
  press(oneByTestId(root, 'lineup-reset'));
  expect(mockTeam.lineupChoices?.[DATE]).toBeUndefined();
  expect(mockTeam.players).toEqual(players);
  expect(allText(root)).toContain('My plan 10.0');
});
it('rejects applying a plan after puck drop, even if the game feed still says FUT', () => {
  (Date.now as jest.Mock).mockReturnValue(Date.parse(`${DATE}T23:01:00Z`));
  const root = render(<LineupScreen />);
  const before = mockTeam;
  const apply = oneByTestId(root, 'lineup-apply');
  expect(apply.props.disabled).toBe(true);
  press(apply);
  expect(mockTeam).toBe(before);
});
it('gates optimization for free users and routes date-specific gaps to pickups', () => {
  mockPro = false;
  let root = render(<LineupScreen />);
  expect(byTestId(root, 'lineup-apply')).toHaveLength(0);
  expect(allText(root)).toContain('Your best lineup');
  unmountAll();
  mockPro = true;
  root = render(<LineupScreen />);
  press(oneByTestId(root, 'lineup-pickups'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/pickups',
    params: { date: DATE },
  });
});

it('offers a valid starter swap instead of overfilling the saved positions', () => {
  const root = render(<LineupScreen />);
  press(oneByTestId(root, 'lineup-apply'));
  press(oneByTestId(root, 'lineup-start-8481559'));
  expect(mockAlert).toHaveBeenCalled();
  const buttons = mockAlert.mock.calls[0][2];
  expect(buttons[0].text).toContain('High center');
  act(() => buttons[0].onPress());
  expect(mockTeam.lineupChoices?.[DATE]).toEqual({
    '8478402': 'sit',
    '8481559': 'start',
  });
});
it('checks the clock at the actual tap, even between timer renders', () => {
  const root = render(<LineupScreen />);
  const before = mockTeam;
  (Date.now as jest.Mock).mockReturnValue(Date.parse(`${DATE}T23:01:00Z`));
  press(oneByTestId(root, 'lineup-apply'));
  expect(mockTeam).toBe(before);
});

it('plans a selected future date without replacing today’s saved choices', () => {
  const root = render(<LineupScreen />);
  const todayChoices = mockTeam.lineupChoices?.[DATE];
  press(oneByTestId(root, 'lineup-date-picker'));
  press(oneByTestId(root, 'lineup-date-2'));
  press(oneByTestId(root, 'lineup-apply'));
  expect(mockTeam.lineupChoices?.[addDays(DATE, 2)]).toEqual({
    '8478402': 'start',
    '8481559': 'sit',
  });
  expect(mockTeam.lineupChoices?.[DATE]).toEqual(todayChoices);
});
