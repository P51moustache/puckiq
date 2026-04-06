jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
    Switch: (props: any) => React.createElement('Switch', props),
    TouchableOpacity: ({ children, ...props }: any) =>
      React.createElement('TouchableOpacity', props, children),
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
