import React from 'react';
import renderer, { act } from 'react-test-renderer';

import PaywallModal from '../PaywallModal';

jest.mock('react-native', () => ({
  Modal: ({ children, ...props }: any) => React.createElement('Modal', props, children),
  View: ({ children, ...props }: any) => React.createElement('View', props, children),
  Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
  TouchableOpacity: ({ children, onPress, ...props }: any) =>
    React.createElement('TouchableOpacity', { ...props, onPress }, children),
  ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
  ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
  StyleSheet: { create: (styles: any) => styles, absoluteFill: {} },
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }: any) => React.createElement('LinearGradient', props, children),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'View' },
  FadeInUp: { duration: () => ({ delay: () => ({}) }) },
  FadeInDown: { duration: () => ({ delay: () => ({}) }) },
}));

const mockGetOfferings = jest.fn();
const mockGetIntroductoryPriceEligibility = jest.fn();
const mockPurchasePackage = jest.fn();
const mockRestorePurchases = jest.fn();

jest.mock('../../services/subscription', () => ({
  getOfferings: (...args: any[]) => mockGetOfferings(...args),
  getIntroductoryPriceEligibility: (...args: any[]) => mockGetIntroductoryPriceEligibility(...args),
  purchasePackage: (...args: any[]) => mockPurchasePackage(...args),
  restorePurchases: (...args: any[]) => mockRestorePurchases(...args),
}));

function collectText(node: any): string[] {
  if (!node) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return (node.children || []).flatMap(collectText);
}

const monthlyPackage = {
  identifier: 'monthly-package',
  product: { priceString: '€8.49', introPrice: null },
};
const annualPackage = {
  identifier: 'annual-package',
  product: { priceString: '€84.99', introPrice: { priceString: '€0.00' } },
};

describe('PaywallModal store offering state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOfferings.mockResolvedValue({
      current: { monthly: monthlyPackage, annual: annualPackage },
    });
    mockGetIntroductoryPriceEligibility.mockResolvedValue({});
    mockPurchasePackage.mockResolvedValue({ status: 'cancelled' });
    mockRestorePurchases.mockResolvedValue({ status: 'no_entitlement' });
  });

  it('renders prices and introductory metadata from the current store offering', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <PaywallModal visible onClose={jest.fn()} refresh={jest.fn()} />,
      );
    });

    const texts = collectText(tree!.toJSON());
    expect(texts).toContain('€8.49');
    expect(texts).toContain('€84.99');
    expect(texts).not.toContain('Intro offer: ');
    expect(texts).not.toContain('€0.00');
    expect(texts).not.toContain('$6.99/mo');
    expect(texts).not.toContain('$49.99/yr');
    expect(texts).not.toContain('Start 7-Day Free Trial');
    expect(texts).not.toContain('Know who wins before the game');
    expect(texts).not.toContain('Never bench the wrong player');
    expect(texts).not.toContain('Projected points for every player');
  });

  it('renders introductory metadata only after eligibility is verified', async () => {
    mockGetIntroductoryPriceEligibility.mockResolvedValueOnce({ 'annual-package': true });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<PaywallModal visible onClose={jest.fn()} refresh={jest.fn()} />);
    });

    expect(collectText(tree!.toJSON())).toContain('Intro offer: ');
    expect(collectText(tree!.toJSON())).toContain('€0.00');
  });

  it('shows an explicit unavailable state when the store has no current offering', async () => {
    mockGetOfferings.mockResolvedValueOnce({ current: null });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <PaywallModal visible onClose={jest.fn()} refresh={jest.fn()} />,
      );
    });

    expect(collectText(tree!.toJSON())).toContain('Subscriptions are currently unavailable.');
  });

  it('shows the offering-load error instead of presenting purchase controls', async () => {
    mockGetOfferings.mockRejectedValueOnce(new Error('store unavailable'));
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <PaywallModal visible onClose={jest.fn()} refresh={jest.fn()} />,
      );
    });

    expect(collectText(tree!.toJSON())).toContain('Subscription options could not be loaded.');
    expect(collectText(tree!.toJSON())).toContain('Subscription action failed: store unavailable');
    expect(tree!.root.findByProps({ testID: 'paywall-purchase' }).props.disabled).toBe(true);
  });

  it('shows unavailable when the current offering has no priced supported plan', async () => {
    mockGetOfferings.mockResolvedValueOnce({
      current: {
        monthly: { identifier: 'monthly-without-price', product: { priceString: '', introPrice: null } },
        annual: null,
      },
    });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<PaywallModal visible onClose={jest.fn()} refresh={jest.fn()} />);
    });

    expect(collectText(tree!.toJSON())).toContain('Subscriptions are currently unavailable.');
    expect(tree!.root.findAllByProps({ testID: 'paywall-monthly-plan' })).toHaveLength(0);
  });

  it('surfaces a cancelled purchase without closing the paywall', async () => {
    const onClose = jest.fn();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<PaywallModal visible onClose={onClose} refresh={jest.fn()} />);
    });

    await act(async () => {
      tree!.root.findByProps({ testID: 'paywall-purchase' }).props.onPress();
    });

    expect(collectText(tree!.toJSON())).toContain('Purchase cancelled.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('surfaces a purchase error without closing the paywall', async () => {
    mockPurchasePackage.mockResolvedValueOnce({
      status: 'error',
      error: new Error('store rejected purchase'),
    });
    const onClose = jest.fn();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<PaywallModal visible onClose={onClose} refresh={jest.fn()} />);
    });

    await act(async () => {
      tree!.root.findByProps({ testID: 'paywall-purchase' }).props.onPress();
    });

    expect(collectText(tree!.toJSON())).toContain('Subscription action failed: store rejected purchase');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('surfaces a restore with no entitlement without closing the paywall', async () => {
    const onClose = jest.fn();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<PaywallModal visible onClose={onClose} refresh={jest.fn()} />);
    });

    await act(async () => {
      tree!.root.findByProps({ testID: 'paywall-restore' }).props.onPress();
    });

    expect(collectText(tree!.toJSON())).toContain('No active PuckIQ Pro entitlement was found.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('surfaces a restore error without closing the paywall', async () => {
    mockRestorePurchases.mockResolvedValueOnce({
      status: 'error',
      error: new Error('restore unavailable'),
    });
    const onClose = jest.fn();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<PaywallModal visible onClose={onClose} refresh={jest.fn()} />);
    });

    await act(async () => {
      tree!.root.findByProps({ testID: 'paywall-restore' }).props.onPress();
    });

    expect(collectText(tree!.toJSON())).toContain('Subscription action failed: restore unavailable');
    expect(onClose).not.toHaveBeenCalled();
  });
});
