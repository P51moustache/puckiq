jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
    FlatList: ({ data, renderItem, keyExtractor, ListHeaderComponent, ...props }: any) => {
      const header = ListHeaderComponent
        ? typeof ListHeaderComponent === 'function'
          ? React.createElement(ListHeaderComponent)
          : ListHeaderComponent
        : null;
      const items = (data || []).map((item: any, index: number) =>
        React.createElement(React.Fragment, { key: keyExtractor ? keyExtractor(item, index) : index }, renderItem({ item, index }))
      );
      return React.createElement('FlatList', props, header, ...items);
    },
    Switch: (props: any) => React.createElement('Switch', props),
    Modal: ({ children, visible, ...props }: any) =>
      visible ? React.createElement('Modal', props, children) : null,
    TouchableOpacity: ({ children, ...props }: any) =>
      React.createElement('TouchableOpacity', props, children),
    Pressable: ({ children, ...props }: any) =>
      React.createElement('Pressable', props, typeof children === 'function' ? children({ pressed: false }) : children),
    StyleSheet: {
      create: (s: any) => s,
      flatten: (style: any) => {
        if (Array.isArray(style)) {
          return Object.assign({}, ...style.filter(Boolean));
        }
        return style || {};
      },
    },
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    Platform: { OS: 'ios', select: (opts: any) => opts.ios },
  };
});

const mockDashData = {
  startSitPlayers: [
    { id: 1, name: 'C. McDavid', team: 'EDM', opponent: 'CGY', projectedPoints: 8.2, recommendation: 'START' },
  ],
  trendingPlayers: [
    { id: 2, name: 'K. Kaprizov', team: 'MIN', flameCount: 5, recentPoints: [3, 5, 3, 7, 4, 6, 4, 5, 5, 7], trend: 'up' },
  ],
  alerts: [
    { id: 'a1', type: 'goalie', playerName: 'Test Alert', team: 'EDM', message: 'Goalie confirmed', timestamp: '2026-04-05T00:00:00Z', isRosterPlayer: false },
  ],
  waiverPlayers: [
    { id: 3, name: 'M. Boldy', team: 'MIN', position: 'LW', valueScore: 4.8, ownershipPct: 42, projectedPoints: 5.9 },
  ],
  matchups: [
    { id: 4, playerName: 'L. Draisaitl', team: 'EDM', opponent: 'CGY', edgeRating: 9, projectedPoints: 7.8, reasons: ['Battle of Alberta'] },
  ],
  dailyInsight: { headline: 'Home teams winning 58%', context: 'Lean toward home players', sentiment: 'bullish' },
  isLoading: false,
  isOffDay: false,
  refresh: jest.fn(),
};

jest.mock('../../../hooks/useDashboardData', () => ({
  useDashboardData: () => mockDashData,
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: (props: any) => React.createElement('Ionicons', props),
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const View = ({ children, ...props }: any) => React.createElement('View', props, children);
  return {
    __esModule: true,
    default: {
      View,
      Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
      createAnimatedComponent: (comp: any) => comp,
    },
    FadeInUp: { delay: () => ({ duration: () => ({}) }) },
    FadeIn: { delay: () => ({ duration: () => ({}) }) },
    FadeInDown: { delay: () => ({ duration: () => ({}) }) },
    useAnimatedStyle: (fn: any) => fn(),
    useSharedValue: (val: any) => ({ value: val }),
    withTiming: (val: any) => val,
    withSpring: (val: any) => val,
    withDelay: (_: any, val: any) => val,
    withRepeat: (val: any) => val,
    withSequence: (...vals: any[]) => vals[0],
    Layout: {},
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

// Mock child module components to isolate DashboardContainer tests
jest.mock('../StartSitModule', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('View', {}, React.createElement('Text', {}, 'Start / Sit')),
  };
});

jest.mock('../TrendingModule', () => {
  const React = require('react');
  return {
    TrendingModule: () => React.createElement('View', {}, React.createElement('Text', {}, 'Trending Now')),
  };
});

jest.mock('../AlertsModule', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('View', {}, React.createElement('Text', {}, 'Alerts')),
  };
});

jest.mock('../WaiverWireModule', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('View', {}, React.createElement('Text', {}, 'Waiver Wire')),
  };
});

jest.mock('../MatchupEdgeModule', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('View', {}, React.createElement('Text', {}, 'Matchup Edge')),
  };
});

jest.mock('../DailyInsightModule', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('View', {}, React.createElement('Text', {}, 'Daily Insight')),
  };
});

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import DashboardContainer from '../DashboardContainer';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_PREFS = JSON.stringify({
  modules: [
    { id: 'startSit', enabled: true, order: 0 },
    { id: 'trending', enabled: true, order: 1 },
    { id: 'alerts', enabled: true, order: 2 },
    { id: 'waiverWire', enabled: true, order: 3 },
    { id: 'matchupEdge', enabled: true, order: 4 },
    { id: 'dailyInsight', enabled: true, order: 5 },
  ],
  lastCustomized: '2026-04-05',
});

describe('DashboardContainer', () => {
  beforeEach(() => {
    // Simulate existing user (not first launch) so ModulePicker doesn't show
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(SAVED_PREFS);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('renders all default modules', async () => {
    const { getByText } = render(<DashboardContainer />);
    await waitFor(() => {
      expect(getByText('Start / Sit')).toBeTruthy();
      expect(getByText('Trending Now')).toBeTruthy();
      expect(getByText('Alerts')).toBeTruthy();
      expect(getByText('Waiver Wire')).toBeTruthy();
      expect(getByText('Matchup Edge')).toBeTruthy();
      expect(getByText('Daily Insight')).toBeTruthy();
    });
  });

  it('shows edit mode when gear tapped', async () => {
    const { getByTestId, getByText } = render(<DashboardContainer />);
    await waitFor(() => getByText('Start / Sit'));
    fireEvent.press(getByTestId('edit-mode-button'));
    await waitFor(() => {
      expect(getByTestId('edit-mode-container')).toBeTruthy();
    });
  });

  it('toggles a module off in edit mode', async () => {
    const { getByTestId, getByText, queryByTestId } = render(<DashboardContainer />);
    await waitFor(() => getByText('Start / Sit'));

    // Enter edit mode
    fireEvent.press(getByTestId('edit-mode-button'));
    await waitFor(() => getByTestId('edit-mode-container'));

    // Toggle alerts off
    fireEvent(getByTestId('toggle-alerts'), 'onValueChange', false);

    // Exit edit mode
    fireEvent.press(getByTestId('edit-mode-button'));

    // Alerts card should not be visible
    await waitFor(() => {
      expect(queryByTestId('module-card-alerts')).toBeNull();
    });
  });

  it('renders the Command Center header', async () => {
    const { getByText } = render(<DashboardContainer />);
    await waitFor(() => {
      expect(getByText('Command Center')).toBeTruthy();
    });
  });
});
