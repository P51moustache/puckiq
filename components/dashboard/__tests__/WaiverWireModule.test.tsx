jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    Pressable: ({ children, onPress, onPressIn, onPressOut, ...props }: any) =>
      React.createElement('Pressable', { ...props, onPress, onPressIn, onPressOut }, children),
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

// Chainable animation builder mock
const makeAnimBuilder = () => {
  const builder: any = {};
  for (const m of ['delay', 'duration', 'springify', 'damping', 'stiffness', 'mass', 'withCallback', 'withInitialValues']) {
    builder[m] = () => builder;
  }
  return builder;
};

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
    FadeInUp: makeAnimBuilder(),
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
import WaiverWireModule from '../WaiverWireModule';

const mockPlayers = [
  {
    id: 1,
    name: 'Kirill Kaprizov',
    team: 'MIN',
    position: 'LW',
    valueScore: 4.2,
    ownershipPct: 12,
    projectedPoints: 8.5,
    currentPlayerName: 'Timo Meier',
    currentPlayerPoints: 4.3,
  },
  {
    id: 2,
    name: 'Tim Stutzle',
    team: 'OTT',
    position: 'C',
    valueScore: 3.1,
    ownershipPct: 8,
    projectedPoints: 7.2,
    currentPlayerName: 'Nico Hischier',
    currentPlayerPoints: 4.1,
  },
  {
    id: 3,
    name: 'Martin Necas',
    team: 'CAR',
    position: 'RW',
    valueScore: 2.5,
    ownershipPct: 15,
    projectedPoints: 6.8,
  },
  {
    id: 4,
    name: 'Extra Player',
    team: 'BOS',
    position: 'C',
    valueScore: 1.0,
    ownershipPct: 5,
    projectedPoints: 4.0,
  },
];

describe('WaiverWireModule', () => {
  it('renders top 3 waiver pickups with value scores', () => {
    const { getByText, queryByText } = render(<WaiverWireModule players={mockPlayers} />);
    expect(getByText('Kirill Kaprizov')).toBeTruthy();
    expect(getByText('Tim Stutzle')).toBeTruthy();
    expect(getByText('Martin Necas')).toBeTruthy();
    // 4th player should not render
    expect(queryByText('Extra Player')).toBeNull();
    // Value scores rendered with + prefix
    expect(getByText('+4.2')).toBeTruthy();
    expect(getByText('+3.1')).toBeTruthy();
    expect(getByText('+2.5')).toBeTruthy();
  });

  it('shows ownership percentage', () => {
    const { getByText } = render(<WaiverWireModule players={mockPlayers} />);
    expect(getByText('12% owned')).toBeTruthy();
    expect(getByText('8% owned')).toBeTruthy();
    expect(getByText('15% owned')).toBeTruthy();
  });

  it('expands inline comparison on Compare tap', () => {
    const { getAllByText, getByText, queryByText } = render(
      <WaiverWireModule players={mockPlayers} />
    );
    // Comparison not visible initially
    expect(queryByText('Timo Meier')).toBeNull();
    // Tap Compare on first player
    const compareButtons = getAllByText('Compare');
    fireEvent.press(compareButtons[0]);
    // Now comparison should be visible
    expect(getByText('Timo Meier')).toBeTruthy();
    expect(getByText('4.3')).toBeTruthy();
    expect(getByText('8.5')).toBeTruthy();
  });

  it('shows checkmark on Add tap', () => {
    const { getAllByTestId } = render(<WaiverWireModule players={mockPlayers} />);
    const addButtons = getAllByTestId(/add-btn-/);
    fireEvent.press(addButtons[0]);
    // After tap, checkmark icon should appear
    const addedIcons = getAllByTestId(/added-icon-/);
    expect(addedIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders empty state when no players', () => {
    const { getByText } = render(<WaiverWireModule players={[]} />);
    expect(getByText('No waiver picks available')).toBeTruthy();
  });

  it('renders module header with title', () => {
    const { getByText } = render(<WaiverWireModule players={mockPlayers} />);
    expect(getByText('Waiver Wire')).toBeTruthy();
  });

  it('renders rank badges', () => {
    const { getByText } = render(<WaiverWireModule players={mockPlayers} />);
    expect(getByText('1')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('shows position and team info', () => {
    const { getByText } = render(<WaiverWireModule players={mockPlayers} />);
    expect(getByText('MIN · LW')).toBeTruthy();
    expect(getByText('OTT · C')).toBeTruthy();
    expect(getByText('CAR · RW')).toBeTruthy();
  });
});
