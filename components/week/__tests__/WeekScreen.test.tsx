jest.mock('react-native', () => require('./support/mocks').reactNativeMock());
jest.mock('react-native-svg', () => require('./support/mocks').svgMock());
jest.mock('../../coach/PlayerAvatar', () => require('./support/mocks').playerAvatarMock());
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return { Ionicons: (props: object) => React.createElement('Ionicons', props) };
});
jest.mock('../../PageHeader', () => {
  const React = require('react');
  const PageHeader = ({ title, right, accessory }: { title: string; right?: unknown; accessory?: unknown }) =>
    React.createElement('PageHeader', { title }, accessory, right);
  return PageHeader;
});
jest.mock('../../coach/TeamSwitcher', () => function TeamSwitcher() {
  return null;
});
jest.mock('../../sheets/PlayerSearchSheet', () => {
  const React = require('react');
  const PlayerSearchSheet = (props: object) => React.createElement('PlayerSearchSheet', props);
  return PlayerSearchSheet;
});
jest.mock('../../share/ShareCards', () => {
  const React = require('react');
  return {
    ShareButton: (props: object) => React.createElement('ShareButton', props),
    ShareCardSheet: (props: object) => React.createElement('ShareCardSheet', props),
  };
});
jest.mock('../../sheets/PlayerSheet', () => ({ usePlayerSheet: () => ({ openPlayer: mockOpenPlayer }) }));
jest.mock('../../PaywallProvider', () => ({ usePaywall: () => ({ openPaywall: mockOpenPaywall }) }));
jest.mock('../../SubscriptionProvider', () => ({ useSubscription: () => ({ isPremium: mockIsPremium }) }));
jest.mock('../../TeamsProvider', () => ({ useTeams: () => ({ team: mockTeam, ready: true }) }));
jest.mock('../../../services/analytics/selection', () => ({
  trackedChoice: (_screen: string, _control: string, apply: (value: string) => void) => apply,
}));
jest.mock('../../../hooks/useCoach', () => ({
  useNhlToday: () => '2026-10-14',
  useWeekHasGamesLeft: () => mockHasGamesLeft,
  useWeekData: (team: FantasyTeam, offset: 0 | 1) => mockUseWeekData(team, offset),
}));

import React from 'react';
import type { FantasyTeam } from '../../../types/fantasy';
import type { WeekData } from '../../../hooks/useCoach';
import WeekScreen from '../../screens/WeekScreen';
import { mockWindow } from './support/mocks';
import { press, render, unmountAll } from './support/render';
import { allText, byTestId, oneByTestId, textOf, type Node } from './support/tree';
import {
  DRAISAITL,
  MAKAR,
  MATTHEWS,
  MCDAVID,
  ON_IR,
  OPPONENT,
  SHESTERKIN,
  makeTeam,
  weekDataFor,
} from './support/weekFixtures';

const mockOpenPlayer = jest.fn();
const mockOpenPaywall = jest.fn();
let mockIsPremium = false;
let mockTeam: FantasyTeam | null = null;
let mockHasGamesLeft: boolean | null = true;
let mockOverrides: Partial<WeekData> = {};
const mockUseWeekData = jest.fn((team: FantasyTeam, offset: 0 | 1) => weekDataFor(team, offset, mockOverrides));

const renderScreen = () => render(<WeekScreen />);
const lastOffset = () => mockUseWeekData.mock.calls[mockUseWeekData.mock.calls.length - 1][1];
const rowIds = (root: Node) =>
  root
    .findAll((node: Node) => typeof node.type === 'string' && /^week-row-\d+$/.test(node.props.testID ?? ''))
    .map((node: Node) => Number(node.props.testID.replace('week-row-', '')));
const searchSheet = (root: Node) => root.findAll((node: Node) => node.type === 'PlayerSearchSheet')[0];

afterEach(unmountAll);

beforeEach(() => {
  jest.clearAllMocks();
  mockWindow.width = 390;
  mockIsPremium = false;
  mockHasGamesLeft = true;
  mockOverrides = {};
  mockTeam = makeTeam();
});

describe('WeekScreen', () => {
  it('asks for a roster when the team has no players', () => {
    mockTeam = makeTeam({ players: [] });
    expect(allText(renderScreen())).toContain('No roster yet');
  });

  it('shows the error state when the schedule fails with nothing cached', () => {
    mockOverrides = { plan: null, error: 'offline' };
    const root = renderScreen();
    expect(byTestId(root, 'error-state')).toHaveLength(1);
    expect(byTestId(root, 'week-grid')).toHaveLength(0);
  });

  it('shows loading rows while the first load runs', () => {
    mockOverrides = { plan: null, loading: true };
    expect(byTestId(renderScreen(), 'loading-rows')).toHaveLength(1);
  });

  it('explains the chart behind an ⓘ instead of a footnote', () => {
    mockIsPremium = true;
    const root = renderScreen();
    expect(byTestId(root, 'how-week-button')).toHaveLength(1);
    expect(byTestId(root, 'how-week-matchup-button')).toHaveLength(1);
    const text = allText(root);
    expect(text).not.toContain('Amber =');
    expect(text).not.toContain('Remaining days only');
  });

  describe('free', () => {
    it('leads with games left and locks the lineup math', () => {
      const root = renderScreen();
      expect(textOf(oneByTestId(root, 'week-big'))).toBe('8');
      expect(allText(oneByTestId(root, 'week-summary'))).toContain('games left this week\n13 total · 2 off-nights');
      expect(byTestId(root, 'week-benched')).toHaveLength(0);
      press(oneByTestId(root, 'week-planner-locked'));
      expect(mockOpenPaywall).toHaveBeenCalledWith('week_planner');
    });

    it('keeps next week behind Pro while this week still has games', () => {
      const root = renderScreen();
      press(oneByTestId(root, 'week-toggle-next'));
      expect(mockOpenPaywall).toHaveBeenCalledWith('week_next');
      expect(lastOffset()).toBe(0);
    });

    it('opens on next week, free, once this week has no games left', () => {
      mockHasGamesLeft = false;
      const root = renderScreen();
      expect(lastOffset()).toBe(1);
      expect(byTestId(root, 'week-empty-notice')).toHaveLength(0);
      press(oneByTestId(root, 'week-toggle-this'));
      expect(lastOffset()).toBe(0);
      press(oneByTestId(root, 'week-empty-notice'));
      expect(lastOffset()).toBe(1);
      expect(mockOpenPaywall).not.toHaveBeenCalled();
    });

    it('locks the matchup', () => {
      const root = renderScreen();
      expect(byTestId(root, 'matchup-card')).toHaveLength(0);
      press(oneByTestId(root, 'matchup-locked'));
      expect(mockOpenPaywall).toHaveBeenCalledWith('matchup');
    });

    it('draws every game as a plain bar and keys only off-nights', () => {
      const root = renderScreen();
      expect(byTestId(root, 'stint-bench')).toHaveLength(0);
      expect(byTestId(root, 'stint-count')).toHaveLength(0);
      expect(byTestId(root, 'stint-game')).toHaveLength(13);
      const key = allText(oneByTestId(root, 'week-key'));
      expect(key).toBe('OFF-NIGHT');
    });

    it('totals who plays each day but not empty slots', () => {
      const root = renderScreen();
      expect(byTestId(root, 'week-totals-playing')).toHaveLength(1);
      expect(byTestId(root, 'week-totals-empty')).toHaveLength(0);
    });
  });

  describe('Pro', () => {
    beforeEach(() => {
      mockIsPremium = true;
    });

    it('leads with games that count, then games, bench losses and empty slots', () => {
      const root = renderScreen();
      expect(textOf(oneByTestId(root, 'week-big'))).toBe('6');
      expect(allText(oneByTestId(root, 'week-summary'))).toContain('games that count\nleft this week');
      expect(textOf(oneByTestId(root, 'week-benched'))).toContain('2');
      expect(textOf(oneByTestId(root, 'week-empty'))).toContain('6');
      expect(byTestId(root, 'week-planner-locked')).toHaveLength(0);
    });

    it('flags a goalie minimum the week will miss', () => {
      mockTeam = makeTeam({ minGoalieStarts: 3 });
      const line = textOf(oneByTestId(renderScreen(), 'week-goalie-min'));
      expect(line).toContain('~1.0 expected goalie starts · league minimum 3');
      expect(line).toContain('stream a goalie');
    });

    it('splits games that count from games lost to the bench, with a key', () => {
      const root = renderScreen();
      expect(byTestId(root, 'stint-count')).toHaveLength(8);
      expect(byTestId(root, 'stint-bench')).toHaveLength(5);
      expect(byTestId(root, 'stint-game')).toHaveLength(0);
      expect(allText(oneByTestId(root, 'week-key'))).toBe('COUNTS | BENCH | OFF-NIGHT');
      expect(byTestId(root, 'week-totals-empty')).toHaveLength(1);
    });

    it('offers to add the opponent when there is none', () => {
      const root = renderScreen();
      expect(searchSheet(root).props.visible).toBe(false);
      press(oneByTestId(root, 'matchup-add'));
      expect(searchSheet(root).props.visible).toBe(true);
      expect(searchSheet(root).props.mode).toEqual({ kind: 'add', list: 'opponent' });
    });

    it('compares games that count with a typed-in opponent, editable', () => {
      mockTeam = makeTeam({ opponentName: 'Rivals', opponent: OPPONENT, opponentSource: 'manual' });
      const root = renderScreen();
      const card = oneByTestId(root, 'matchup-card');
      expect(allText(card)).toContain('AHEAD');
      expect(textOf(oneByTestId(card, 'matchup-title'))).toBe('vs Rivals');
      expect(textOf(oneByTestId(card, 'matchup-mine'))).toBe('6');
      expect(textOf(oneByTestId(card, 'matchup-theirs'))).toBe('2');
      expect(textOf(oneByTestId(card, 'matchup-edge'))).toBe('+4');
      press(oneByTestId(card, 'matchup-edit'));
      expect(searchSheet(root).props.visible).toBe(true);
    });

    it('labels a League Room opponent as synced and leaves editing to the room', () => {
      mockTeam = makeTeam({ opponentName: 'Rivals', opponent: OPPONENT, opponentSource: 'room', roomId: 'room-1' });
      const card = oneByTestId(renderScreen(), 'matchup-card');
      expect(textOf(oneByTestId(card, 'matchup-title'))).toBe('vs Rivals · synced from League Room');
      expect(byTestId(card, 'matchup-edit')).toHaveLength(0);
    });

    it('waits for a League Room opponent with no players instead of offering to type them in', () => {
      mockTeam = makeTeam({ opponentName: 'Rivals', opponent: [], opponentSource: 'room', roomId: 'room-1' });
      const root = renderScreen();
      expect(allText(oneByTestId(root, 'matchup-room-waiting'))).toContain('Rivals hasn’t added players in your League Room yet');
      expect(byTestId(root, 'matchup-add')).toHaveLength(0);
    });
  });

  describe('schedule grid', () => {
    it('lists linked, active players by games, then name', () => {
      const ids = rowIds(renderScreen());
      expect(ids).toEqual([MATTHEWS, MCDAVID, DRAISAITL, MAKAR, SHESTERKIN]);
      expect(ids).not.toContain(ON_IR);
    });

    it('opens the player sheet from a row', () => {
      press(oneByTestId(renderScreen(), `week-row-${MCDAVID}`));
      expect(mockOpenPlayer).toHaveBeenCalledWith(MCDAVID, 'roster');
    });

    it('drops the now line for next week', () => {
      mockIsPremium = true;
      const root = renderScreen();
      expect(byTestId(root, 'week-now-line').length).toBeGreaterThan(0);
      press(oneByTestId(root, 'week-toggle-next'));
      expect(lastOffset()).toBe(1);
      expect(byTestId(root, 'week-now-line')).toHaveLength(0);
    });

    it('uses full names and home/away labels on iPad', () => {
      mockWindow.width = 1032;
      const root = renderScreen();
      expect(allText(oneByTestId(root, `week-row-${MCDAVID}`))).toContain('Connor McDavid');
      expect(allText(oneByTestId(root, `week-cell-${MCDAVID}-2026-10-12`))).toBe('@ TOR');
    });
  });

  it('shares the games left as a card', () => {
    const root = renderScreen();
    const sheet = () => root.findAll((node: Node) => node.type === 'ShareCardSheet')[0];
    expect(sheet().props.visible).toBe(false);
    press(oneByTestId(root, 'week-share'));
    expect(sheet().props.visible).toBe(true);
    const content = sheet().props.content;
    expect(content).toMatchObject({ kind: 'week', count: 8, caption: 'games left this week', teamName: 'Beauties' });
    expect(content.kicker).toBe('OCT 12 – OCT 18');
    expect(content.players.map((row: { playerId: number; detail: string }) => [row.playerId, row.detail])).toEqual([
      [MATTHEWS, '2 left'],
      [MAKAR, '2 left'],
      [SHESTERKIN, '2 left'],
      [MCDAVID, '1 left'],
      [DRAISAITL, '1 left'],
    ]);
  });
});
