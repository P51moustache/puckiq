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
const mockCopyLastWeek = jest.fn();
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
    },
    weekLabel: 'Aug 17–23, 2026',
    canCopyLastWeek: false,
    error: null,
    groupOf: (playerId: number) => groups[playerId] ?? 'bench',
    assign: mockAssign,
    addName: mockAddName,
    copyLastWeek: mockCopyLastWeek,
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

  it('prompts a coach to type the first name on Lines when the roster is empty', () => {
    mockUseWeeklyLines.mockReturnValue(linesState({
      hasRoster: false,
      roster: null,
    }));
    const tree = render();
    expect(findByTestId(tree, 'lines-empty')).toHaveLength(1);
    expect(getAllText(tree)).toContain('Add a name');
    expect(findByTestId(tree, 'lines-add-name-input')).toHaveLength(1);
    expect(findByTestId(tree, 'lines-add-name')).toHaveLength(1);
    expect(findByTestId(tree, 'lines-add-roster')).toHaveLength(0);
  });

  it('adds a typed name from the empty Lines board', async () => {
    mockAddName.mockResolvedValue(undefined);
    mockUseWeeklyLines.mockReturnValue(linesState({
      hasRoster: false,
      roster: null,
    }));
    const tree = render();
    const input = findByTestId(tree, 'lines-add-name-input')[0];
    act(() => {
      input.props.onChangeText('Jamie Forward');
    });
    const add = findByTestId(tree, 'lines-add-name')[0];
    await act(async () => {
      await add.props.onPress();
    });
    expect(mockAddName).toHaveBeenCalledWith('Jamie Forward');
  });

  it('keeps the name field on Lines after the first add so more names stay in-app', () => {
    const tree = render();
    expect(findByTestId(tree, 'lines-first-add')).toHaveLength(1);
    expect(findByTestId(tree, 'lines-add-name-input')).toHaveLength(1);
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

  it('does not surface pick-edge or extra-team chrome', () => {
    const tree = render();
    const texts = getAllText(tree).join(' ');
    expect(texts).not.toMatch(/Lock of the Day/i);
    expect(texts).not.toMatch(/Yahoo|ESPN|PP\/PK|fantasy/i);
  });
});
