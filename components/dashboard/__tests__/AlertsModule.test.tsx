import React from 'react';
import { render } from '@testing-library/react-native';
import AlertsModule from '../AlertsModule';
import { FantasyAlert } from '../../../services/fantasyAlerts';

jest.mock('react-native', () => {
  const React = require('react');
  const mockAnimatedValue = (val: number) => ({
    _value: val,
    setValue: jest.fn(),
    interpolate: jest.fn(() => 0),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    stopAnimation: jest.fn(),
  });
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    StyleSheet: {
      create: (s: any) => s,
      flatten: (style: any) => {
        if (Array.isArray(style)) {
          return Object.assign({}, ...style.filter(Boolean));
        }
        return style || {};
      },
      absoluteFillObject: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      },
    },
    Platform: { OS: 'ios', select: (opts: any) => opts.ios },
    Animated: {
      View: ({ children, ...props }: any) => React.createElement('View', props, children),
      Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
      Value: function(val: number) { return mockAnimatedValue(val); },
      timing: jest.fn(() => ({ start: (cb?: () => void) => cb?.() })),
      spring: jest.fn(() => ({ start: (cb?: () => void) => cb?.() })),
      sequence: jest.fn(() => ({ start: (cb?: () => void) => cb?.() })),
      parallel: jest.fn(() => ({ start: (cb?: () => void) => cb?.() })),
    },
    PanResponder: {
      create: jest.fn(() => ({ panHandlers: {} })),
    },
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
    withSpring: (val: any) => val,
    withSequence: (val: any) => val,
    interpolate: (val: any) => 0,
    Extrapolation: { CLAMP: 'clamp' },
    FadeInDown: { delay: () => ({ duration: () => ({}), springify: () => ({ damping: () => ({ stiffness: () => ({}) }) }) }) },
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: (props: any) => React.createElement('Ionicons', props),
  };
});

const mockAlerts: FantasyAlert[] = [
  {
    id: 'a1',
    type: 'injury',
    playerName: 'Connor McDavid',
    team: 'EDM',
    message: 'Upper body injury, day-to-day',
    timestamp: '2h ago',
    isRosterPlayer: true,
  },
  {
    id: 'a2',
    type: 'goalie',
    playerName: 'Igor Shesterkin',
    team: 'NYR',
    message: 'Confirmed starter tonight vs BOS',
    timestamp: '1h ago',
    isRosterPlayer: false,
  },
  {
    id: 'a3',
    type: 'lineup',
    playerName: 'Mika Zibanejad',
    team: 'NYR',
    message: 'Moved to PP1',
    timestamp: '30m ago',
    isRosterPlayer: false,
  },
];

describe('AlertsModule', () => {
  it('renders timeline of alerts', () => {
    const { getByText } = render(<AlertsModule alerts={mockAlerts} />);
    expect(getByText('Alerts')).toBeTruthy();
    expect(getByText('Connor McDavid')).toBeTruthy();
    expect(getByText('Igor Shesterkin')).toBeTruthy();
    expect(getByText('Mika Zibanejad')).toBeTruthy();
  });

  it('displays alert messages and timestamps', () => {
    const { getByText } = render(<AlertsModule alerts={mockAlerts} />);
    expect(getByText('Upper body injury, day-to-day')).toBeTruthy();
    expect(getByText('2h ago')).toBeTruthy();
    expect(getByText('Confirmed starter tonight vs BOS')).toBeTruthy();
  });

  it('color-codes by type with correct icons', () => {
    const { getByTestId } = render(<AlertsModule alerts={mockAlerts} />);
    expect(getByTestId('alert-icon-injury').props.name).toBe('alert-circle');
    expect(getByTestId('alert-icon-goalie').props.name).toBe('shield-checkmark');
    expect(getByTestId('alert-icon-lineup').props.name).toBe('swap-horizontal');
  });

  it('highlights roster player alerts', () => {
    const { getByTestId } = render(<AlertsModule alerts={mockAlerts} />);
    const rosterCard = getByTestId('alert-card-a1');
    const nonRosterCard = getByTestId('alert-card-a2');
    // Roster card gets rosterHighlight style with blueLight border
    const rosterStyle = Array.isArray(rosterCard.props.style)
      ? Object.assign({}, ...rosterCard.props.style.filter(Boolean))
      : rosterCard.props.style;
    const nonRosterStyle = Array.isArray(nonRosterCard.props.style)
      ? Object.assign({}, ...nonRosterCard.props.style.filter(Boolean))
      : nonRosterCard.props.style;
    expect(rosterStyle.borderColor).toBe('rgba(76, 201, 240, 0.3)');
    expect(nonRosterStyle.borderColor).toBeUndefined();
  });

  it('shows empty state when no alerts', () => {
    const { getByText } = render(<AlertsModule alerts={[]} />);
    expect(getByText('No alerts right now')).toBeTruthy();
  });

  it('displays team abbreviations', () => {
    const { getAllByText } = render(<AlertsModule alerts={mockAlerts} />);
    expect(getAllByText('EDM').length).toBe(1);
    expect(getAllByText('NYR').length).toBe(2);
  });
});
