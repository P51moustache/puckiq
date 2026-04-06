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
    Platform: { OS: 'ios', select: (opts: any) => opts.ios },
  };
});

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
    Layout: {},
  };
});

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import DashboardContainer from '../DashboardContainer';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('DashboardContainer', () => {
  beforeEach(() => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
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
