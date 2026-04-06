jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
    TouchableOpacity: ({ children, onPress, ...props }: any) =>
      React.createElement('TouchableOpacity', { ...props, onPress }, children),
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

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: any) => React.createElement('View', props, children),
      Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
      createAnimatedComponent: (comp: any) => comp,
    },
    useAnimatedStyle: (fn: () => any) => fn(),
    useSharedValue: (val: any) => ({ value: val }),
    withTiming: (val: any) => val,
    FadeInUp: { delay: () => ({ duration: () => ({}) }) },
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: (props: any) => React.createElement('Ionicons', props),
  };
});

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import StartSitModule from '../StartSitModule';

const mockPlayers = [
  { id: 1, name: 'Connor McDavid', team: 'EDM', opponent: 'CGY', projectedPoints: 4.2, recommendation: 'START' as const },
  { id: 2, name: 'Leon Draisaitl', team: 'EDM', opponent: 'CGY', projectedPoints: 3.8, recommendation: 'SIT' as const },
];

describe('StartSitModule', () => {
  it('renders player cards with projected points', () => {
    const { getByText } = render(<StartSitModule players={mockPlayers} />);
    expect(getByText('Connor McDavid')).toBeTruthy();
    expect(getByText('4.2')).toBeTruthy();
  });

  it('shows START badge for recommended starters', () => {
    const { getAllByText } = render(<StartSitModule players={mockPlayers} />);
    expect(getAllByText('START').length).toBeGreaterThanOrEqual(1);
  });

  it('shows SIT badge for sit recommendations', () => {
    const { getAllByText } = render(<StartSitModule players={mockPlayers} />);
    expect(getAllByText('SIT').length).toBeGreaterThanOrEqual(1);
  });

  it('toggles START to SIT on tap', () => {
    const { getAllByTestId, getAllByText } = render(<StartSitModule players={mockPlayers} />);
    const toggles = getAllByTestId(/toggle-/);
    // McDavid starts as START
    expect(getAllByTestId('toggle-1')[0]).toBeTruthy();
    fireEvent.press(toggles[0]);
    // After pressing, McDavid should now show SIT
    // We verify by checking SIT count increased
    expect(getAllByText('SIT').length).toBe(2);
  });

  it('toggles SIT to START on tap', () => {
    const { getAllByTestId, getAllByText } = render(<StartSitModule players={mockPlayers} />);
    const toggles = getAllByTestId(/toggle-/);
    // Draisaitl starts as SIT — press to make START
    fireEvent.press(toggles[1]);
    expect(getAllByText('START').length).toBe(2);
  });

  it('renders empty state when no players', () => {
    const { getByText } = render(<StartSitModule players={[]} />);
    expect(getByText(/no players playing tonight/i)).toBeTruthy();
  });

  it('renders module header with title', () => {
    const { getByText } = render(<StartSitModule players={mockPlayers} />);
    expect(getByText('Start / Sit')).toBeTruthy();
  });

  it('displays opponent matchup info', () => {
    const { getAllByText } = render(<StartSitModule players={mockPlayers} />);
    expect(getAllByText('vs CGY').length).toBe(2);
  });

  it('displays team abbreviation', () => {
    const { getAllByText } = render(<StartSitModule players={mockPlayers} />);
    expect(getAllByText('EDM').length).toBe(2);
  });
});
