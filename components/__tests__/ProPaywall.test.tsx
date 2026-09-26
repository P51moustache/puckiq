const mockRefresh = jest.fn();
const mockApplyStatus = jest.fn();
const mockPurchase = jest.fn().mockResolvedValue('failed');
const mockRestore = jest.fn().mockResolvedValue({ isPro: false, source: null, expiresAt: null, willRenew: false });
const mockGetOfferings = jest.fn().mockResolvedValue({
  current: {
    monthly: { identifier: 'monthly', product: { priceString: '$4.99', price: 4.99 } },
    annual: { identifier: 'annual', product: { priceString: '$19.99', price: 19.99, introPrice: { price: 0, periodUnit: 'WEEK', periodNumberOfUnits: 1 } } },
  },
});
let mockStatus = { isPro: false, source: null as string | null, expiresAt: null, willRenew: false };

jest.mock('../SubscriptionProvider', () => ({
  useSubscription: () => ({ isPremium: mockStatus.isPro, status: mockStatus, loading: false, refresh: mockRefresh, applyStatus: mockApplyStatus }),
}));

jest.mock('../../services/subscription', () => ({
  purchasePackage: (...args: any[]) => mockPurchase(...args),
  restorePurchases: (...args: any[]) => mockRestore(...args),
  getOfferings: (...args: any[]) => mockGetOfferings(...args),
}));

jest.mock('react-native', () => {
  const React = require('react');
  const passthrough = (name: string) => {
    const Mock = ({ children, ...props }: any) => React.createElement(name, props, children);
    Mock.displayName = name;
    return Mock;
  };
  class AnimatedValue {
    constructor(public value: number) {}
  }
  return {
    Modal: ({ children, visible, ...props }: any) => (visible ? React.createElement('Modal', props, children) : null),
    View: passthrough('View'),
    Text: passthrough('Text'),
    Pressable: ({ children, style, ...props }: any) =>
      React.createElement('Pressable', props, typeof children === 'function' ? children({ pressed: false }) : children),
    ScrollView: passthrough('ScrollView'),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    Alert: { alert: jest.fn() },
    Linking: { openURL: jest.fn() },
    StyleSheet: { create: (s: any) => s, hairlineWidth: 0.5 },
    Animated: {
      Value: AnimatedValue,
      View: passthrough('AnimatedView'),
      loop: () => ({ start: jest.fn(), stop: jest.fn() }),
      sequence: jest.fn(),
      timing: jest.fn(),
    },
  };
});

// @ts-expect-error no types for react-test-renderer
import { create, act } from 'react-test-renderer';
import React from 'react';
import { Alert } from 'react-native';
import ProPaywall, { trialLabel } from '../ProPaywall';

async function render(onClose = jest.fn()) {
  let tree: any;
  await act(async () => { tree = create(<ProPaywall visible onClose={onClose} source="pickups" />); });
  return tree;
}

function find(tree: any, testID: string) {
  return tree.root.findAll((n: any) => n.props.testID === testID && typeof n.type === 'string');
}

function texts(tree: any): string {
  return tree.root.findAll((n: any) => n.type === 'Text')
    .map((n: any) => [].concat(n.props.children).filter((c: unknown) => typeof c === 'string' || typeof c === 'number').join(''))
    .join(' ');
}

describe('ProPaywall', () => {
  const originalPaywall = process.env.EXPO_PUBLIC_PAYWALL_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EXPO_PUBLIC_PAYWALL_ENABLED;
    mockStatus = { isPro: false, source: null, expiresAt: null, willRenew: false };
  });

  afterEach(() => {
    if (originalPaywall === undefined) delete process.env.EXPO_PUBLIC_PAYWALL_ENABLED;
    else process.env.EXPO_PUBLIC_PAYWALL_ENABLED = originalPaywall;
  });

  it('shows store prices, the trial, the season saving, and required legal links', async () => {
    const tree = await render();
    const copy = texts(tree);
    expect(copy).toContain('$19.99');
    expect(copy).toContain('$4.99');
    expect(copy).toContain('Start 7-day free trial');
    expect(copy).toContain('7-day free trial, then $19.99/year.');
    expect(copy).toContain('SAVE 43%');
    expect(copy).toContain('Savings vs. paying monthly for a 7-month NHL season.');
    expect(copy).toContain('Terms of Use');
    expect(copy).toMatch(/renew automatically/);
    expect(find(tree, 'pro-restore')).toHaveLength(1);
  });

  it('only calls a free intro offer a trial, worded from its real length', () => {
    const pkg = (introPrice: any) => ({ product: { introPrice } }) as any;
    expect(trialLabel(pkg({ price: 0, periodUnit: 'WEEK', periodNumberOfUnits: 1 }))).toBe('7-day free trial');
    expect(trialLabel(pkg({ price: 0, periodUnit: 'DAY', periodNumberOfUnits: 3 }))).toBe('3-day free trial');
    expect(trialLabel(pkg({ price: 0, periodUnit: 'MONTH', periodNumberOfUnits: 1 }))).toBe('1-month free trial');
    expect(trialLabel(pkg({ price: 0.99, periodUnit: 'MONTH', periodNumberOfUnits: 1 }))).toBeNull();
    expect(trialLabel(pkg(null))).toBeNull();
  });

  it('purchases the season plan by default and closes on success', async () => {
    const onClose = jest.fn();
    mockPurchase.mockResolvedValueOnce('purchased');
    const tree = await render(onClose);
    await act(async () => { find(tree, 'pro-subscribe')[0].props.onPress(); });
    expect(mockPurchase).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'annual' }));
    expect(mockRefresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('purchases monthly when picked and stays open on cancel', async () => {
    const onClose = jest.fn();
    mockPurchase.mockResolvedValueOnce('cancelled');
    const tree = await render(onClose);
    await act(async () => { find(tree, 'pro-plan-monthly')[0].props.onPress(); });
    await act(async () => { find(tree, 'pro-subscribe')[0].props.onPress(); });
    expect(mockPurchase).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'monthly' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('explains when the store has no offerings', async () => {
    mockGetOfferings.mockResolvedValueOnce(null);
    const tree = await render();
    await act(async () => { find(tree, 'pro-subscribe')[0].props.onPress(); });
    expect(mockPurchase).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Store unavailable', expect.any(String));
  });

  it('restores and closes when Pro comes back', async () => {
    const onClose = jest.fn();
    mockRestore.mockResolvedValueOnce({ isPro: true, source: 'subscription', expiresAt: null, willRenew: true });
    const tree = await render(onClose);
    await act(async () => { find(tree, 'pro-restore')[0].props.onPress(); });
    expect(mockApplyStatus).toHaveBeenCalledWith(expect.objectContaining({ isPro: true }));
    expect(onClose).toHaveBeenCalled();
  });

  it('thanks legacy buyers instead of selling to them', async () => {
    mockStatus = { isPro: true, source: 'legacy', expiresAt: null, willRenew: false };
    const tree = await render();
    expect(find(tree, 'pro-active')).toHaveLength(1);
    expect(find(tree, 'pro-subscribe')).toHaveLength(0);
    expect(texts(tree)).toContain('included with your original purchase');
  });
});
