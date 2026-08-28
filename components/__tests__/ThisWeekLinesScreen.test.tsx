jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
    TouchableOpacity: ({ children, ...props }: any) => React.createElement('TouchableOpacity', props, children),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    TextInput: (props: any) => React.createElement('TextInput', props),
    FlatList: (props: any) => React.createElement('FlatList', props),
    Alert: { alert: jest.fn() },
    Modal: ({ children, visible, ...props }: any) =>
      visible ? React.createElement('Modal', props, children) : null,
    StyleSheet: { create: (s: any) => s, absoluteFillObject: {}, hairlineWidth: 0.5 },
    Platform: { OS: 'ios', select: (opts: any) => opts.ios },
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return { Ionicons: (props: any) => React.createElement('Ionicons', props) };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../SubscriptionProvider', () => ({
  useSubscription: () => ({ isPremium: false, loading: false, refresh: jest.fn() }),
}));

const mockAssign = jest.fn();
const mockAddName = jest.fn();
const mockAddNhlPlayer = jest.fn();
const mockCopyLastWeek = jest.fn();
const mockBeginPair = jest.fn();
const mockOnRefresh = jest.fn();
const mockUseWeeklyLines = jest.fn();

jest.mock('../../hooks/useWeeklyLines', () => {
  const actual = jest.requireActual('../../hooks/useWeeklyLines');
  return {
    ...actual,
    useWeeklyLines: () => mockUseWeeklyLines(),
  };
});

jest.mock('../../services/nhlPlayerSearch', () => ({
  searchNhlPlayers: jest.fn().mockResolvedValue([]),
  suggestedLineGroup: (position: string) => {
    const code = (position || '').toUpperCase();
    if (code === 'G') return 'G';
    if (code === 'D') return 'D';
    return 'F';
  },
}));

jest.mock('../../services/fantasyRoster', () => ({
  loadRoster: jest.fn(),
  saveRoster: jest.fn(),
  updateRoster: jest.fn(),
}));

// @ts-expect-error no types for react-test-renderer
import { create, act } from 'react-test-renderer';
import React from 'react';
import { Alert } from 'react-native';
import ThisWeekLinesScreen from '../ThisWeekLinesScreen';
import type { FantasyRoster } from '../../types/fantasy';

function render() {
  let tree: any;
  act(() => {
    tree = create(<ThisWeekLinesScreen />);
  });
  return tree;
}

function findByTestId(root: any, testID: string): any[] {
  return root.root.findAll(
    (node: any) => node.props.testID === testID && typeof node.type === 'string',
  );
}

function getAllText(root: any): string[] {
  const texts: string[] = [];
  root.root.findAll((node: any) => {
    if (node.type === 'Text' && typeof node.props.children === 'string') {
      texts.push(node.props.children);
    }
    return false;
  });
  return texts;
}

const roster: FantasyRoster = {
  id: '1',
  name: 'My Team',
  scoringFormat: 'yahoo',
  players: [
    { playerId: 100, playerName: 'Alex Forward', teamAbbrev: '', position: 'F', rosterPosition: 'BN' },
    { playerId: 200, playerName: 'Sam Defense', teamAbbrev: '', position: 'D', rosterPosition: 'BN' },
    { playerId: 300, playerName: 'Pat Goalie', teamAbbrev: '', position: 'G', rosterPosition: 'BN' },
  ],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

function linesState(overrides: Record<string, unknown> = {}) {
  const groups: Record<number, 'F' | 'D' | 'G' | 'bench'> = {
    100: 'F',
    200: 'D',
    300: 'bench',
  };
  return {
    isLoading: false,
    roster,
    hasRoster: true,
    store: {
      current: { weekId: '2026-W34', label: 'Aug 17–23, 2026', assignments: [] },
      previous: null,
      doNotPairs: [],
    },
    weekLabel: 'Aug 17–23, 2026',
    canCopyLastWeek: false,
    error: null,
    statuses: {},
    headline: null,
    week: null,
    slateDate: null,
    brokenPairs: [],
    pairingFrom: null,
    groupOf: (playerId: number) => groups[playerId] ?? 'bench',
    assign: mockAssign,
    addName: mockAddName,
    addNhlPlayer: mockAddNhlPlayer,
    copyLastWeek: mockCopyLastWeek,
    beginPair: mockBeginPair,
    onRefresh: mockOnRefresh,
    ...overrides,
  };
}

describe('ThisWeekLinesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWeeklyLines.mockReturnValue(linesState());
  });

  it('shows a loading spinner', () => {
    mockUseWeeklyLines.mockReturnValue(linesState({ isLoading: true, hasRoster: false, roster: null }));
    const tree = render();
    expect(findByTestId(tree, 'lines-loading')).toHaveLength(1);
  });

  it('prompts a coach to add the one roster when it is empty', () => {
    mockUseWeeklyLines.mockReturnValue(linesState({
      hasRoster: false,
      roster: null,
    }));
    const tree = render();
    expect(findByTestId(tree, 'lines-empty')).toHaveLength(1);
    expect(getAllText(tree)).toContain('Add your roster');
    expect(findByTestId(tree, 'lines-nhl-search')).toHaveLength(1);
    expect(findByTestId(tree, 'lines-first-add-name')).toHaveLength(1);
  });

  it('blocks an OUT player from starting', () => {
    mockUseWeeklyLines.mockReturnValue(linesState({
      statuses: {
        100: {
          playerId: 100,
          playerName: 'Alex Forward',
          teamAbbrev: 'EDM',
          position: 'C',
          opponentAbbrev: 'VGK',
          isHome: true,
          gameId: 1,
          startTimeUTC: '2026-08-27T02:00:00Z',
          gameState: 'FUT',
          injurySignal: 'out',
          injuryNote: 'Injured',
          confidence: 'likely',
          recommendation: 'SIT',
          reason: 'Out / IR — do not start',
        },
      },
    }));
    const tree = render();
    expect(getAllText(tree)).toContain('OUT — cannot start');
    const chip = findByTestId(tree, 'lines-assign-100-F')[0];
    expect(chip.props.disabled).toBe(true);
  });

  it('lists this week’s F / D / G / bench groups', () => {
    const tree = render();
    expect(findByTestId(tree, 'this-week-lines-screen')).toHaveLength(1);
    expect(findByTestId(tree, 'lines-group-F')).toHaveLength(1);
    expect(findByTestId(tree, 'lines-group-D')).toHaveLength(1);
    expect(findByTestId(tree, 'lines-group-G')).toHaveLength(1);
    expect(findByTestId(tree, 'lines-group-bench')).toHaveLength(1);
    const texts = getAllText(tree);
    expect(texts).toContain('Alex Forward');
    expect(texts).toContain('Sam Defense');
    expect(texts).toContain('Pat Goalie');
    expect(texts).toContain("This week's lines");
  });

  it('taps a player into a new group', () => {
    const tree = render();
    const chip = findByTestId(tree, 'lines-assign-300-G')[0];
    act(() => {
      chip.props.onPress();
    });
    expect(mockAssign).toHaveBeenCalledWith(300, 'G');
  });

  it('disables copy last week until a previous snapshot exists', () => {
    const tree = render();
    const button = findByTestId(tree, 'copy-last-week')[0];
    expect(button.props.disabled).toBe(true);
    expect(getAllText(tree).some((t) => t.includes('After this week'))).toBe(true);
  });

  it('copies last week after confirm', () => {
    mockUseWeeklyLines.mockReturnValue(linesState({ canCopyLastWeek: true }));
    const tree = render();
    const button = findByTestId(tree, 'copy-last-week')[0];
    expect(button.props.disabled).toBe(false);
    act(() => {
      button.props.onPress();
    });
    expect(Alert.alert).toHaveBeenCalled();
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const confirm = buttons.find((item: { text: string }) => item.text === 'Copy');
    act(() => {
      confirm.onPress();
    });
    expect(mockCopyLastWeek).toHaveBeenCalled();
  });

  it('shows the NHL headline, week strip, and start/sit from existing APIs', () => {
    mockUseWeeklyLines.mockReturnValue(linesState({
      headline: {
        playing: 1,
        problems: 0,
        moves: 0,
        primaryMove: null,
        text: '1 of YOUR guys play tonight. 0 problems. 0 moves.',
      },
      week: {
        startDate: '2026-08-24',
        days: [
          { date: '2026-08-24', dayAbbrev: 'MON', playerCount: 1, games: [] },
          { date: '2026-08-25', dayAbbrev: 'TUE', playerCount: 0, games: [] },
        ],
      },
      slateDate: '2026-08-24',
      statuses: {
        100: {
          playerId: 100,
          playerName: 'Alex Forward',
          teamAbbrev: 'EDM',
          position: 'C',
          opponentAbbrev: 'VGK',
          isHome: true,
          gameId: 1,
          startTimeUTC: '2026-10-08T02:00:00Z',
          gameState: 'FUT',
          injurySignal: 'ok',
          injuryNote: null,
          confidence: 'unknown',
          recommendation: 'START',
          reason: 'Has a game tonight',
        },
      },
    }));
    const tree = render();
    expect(findByTestId(tree, 'lines-headline')).toHaveLength(1);
    expect(findByTestId(tree, 'my-week-strip')).toHaveLength(1);
    expect(getAllText(tree)).toContain('1 of YOUR guys play tonight. 0 problems. 0 moves.');
    expect(getAllText(tree)).toContain('START');
    expect(getAllText(tree).some((t) => t.includes('Unknown'))).toBe(true);
  });

  it('does not surface pick-edge or extra-team chrome', () => {
    const tree = render();
    const texts = getAllText(tree).join(' ');
    expect(texts).not.toMatch(/Lock of the Day/i);
    expect(texts).not.toMatch(/Yahoo|ESPN|PP\/PK|fantasy/i);
  });
});
