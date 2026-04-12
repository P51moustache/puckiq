/**
 * Tests for MyTeamScreen
 * Verifies empty state (no roster) vs roster state rendering.
 */

jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
    RefreshControl: (props: any) => require('react').createElement('RefreshControl', props),
    TouchableOpacity: ({ children, ...props }: any) => React.createElement('TouchableOpacity', props, children),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    TextInput: (props: any) => React.createElement('TextInput', props),
    FlatList: (props: any) => React.createElement('FlatList', props),
    Modal: ({ children, visible, ...props }: any) =>
      visible ? React.createElement('Modal', props, children) : null,
    StyleSheet: { create: (s: any) => s, absoluteFillObject: {}, hairlineWidth: 0.5 },
    Platform: { OS: 'ios', select: (opts: any) => opts.ios },
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: (props: any) => React.createElement('Ionicons', props),
  };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement('LinearGradient', props, children),
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const View = ({ children, ...props }: any) => React.createElement('View', props, children);
  const animatedStyle = {};
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: any) => c },
    FadeIn: { duration: () => ({ delay: () => ({}) }) },
    FadeInDown: { delay: () => ({ duration: () => ({ springify: () => ({}) }) }) },
    useSharedValue: (val: any) => ({ value: val }),
    useAnimatedStyle: (fn: any) => animatedStyle,
    withRepeat: (val: any) => val,
    withTiming: (val: any) => val,
    withSequence: (...vals: any[]) => vals[0],
    Easing: { inOut: (e: any) => e, ease: {} },
  };
});

jest.mock('../SubscriptionProvider', () => ({
  useSubscription: () => ({
    isPremium: true,
    loading: false,
    refresh: jest.fn(),
  }),
}));

const mockUseMyTeamData = jest.fn();
jest.mock('../../hooks/useMyTeamData', () => ({
  useMyTeamData: () => mockUseMyTeamData(),
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
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
import MyTeamScreen from '../MyTeamScreen';
import type { FantasyRoster, PlayerProjection } from '../../types/fantasy';

function render() {
  let tree: any;
  act(() => { tree = create(<MyTeamScreen />); });
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

function noRosterState() {
  return {
    isLoading: false,
    roster: null,
    projections: [],
    waiverPicks: [],
    hasRoster: false,
    onRefresh: jest.fn(),
  };
}

const mockRoster: FantasyRoster = {
  id: '1',
  name: 'My Team',
  scoringFormat: 'yahoo',
  players: [
    { playerId: 100, playerName: 'Connor McDavid', teamAbbrev: 'EDM', position: 'C', rosterPosition: 'C' },
    { playerId: 200, playerName: 'Nathan MacKinnon', teamAbbrev: 'COL', position: 'C', rosterPosition: 'C' },
  ],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const mockProjections: PlayerProjection[] = [
  {
    playerId: 100, playerName: 'Connor McDavid', teamAbbrev: 'EDM', position: 'C',
    fantasyPoints: 8.5, floor: 4.0, ceiling: 14.0,
    predGoals: 0.6, predAssists: 1.2, predSog: 4.1, predHits: 0.8, predBlocks: 0.3,
    recommendation: 'START', confidence: 'high', reason: 'trending hot, soft matchup',
    gameId: 999, opponentAbbrev: 'VGK', isHome: true,
  },
];

const mockWaiverPicks: PlayerProjection[] = [
  {
    playerId: 300, playerName: 'Waiver Pickup', teamAbbrev: 'NYR', position: 'LW',
    fantasyPoints: 6.2, floor: 2.0, ceiling: 10.0,
    predGoals: 0.4, predAssists: 0.8, predSog: 3.0, predHits: 1.5, predBlocks: 0.5,
    recommendation: 'UPSIDE', confidence: 'medium', reason: 'hot streak',
    gameId: 888, opponentAbbrev: 'BOS', isHome: false,
  },
];

describe('MyTeamScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMyTeamData.mockReturnValue(noRosterState());
  });

  describe('Loading state', () => {
    it('shows loading indicator when isLoading is true', () => {
      mockUseMyTeamData.mockReturnValue({ ...noRosterState(), isLoading: true });
      const tree = render();
      expect(findByTestId(tree, 'my-team-loading')).toHaveLength(1);
    });
  });

  describe('Empty state (no roster)', () => {
    it('shows empty state when no roster exists', () => {
      const tree = render();
      expect(findByTestId(tree, 'my-team-empty')).toHaveLength(1);
      const texts = getAllText(tree);
      expect(texts).toContain('Build Your Roster');
      expect(texts.some(t => t.includes('personalized start/sit'))).toBe(true);
    });

    it('shows setup CTA button', () => {
      const tree = render();
      expect(findByTestId(tree, 'setup-roster-button')).toHaveLength(1);
      expect(getAllText(tree)).toContain('Add Players');
    });

    it('does not show roster view', () => {
      const tree = render();
      expect(findByTestId(tree, 'my-team-roster')).toHaveLength(0);
    });
  });

  describe('Roster state', () => {
    beforeEach(() => {
      mockUseMyTeamData.mockReturnValue({
        isLoading: false,
        roster: mockRoster,
        projections: mockProjections,
        waiverPicks: [],
        hasRoster: true,
        onRefresh: jest.fn(),
      });
    });

    it('shows roster view when roster exists', () => {
      const tree = render();
      expect(findByTestId(tree, 'my-team-empty')).toHaveLength(0);
      expect(findByTestId(tree, 'my-team-roster')).toHaveLength(1);
    });

    it('displays scoring format badge', () => {
      const tree = render();
      expect(getAllText(tree)).toContain('Yahoo');
    });

    it('shows edit roster button', () => {
      const tree = render();
      expect(findByTestId(tree, 'edit-roster-button')).toHaveLength(1);
    });

    it('renders StartSitCard for projected players', () => {
      const tree = render();
      const cards = findByTestId(tree, 'start-sit-card');
      expect(cards.length).toBeGreaterThanOrEqual(1);
    });

    it('renders WeeklyOutlook', () => {
      const tree = render();
      expect(findByTestId(tree, 'weekly-outlook')).toHaveLength(1);
    });

    it('shows no projections message when no games', () => {
      mockUseMyTeamData.mockReturnValue({
        isLoading: false,
        roster: mockRoster,
        projections: [],
        waiverPicks: [],
        hasRoster: true,
        onRefresh: jest.fn(),
      });

      const tree = render();
      expect(findByTestId(tree, 'my-team-roster')).toHaveLength(1);
      const texts = getAllText(tree);
      expect(texts.some(t => t.includes('No projections available'))).toBe(true);
    });
  });

  describe('Waiver wire', () => {
    it('renders WaiverWireSection when picks exist', () => {
      mockUseMyTeamData.mockReturnValue({
        isLoading: false,
        roster: mockRoster,
        projections: [],
        waiverPicks: mockWaiverPicks,
        hasRoster: true,
        onRefresh: jest.fn(),
      });

      const tree = render();
      expect(findByTestId(tree, 'waiver-wire-section')).toHaveLength(1);
    });

    it('does not render WaiverWireSection when no picks', () => {
      mockUseMyTeamData.mockReturnValue({
        isLoading: false,
        roster: mockRoster,
        projections: [],
        waiverPicks: [],
        hasRoster: true,
        onRefresh: jest.fn(),
      });

      const tree = render();
      expect(findByTestId(tree, 'waiver-wire-section')).toHaveLength(0);
    });
  });
});
