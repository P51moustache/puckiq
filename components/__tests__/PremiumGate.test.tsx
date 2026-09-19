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

type SubscriptionMock = {
  isPremium: boolean;
  loading: boolean;
  refresh: jest.Mock;
  showPaywall: jest.Mock;
  subscriptionUnavailableReason?: string | null;
  retrySubscription?: jest.Mock;
};

const mockUseSubscription = jest.fn((): SubscriptionMock => ({
  isPremium: false,
  loading: false,
  refresh: jest.fn(),
  showPaywall: jest.fn(),
  subscriptionUnavailableReason: null,
  retrySubscription: jest.fn(),
}));

jest.mock('../SubscriptionProvider', () => ({
  useSubscription: () => mockUseSubscription(),
}));
jest.mock('../arena/ArenaProvider', () => ({ useArena: () => ({ palette: { paper: '#fff', edge: '#ddd', action: '#06c', actionInk: '#fff', ink: '#111', muted: '#555' } }) }));
jest.mock('../arena/ArenaPrimitives', () => ({ arenaType: { display: 'display', body: 'body' } }));

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
      showPaywall: jest.fn(),
      subscriptionUnavailableReason: null,
      retrySubscription: jest.fn(),
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
    expect(
      findByText(element, 'Pro unlocks Fantasy Projections and My Team.'),
    ).not.toBeNull();
  });

  it('renders children directly for premium users (no wrapper)', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      loading: false,
      refresh: jest.fn(),
      showPaywall: jest.fn(),
    });

    const element = PremiumGate({
      feature: 'ML Predictions',
      children: React.createElement('Text', null, 'Secret content'),
    });

    // Should not have the gate wrapper
    expect(findByTestID(element, 'premium-gate')).toBeNull();
    expect(findByTestID(element, 'premium-gate-overlay')).toBeNull();
  });

  it('fails closed while entitlement state is loading', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      loading: true,
      refresh: jest.fn(),
      showPaywall: jest.fn(),
    });

    const element = PremiumGate({
      feature: 'ML Predictions',
      children: React.createElement('Text', null, 'Secret content'),
    });

    expect(findByTestID(element, 'premium-gate')).not.toBeNull();
  });

  it('shows a retry state instead of silently dead-ending when subscriptions are unavailable', () => {
    const retrySubscription = jest.fn();
    const showPaywall = jest.fn();
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      loading: false,
      refresh: jest.fn(),
      showPaywall,
      subscriptionUnavailableReason: 'RevenueCat is not configured for this platform.',
      retrySubscription,
    });

    const element = PremiumGate({
      feature: 'ML Predictions',
      children: React.createElement('Text', null, 'Secret content'),
    });

    expect(findByText(element, 'Subscriptions unavailable')).not.toBeNull();
    expect(findByText(element, 'RevenueCat is not configured for this platform.')).not.toBeNull();
    const retryButton = findByTestID(element, 'premium-gate-upgrade');
    retryButton.props.onPress();
    expect(retrySubscription).toHaveBeenCalledTimes(1);
    expect(showPaywall).not.toHaveBeenCalled();
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

  it('opens the provider-owned paywall when no upgrade callback is supplied', () => {
    const showPaywall = jest.fn();
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      loading: false,
      refresh: jest.fn(),
      showPaywall,
    });

    const element = PremiumGate({
      feature: 'ML Predictions',
      children: React.createElement('Text', null, 'Content'),
    });

    const upgradeButton = findByTestID(element, 'premium-gate-upgrade');
    upgradeButton.props.onPress();

    expect(showPaywall).toHaveBeenCalledWith('ML Predictions');
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
