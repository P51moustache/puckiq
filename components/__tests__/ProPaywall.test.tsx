const mockRefresh = jest.fn();
const mockPurchase = jest.fn().mockResolvedValue(false);
const mockRestore = jest.fn().mockResolvedValue(false);
const mockGetOfferings = jest.fn().mockResolvedValue({
  current: { monthly: { identifier: 'monthly' }, annual: { identifier: 'annual' } },
});

jest.mock('../SubscriptionProvider', () => ({
  useSubscription: () => ({ isPremium: false, loading: false, refresh: mockRefresh }),
}));

jest.mock('../../services/subscription', () => ({
  purchasePackage: (...args: any[]) => mockPurchase(...args),
  restorePurchases: (...args: any[]) => mockRestore(...args),
  getOfferings: (...args: any[]) => mockGetOfferings(...args),
}));

jest.mock('react-native', () => {
  const React = require('react');
  return {
    Modal: ({ children, visible, ...props }: any) =>
      visible ? React.createElement('Modal', props, children) : null,
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    TouchableOpacity: ({ children, ...props }: any) => React.createElement('TouchableOpacity', props, children),
    ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    Alert: { alert: jest.fn() },
    StyleSheet: { create: (s: any) => s },
  };
});

// @ts-expect-error no types for react-test-renderer
import { create, act } from 'react-test-renderer';
import React from 'react';
import ProPaywall from '../ProPaywall';

function render(visible = true) {
  let tree: any;
  act(() => { tree = create(<ProPaywall visible={visible} onClose={jest.fn()} />); });
  return tree;
}

function find(tree: any, testID: string) {
  return tree.root.findAll((n: any) => n.props.testID === testID && typeof n.type === 'string');
}

function texts(tree: any): string[] {
  return tree.root.findAll((n: any) => n.type === 'Text' && typeof n.props.children === 'string')
    .map((n: any) => n.props.children);
}

describe('ProPaywall', () => {
  const originalPaywall = process.env.EXPO_PUBLIC_PAYWALL_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_PAYWALL_ENABLED = '1';
  });

  afterEach(() => {
    if (originalPaywall === undefined) delete process.env.EXPO_PUBLIC_PAYWALL_ENABLED;
    else process.env.EXPO_PUBLIC_PAYWALL_ENABLED = originalPaywall;
  });

  it('lists Pro unlocks and Subscribe / Restore', () => {
    const tree = render();
    expect(find(tree, 'pro-paywall')).toHaveLength(1);
    expect(find(tree, 'pro-subscribe')).toHaveLength(1);
    expect(find(tree, 'pro-restore')).toHaveLength(1);
    const copy = texts(tree).join(' ');
    expect(copy).toContain('$1.99');
  });

  it('purchases the annual package by default', async () => {
    mockPurchase.mockResolvedValueOnce(true);
    const tree = render();
    await act(async () => { find(tree, 'pro-subscribe')[0].props.onPress(); });
    expect(mockPurchase).toHaveBeenCalledWith({ identifier: 'annual' });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('restores purchases', async () => {
    const tree = render();
    await act(async () => { find(tree, 'pro-restore')[0].props.onPress(); });
    expect(mockRestore).toHaveBeenCalled();
  });
});
