jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
    RefreshControl: (props: any) => React.createElement('RefreshControl', props),
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

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const mockUseTonightRoster = jest.fn();
jest.mock('../../hooks/useTonightRoster', () => ({
  useTonightRoster: () => mockUseTonightRoster(),
}));

jest.mock('../../services/nhlPlayerSearch', () => ({
  searchNhlPlayers: jest.fn().mockResolvedValue([]),
}));

// @ts-expect-error no types for react-test-renderer
import { create, act } from 'react-test-renderer';
import React from 'react';
import TonightRosterScreen from '../TonightRosterScreen';
import type { TonightPlayerStatus } from '../../types/fantasy';

function render() {
  let tree: any;
  act(() => { tree = create(<TonightRosterScreen />); });
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

const playing: TonightPlayerStatus = {
  playerId: 8478402,
  playerName: 'Connor McDavid',
  teamAbbrev: 'EDM',
  position: 'C',
  opponentAbbrev: 'CGY',
  isHome: true,
  gameId: 1,
  startTimeUTC: '2026-09-29T23:00:00Z',
  gameState: 'FUT',
  injurySignal: 'ok',
  injuryNote: null,
  recommendation: 'START',
  reason: "In tonight's lineup",
};

const off: TonightPlayerStatus = {
  ...playing,
  playerId: 2,
  playerName: 'Auston Matthews',
  teamAbbrev: 'TOR',
  opponentAbbrev: null,
  isHome: null,
  gameId: null,
  recommendation: 'SIT',
  reason: 'No game tonight',
};

describe('TonightRosterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading', () => {
    mockUseTonightRoster.mockReturnValue({
      isLoading: true,
      hasRoster: false,
      roster: null,
      date: null,
      statuses: [],
      news: [],
      error: null,
      onRefresh: jest.fn(),
    });
    const tree = render();
    expect(findByTestId(tree, 'tonight-loading')).toHaveLength(1);
  });

  it('prompts to add a roster when empty', () => {
    mockUseTonightRoster.mockReturnValue({
      isLoading: false,
      hasRoster: false,
      roster: null,
      date: '2026-08-22',
      statuses: [],
      news: [],
      error: null,
      onRefresh: jest.fn(),
    });
    const tree = render();
    expect(findByTestId(tree, 'tonight-empty')).toHaveLength(1);
    expect(findByTestId(tree, 'tonight-add-roster')).toHaveLength(1);
  });

  it('renders only roster players with opponent and lean', () => {
    mockUseTonightRoster.mockReturnValue({
      isLoading: false,
      hasRoster: true,
      roster: { players: [{ playerId: 1 }] },
      date: '2026-08-22',
      nextDate: '2026-09-19',
      statuses: [playing, off],
      news: [],
      error: null,
      onRefresh: jest.fn(),
    });
    const tree = render();
    const texts = getAllText(tree);
    expect(findByTestId(tree, 'tonight-roster')).toHaveLength(1);
    expect(texts).toContain('Connor McDavid');
    expect(texts).toContain('Auston Matthews');
    expect(texts).toContain('START');
    expect(texts).toContain('SIT');
    expect(texts.some((t) => t.includes('play tonight'))).toBe(true);
  });
});
