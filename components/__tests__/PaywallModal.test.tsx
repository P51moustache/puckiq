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
const mockPurchasePackage = jest.fn();
const mockRestorePurchases = jest.fn();

jest.mock('../../services/subscription', () => ({
  getOfferings: (...args: any[]) => mockGetOfferings(...args),
  purchasePackage: (...args: any[]) => mockPurchasePackage(...args),
  restorePurchases: (...args: any[]) => mockRestorePurchases(...args),
}));

function collectText(node: any): string[] {
  if (!node) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return (node.children || []).flatMap(collectText);
}

const offering = {
  monthly: { identifier: 'monthly-package', product: { priceString: '$7.99', introPrice: null } },
  annual: { identifier: 'annual-package', product: { priceString: '$79.99', introPrice: null } },
};

describe('PaywallModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOfferings.mockResolvedValue({ current: offering });
    mockPurchasePackage.mockResolvedValue({ status: 'active' });
    mockRestorePurchases.mockResolvedValue({ status: 'restored' });
  });

  async function renderModal(props: Record<string, any> = {}) {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <PaywallModal visible onClose={jest.fn()} refresh={jest.fn()} {...props} />,
      );
    });
    return tree!;
  }

  it('renders headline and supported benefits', async () => {
    const tree = await renderModal();
    const texts = collectText(tree.toJSON());

    expect(texts).toContain('Unlock Premium Analytics');
    expect(texts).toContain('ML-powered game predictions');
    expect(texts).toContain('Advanced player analytics');
    expect(texts).toContain('Custom model builder');
    expect(texts).toContain('Forecast history');
  });

  it('renders actual store prices without trial or savings claims', async () => {
    const tree = await renderModal();
    const texts = collectText(tree.toJSON());

    expect(texts).toContain('$7.99');
    expect(texts).toContain('$79.99');
    expect(texts).not.toContain('$6.99/mo');
    expect(texts).not.toContain('$49.99/yr');
    expect(texts).not.toContain('Save 40%');
    expect(texts).not.toContain('Start 7-Day Free Trial');
  });

  it('purchases the selected store package and closes after refresh', async () => {
    const onClose = jest.fn();
    const refresh = jest.fn().mockResolvedValue(undefined);
    const tree = await renderModal({ onClose, refresh });

    await act(async () => {
      tree.root.findByProps({ testID: 'paywall-purchase' }).props.onPress();
    });

    expect(mockPurchasePackage).toHaveBeenCalledWith(offering.annual);
    expect(refresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('restores an entitlement and closes after refresh', async () => {
    const onClose = jest.fn();
    const refresh = jest.fn().mockResolvedValue(undefined);
    const tree = await renderModal({ onClose, refresh });

    await act(async () => {
      tree.root.findByProps({ testID: 'paywall-restore' }).props.onPress();
    });

    expect(mockRestorePurchases).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
