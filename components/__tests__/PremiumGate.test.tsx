// Mock react-native
import React from 'react';

import PremiumGate from '../PremiumGate';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: {
    create: (styles: any) => styles,
    absoluteFillObject: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('LinearGradient', props, children);
  },
}));

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: any) =>
        React.createElement('View', props, children),
      createAnimatedComponent: (c: any) => c,
    },
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withRepeat: (v: any) => v,
    withTiming: (v: any) => v,
    withSequence: (...args: any[]) => args[0],
    Easing: { inOut: (e: any) => e, ease: {} },
    FadeInUp: { duration: () => ({ delay: () => ({}) }) },
  };
});

const mockUseSubscription = jest.fn(() => ({
  isPremium: false,
  loading: false,
  refresh: jest.fn(),
}));

jest.mock('../SubscriptionProvider', () => ({
  useSubscription: () => mockUseSubscription(),
}));

// Mock hooks so direct function calls work outside render context
jest.spyOn(React, 'useEffect').mockImplementation((() => {}) as any);

// Helper to find elements in the rendered tree
function findByTestID(element: any, testID: string): any {
  if (!element || typeof element !== 'object') return null;
  if (element.props?.testID === testID) return element;
  const children = React.Children.toArray(element.props?.children || []);
  for (const child of children) {
    const found = findByTestID(child, testID);
    if (found) return found;
  }
  return null;
}

function findByText(element: any, text: string): any {
  if (!element || typeof element !== 'object') return null;
  if (element.props?.children === text) return element;
  const children = React.Children.toArray(element.props?.children || []);
  for (const child of children) {
    const found = findByText(child, text);
    if (found) return found;
  }
  return null;
}

function findByType(element: any, type: string): any {
  if (!element || typeof element !== 'object') return null;
  if (element.type === type) return element;
  const children = React.Children.toArray(element.props?.children || []);
  for (const child of children) {
    const found = findByType(child, type);
    if (found) return found;
  }
  return null;
}

describe('PremiumGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      loading: false,
      refresh: jest.fn(),
    });
  });

  it('shows locked overlay for free users', () => {
    const element = PremiumGate({
      feature: 'ML Predictions',
      children: React.createElement('Text', null, 'Secret content'),
    });

    expect(findByTestID(element, 'premium-gate')).not.toBeNull();
    expect(findByTestID(element, 'premium-gate-overlay')).not.toBeNull();
    expect(findByText(element, 'ML Predictions')).not.toBeNull();
    // Redesigned subhead copy (was "Unlock with PuckIQ Pro").
    expect(
      findByText(element, 'Pro unlocks lineup, projections, and waiver intel.'),
    ).not.toBeNull();
  });

  it('renders children directly for premium users (no wrapper)', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      loading: false,
      refresh: jest.fn(),
    });

    const element = PremiumGate({
      feature: 'ML Predictions',
      children: React.createElement('Text', null, 'Secret content'),
    });

    // Should not have the gate wrapper
    expect(findByTestID(element, 'premium-gate')).toBeNull();
    expect(findByTestID(element, 'premium-gate-overlay')).toBeNull();
  });

  it('still renders children (dimmed) behind overlay for free users', () => {
    const element = PremiumGate({
      feature: 'ML Predictions',
      children: React.createElement('Text', null, 'Secret content'),
    });

    expect(findByText(element, 'Secret content')).not.toBeNull();
  });

  it('provides onUpgrade callback on upgrade button', () => {
    const onUpgrade = jest.fn();

    const element = PremiumGate({
      feature: 'ML Predictions',
      onUpgrade,
      children: React.createElement('Text', null, 'Content'),
    });

    const upgradeButton = findByTestID(element, 'premium-gate-upgrade');
    expect(upgradeButton).not.toBeNull();
    expect(upgradeButton.props.onPress).toBe(onUpgrade);
  });

  it('displays the feature name in the overlay', () => {
    const element = PremiumGate({
      feature: 'Advanced Stats',
      children: React.createElement('Text', null, 'Content'),
    });

    expect(findByText(element, 'Advanced Stats')).not.toBeNull();
  });

  it('shows lock icon in overlay', () => {
    const element = PremiumGate({
      feature: 'Test Feature',
      children: React.createElement('Text', null, 'Content'),
    });

    const icon = findByType(element, 'Ionicons');
    expect(icon).not.toBeNull();
    expect(icon.props.name).toBe('lock-closed');
  });
});
