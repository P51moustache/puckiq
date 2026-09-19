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
jest.mock('../arena/ArenaProvider', () => ({ useArena: () => ({ palette: { page: '#fff', soft: '#eee', ink: '#111', muted: '#555', action: '#06c', link: '#06c' } }) }));
jest.mock('../arena/ArenaPrimitives', () => ({ arenaType: { display: 'display', body: 'body' } }));

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
    expect(texts).toContain('Fantasy Projections');
    expect(texts).toContain('My Team');
    expect(texts.join(' ')).not.toMatch(/model-backed probabilities|forecast tools/i);
  });

  it('exposes close, plans, subscribe, and restore as accessible 48-point controls', async () => {
    const tree = await renderModal();
    const close = tree.root.findByProps({ testID: 'paywall-close' });
    const annual = tree.root.findByProps({ testID: 'paywall-annual-plan' });
    const purchase = tree.root.findByProps({ testID: 'paywall-purchase' });
    const restore = tree.root.findByProps({ testID: 'paywall-restore' });
    expect(close.props.accessibilityRole).toBe('button');
    expect(close.props.accessibilityLabel).toBe('Close subscription options');
    expect(annual.props.accessibilityRole).toBe('radio');
    expect(annual.props.accessibilityState.selected).toBe(true);
    expect(annual.props.disabled).toBe(false);
    expect(purchase.props.accessibilityRole).toBe('button');
    expect(purchase.props.accessibilityLabel).toBe('Subscribe with annual plan');
    expect(restore.props.accessibilityRole).toBe('button');
    expect(restore.props.accessibilityLabel).toBe('Restore purchases');
    expect(close.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ minWidth: 48, minHeight: 48 })]));
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

  it('keeps native dismissal disabled during a purchase transaction', async () => {
    let resolvePurchase!: (value: any) => void;
    mockPurchasePackage.mockReturnValueOnce(new Promise((resolve) => { resolvePurchase = resolve; }));
    const onClose = jest.fn();
    const tree = await renderModal({ onClose });
    await act(async () => { void tree.root.findByProps({ testID: 'paywall-purchase' }).props.onPress(); });
    expect(tree.root.findByProps({ testID: 'paywall-monthly-plan' }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ testID: 'paywall-annual-plan' }).props.disabled).toBe(true);
    act(() => { tree.root.findByType('Modal' as any).props.onRequestClose(); });
    expect(onClose).not.toHaveBeenCalled();
    resolvePurchase({ status: 'cancelled' });
    await act(async () => { await Promise.resolve(); });
  });

  it('retries an offering load failure inline', async () => {
    mockGetOfferings.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ current: offering });
    const tree = await renderModal();
    expect(collectText(tree.toJSON())).toContain('Subscription options could not be loaded.');
    await act(async () => { tree.root.findByProps({ testID: 'paywall-retry-offering' }).props.onPress(); });
    expect(mockGetOfferings).toHaveBeenCalledTimes(2);
    expect(collectText(tree.toJSON())).toContain('$79.99');
  });

  it.each([
    { current: null },
    { current: { monthly: null, annual: null } },
  ])('retries an empty or unpriced offering inline', async (emptyOfferings) => {
    mockGetOfferings.mockResolvedValueOnce(emptyOfferings).mockResolvedValueOnce({ current: offering });
    const tree = await renderModal();
    await act(async () => { tree.root.findByProps({ testID: 'paywall-retry-offering' }).props.onPress(); });
    expect(mockGetOfferings).toHaveBeenCalledTimes(2);
    expect(collectText(tree.toJSON())).toContain('$79.99');
  });

  it('keeps help available after a restore failure', async () => {
    mockRestorePurchases.mockResolvedValueOnce({ status: 'error', error: new Error('offline') });
    const onHelp = jest.fn();
    const tree = await renderModal({ onHelp });
    await act(async () => { await tree.root.findByProps({ testID: 'paywall-restore' }).props.onPress(); });
    expect(tree.root.findByProps({ testID: 'paywall-help' }).props.onPress).toBe(onHelp);
  });
});
