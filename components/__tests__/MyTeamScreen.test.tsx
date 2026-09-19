/**
 * Tests for MyTeamScreen
 * Verifies empty state (no roster) vs roster state rendering.
 */

import { create, act } from 'react-test-renderer';
import React from 'react';
import MyTeamScreen from '../MyTeamScreen';
import RosterBuilder from '../RosterBuilder';
import type { FantasyRoster, PlayerProjection } from '../../types/fantasy';

jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
    KeyboardAvoidingView: ({ children, ...props }: any) => React.createElement('KeyboardAvoidingView', props, children),
    RefreshControl: (props: any) => require('react').createElement('RefreshControl', props),
    TouchableOpacity: ({ children, ...props }: any) => React.createElement('TouchableOpacity', props, children),
    Pressable: ({ children, ...props }: any) => React.createElement('Pressable', props, typeof children === 'function' ? children({ pressed: false }) : children),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    TextInput: (props: any) => React.createElement('TextInput', props),
    FlatList: (props: any) => React.createElement('FlatList', props),
    Modal: ({ children, visible, ...props }: any) =>
      visible ? React.createElement('Modal', props, children) : null,
    StyleSheet: { create: (s: any) => s, absoluteFillObject: {}, hairlineWidth: 0.5 },
    Platform: { OS: 'ios', select: (opts: any) => opts.ios },
    AccessibilityInfo: { isReduceMotionEnabled: jest.fn(async () => false), addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
    Alert: { alert: jest.fn() },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => require('react').createElement('SafeAreaView', props, children),
}));

jest.mock('../arena/ArenaProvider', () => ({
  useArena: () => ({ palette: { page: '#fff', paper: '#fff', soft: '#eee', edge: '#ddd', ink: '#111', muted: '#555', link: '#067', action: '#0cf', actionInk: '#111', frame: '#111' } }),
}));

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

jest.mock('../PremiumGate', () => ({ children }: any) => require('react').createElement('PremiumGate', null, children));

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
  clearRoster: jest.fn(),
}));

jest.mock('../../services/rosterPlayerSearch', () => ({ searchRosterPlayers: jest.fn(async () => []) }));

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

const mockForecastOnly: PlayerProjection = {
  ...mockProjections[0],
  recommendation: null,
  confidence: null,
  reason: null,
};

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
      expect(texts).toContain('BUILD YOUR ROSTER');
      expect(texts.some(t => t.includes('personalized start/sit'))).toBe(true);
      expect(texts).not.toContain('C. McDavid');
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

    it('keeps a numeric forecast neutral when recommendation metadata is unavailable', () => {
      mockUseMyTeamData.mockReturnValue({
        isLoading: false,
        roster: mockRoster,
        projections: [mockForecastOnly],
        waiverPicks: [],
        hasRoster: true,
        onRefresh: jest.fn(),
      });

      const tree = render();
      const texts = getAllText(tree);

      expect(texts).toContain('Forecast only / recommendation unavailable');
      expect(texts).not.toContain('SIT');
      expect(texts).not.toContain('No game today');
      expect(texts).toContain('8.5');
    });

    it('renders WeeklyOutlook', () => {
      const tree = render();
      expect(findByTestId(tree, 'weekly-outlook')).toHaveLength(1);
    });

    it('shows identity-only unavailable rows when all projections are missing', () => {
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
      expect(findByTestId(tree, 'my-team-unavailable-roster')).toHaveLength(1);
      expect(findByTestId(tree, 'unavailable-roster-player-100')).toHaveLength(1);
      const texts = getAllText(tree);
      expect(texts).toContain('Projection unavailable');
      expect(texts).not.toContain('SIT');
      expect(texts).not.toContain('No game today');
      expect(texts).not.toContain('0.0');
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

describe('RosterBuilder recovery', () => {
  const roster = (id: number, name: string): FantasyRoster => ({
    id: 'roster', name: 'My Team', scoringFormat: 'yahoo',
    players: [{ playerId: id, playerName: name, teamAbbrev: 'EDM', position: 'C', rosterPosition: 'C' }],
    createdAt: '2024-01-01', updatedAt: '2024-01-01',
  });

  it('reloads the latest saved roster each time the editor opens', async () => {
    let tree: any;
    await act(async () => { tree = create(<RosterBuilder visible onDismiss={jest.fn()} onSaved={jest.fn()} existingRoster={roster(1, 'First Player')} />); });
    expect(findByTestId(tree, 'chip-1')).toHaveLength(1);
    await act(async () => { tree.update(<RosterBuilder visible={false} onDismiss={jest.fn()} onSaved={jest.fn()} existingRoster={roster(2, 'Second Player')} />); });
    await act(async () => { tree.update(<RosterBuilder visible onDismiss={jest.fn()} onSaved={jest.fn()} existingRoster={roster(2, 'Second Player')} />); });
    expect(findByTestId(tree, 'chip-1')).toHaveLength(0);
    expect(findByTestId(tree, 'chip-2')).toHaveLength(1);
  });

  it('resets to an empty draft when opening a new roster after editing an existing one', async () => {
    let tree: any;
    await act(async () => { tree = create(<RosterBuilder visible onDismiss={jest.fn()} onSaved={jest.fn()} existingRoster={roster(1, 'First Player')} />); });
    await act(async () => { tree.update(<RosterBuilder visible={false} onDismiss={jest.fn()} onSaved={jest.fn()} existingRoster={null} />); });
    await act(async () => { tree.update(<RosterBuilder visible onDismiss={jest.fn()} onSaved={jest.fn()} existingRoster={null} />); });
    expect(findByTestId(tree, 'chip-1')).toHaveLength(0);
    expect(findByTestId(tree, 'roster-builder-save')[0].props.disabled).toBe(true);
  });

  it('asks before discarding a changed draft', async () => {
    const onDismiss = jest.fn();
    let tree: any;
    await act(async () => { tree = create(<RosterBuilder visible onDismiss={onDismiss} onSaved={jest.fn()} existingRoster={roster(1, 'First Player')} />); });
    await act(async () => { findByTestId(tree, 'chip-1')[0].props.onPress(); });
    findByTestId(tree, 'roster-builder-cancel')[0].props.onPress();
    expect(require('react-native').Alert.alert).toHaveBeenCalledWith('Discard roster changes?', expect.any(String), expect.any(Array));
    expect(onDismiss).not.toHaveBeenCalled();
    const buttons = require('react-native').Alert.alert.mock.calls.at(-1)[2];
    buttons[0].onPress?.();
    expect(onDismiss).not.toHaveBeenCalled();
    buttons[1].onPress();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('uses the same dirty guard for the modal request-close action', async () => {
    const onDismiss = jest.fn();
    let tree: any;
    await act(async () => { tree = create(<RosterBuilder visible onDismiss={onDismiss} onSaved={jest.fn()} existingRoster={roster(1, 'First Player')} />); });
    await act(async () => { findByTestId(tree, 'chip-1')[0].props.onPress(); });
    findByTestId(tree, 'roster-builder-modal')[0].props.onRequestClose();
    expect(require('react-native').Alert.alert).toHaveBeenCalledWith('Discard roster changes?', expect.any(String), expect.any(Array));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('keeps the draft and offers Retry after a failed save', async () => {
    require('../../services/fantasyRoster').updateRoster.mockRejectedValueOnce(new Error('disk full'));
    let tree: any;
    await act(async () => { tree = create(<RosterBuilder visible onDismiss={jest.fn()} onSaved={jest.fn()} existingRoster={roster(1, 'First Player')} />); });
    await act(async () => { await findByTestId(tree, 'roster-builder-save')[0].props.onPress(); });
    expect(findByTestId(tree, 'chip-1')).toHaveLength(1);
    expect(getAllText(tree)).toContain('Retry');
    expect(getAllText(tree)).toContain('Roster could not be saved. Your changes are still here.');
  });

  it('retries a failed delete as a delete operation', async () => {
    const rosterService = require('../../services/fantasyRoster');
    rosterService.updateRoster.mockClear();
    rosterService.clearRoster.mockReset();
    rosterService.clearRoster.mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(undefined);
    let tree: any;
    await act(async () => { tree = create(<RosterBuilder visible onDismiss={jest.fn()} onSaved={jest.fn()} existingRoster={roster(1, 'First Player')} />); });
    findByTestId(tree, 'delete-roster')[0].props.onPress();
    const confirmDelete = require('react-native').Alert.alert.mock.calls.at(-1)[2][1].onPress;
    await act(async () => { await confirmDelete(); });
    expect(getAllText(tree)).toContain('Roster could not be deleted. Your roster is unchanged.');
    await act(async () => { await findByTestId(tree, 'roster-builder-retry-delete')[0].props.onPress(); });
    expect(rosterService.clearRoster).toHaveBeenCalledTimes(2);
    expect(rosterService.updateRoster).not.toHaveBeenCalled();
  });

  it('disables duplicate results and all additions at the 20-player limit', async () => {
    const searchService = require('../../services/rosterPlayerSearch');
    searchService.searchRosterPlayers.mockResolvedValue([{ id: 1, firstName: 'First', lastName: 'Player', fullName: 'First Player', teamAbbrev: 'EDM', position: 'C' }]);
    let tree: any;
    await act(async () => { tree = create(<RosterBuilder visible onDismiss={jest.fn()} onSaved={jest.fn()} existingRoster={roster(1, 'First Player')} />); });
    await act(async () => { await findByTestId(tree, 'roster-search-input')[0].props.onChangeText('First'); });
    expect(findByTestId(tree, 'search-result-1')[0].props.disabled).toBe(true);

    const fullRoster: FantasyRoster = { ...roster(1, 'Player 1'), players: Array.from({ length: 20 }, (_, i) => ({ playerId: i + 1, playerName: `Player ${i + 1}`, teamAbbrev: 'EDM', position: 'C', rosterPosition: 'BN' as const })) };
    searchService.searchRosterPlayers.mockResolvedValue([{ id: 99, firstName: 'New', lastName: 'Player', fullName: 'New Player', teamAbbrev: 'EDM', position: 'C' }]);
    await act(async () => { tree.update(<RosterBuilder visible onDismiss={jest.fn()} onSaved={jest.fn()} existingRoster={fullRoster} />); });
    await act(async () => { await findByTestId(tree, 'roster-search-input')[0].props.onChangeText('New'); });
    expect(Array.from({ length: 20 }, (_, index) => findByTestId(tree, `chip-${index + 1}`)).every(nodes => nodes.length === 1)).toBe(true);
    expect(findByTestId(tree, 'search-result-99')[0].props.disabled).toBe(true);
  });

  it('ignores stale search results and keeps keyboard-safe scroll behavior', async () => {
    const searchService = require('../../services/rosterPlayerSearch');
    const pending: Record<string, (value: any[]) => void> = {};
    searchService.searchRosterPlayers.mockImplementation((value: string) => new Promise(resolve => { pending[value] = resolve; }));
    let tree: any;
    await act(async () => { tree = create(<RosterBuilder visible onDismiss={jest.fn()} onSaved={jest.fn()} existingRoster={roster(1, 'First Player')} />); });
    const input = findByTestId(tree, 'roster-search-input')[0];
    act(() => { input.props.onChangeText('Old'); input.props.onChangeText('New'); });
    await act(async () => { pending.New([{ id: 3, fullName: 'New Result', firstName: 'New', lastName: 'Result', teamAbbrev: 'EDM', position: 'C' }]); });
    await act(async () => { pending.Old([{ id: 2, fullName: 'Old Result', firstName: 'Old', lastName: 'Result', teamAbbrev: 'EDM', position: 'C' }]); });
    expect(findByTestId(tree, 'search-result-3')).toHaveLength(1);
    expect(findByTestId(tree, 'search-result-2')).toHaveLength(0);
    const scroll = findByTestId(tree, 'roster-builder-scroll')[0];
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scroll.props.keyboardDismissMode).toBe('interactive');
  });
});
