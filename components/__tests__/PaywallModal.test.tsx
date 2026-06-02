import React from 'react';

import PaywallModal from '../PaywallModal';

// Mock useState to work outside React render context
jest.spyOn(React, 'useState').mockImplementation(((init: any) => [init, jest.fn()]) as any);

// Mock react-native
jest.mock('react-native', () => ({
  Modal: ({ children, ...props }: any) =>
    React.createElement('Modal', props, children),
  View: ({ children, ...props }: any) =>
    React.createElement('View', props, children),
  Text: ({ children, ...props }: any) =>
    React.createElement('Text', props, children),
  TouchableOpacity: ({ children, onPress, ...props }: any) =>
    React.createElement('TouchableOpacity', { ...props, onPress }, children),
  ActivityIndicator: (props: any) =>
    React.createElement('ActivityIndicator', props),
  ScrollView: ({ children, ...props }: any) =>
    React.createElement('ScrollView', props, children),
  Dimensions: { get: () => ({ width: 375, height: 812 }) },
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: 'ios' },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }: any) =>
    React.createElement('LinearGradient', props, children),
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: ({ children, ...props }: any) =>
      React.createElement('View', props, children),
    createAnimatedComponent: (c: any) => c,
  },
  FadeInUp: { duration: () => ({ delay: () => ({}) }) },
  FadeInDown: { duration: () => ({ delay: () => ({}) }) },
}));

jest.mock('../../constants/theme', () => ({
  theme: {
    text: '#e6eef8',
    subtext: '#98a6bf',
    card: '#192e5eff',
    factbox: '#334e8dff',
    accent: '#60a5fa',
    background: '#071023',
  },
}));

// Mock react-native-purchases (virtual since not installed)
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
  },
}), { virtual: true });

// Mock subscription service
const mockPurchasePackage = jest.fn().mockResolvedValue(false);
const mockRestorePurchases = jest.fn().mockResolvedValue(false);
const mockGetOfferings = jest.fn().mockResolvedValue({
  current: {
    monthly: { identifier: 'monthly_pkg' },
    annual: { identifier: 'annual_pkg' },
  },
});

jest.mock('../../services/subscription', () => ({
  purchasePackage: (...args: any[]) => mockPurchasePackage(...args),
  restorePurchases: (...args: any[]) => mockRestorePurchases(...args),
  getOfferings: (...args: any[]) => mockGetOfferings(...args),
}));

// Mock SubscriptionProvider
const mockRefresh = jest.fn().mockResolvedValue(undefined);
jest.mock('../SubscriptionProvider', () => ({
  useSubscription: () => ({
    isPremium: false,
    loading: false,
    refresh: mockRefresh,
  }),
}));

// Helper: collect all text from rendered element tree
function collectText(node: any): string[] {
  if (!node) return [];
  if (typeof node === 'string') return [node];
  if (typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (node.props?.children) return collectText(node.props.children);
  return [];
}

// Helper: find element by testID in rendered tree
function findByTestID(node: any, testID: string): any {
  if (!node) return null;
  if (node.props?.testID === testID) return node;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByTestID(child, testID);
      if (found) return found;
    }
  }
  if (node.props?.children) return findByTestID(node.props.children, testID);
  return null;
}

describe('PaywallModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply useState mock after clearAllMocks
    jest.spyOn(React, 'useState').mockImplementation(((init: any) => [init, jest.fn()]) as any);
    mockPurchasePackage.mockResolvedValue(false);
    mockRestorePurchases.mockResolvedValue(false);
    mockGetOfferings.mockResolvedValue({
      current: {
        monthly: { identifier: 'monthly_pkg' },
        annual: { identifier: 'annual_pkg' },
      },
    });
  });

  function renderModal(props: Record<string, any> = {}) {
    return PaywallModal({
      visible: true,
      onClose: jest.fn(),
      ...props,
    });
  }

  it('renders headline and benefits', () => {
    const element = renderModal();
    const texts = collectText(element);

    expect(texts).toContain('Unlock Premium Analytics');
    expect(texts).toContain('ML-powered game predictions');
    expect(texts).toContain('Advanced player analytics');
    expect(texts).toContain('Custom model builder');
    expect(texts).toContain('Ad-free experience');
  });

  it('renders custom feature headline', () => {
    const element = renderModal({ featureHeadline: 'Unlock Player Props' });
    const texts = collectText(element);
    expect(texts).toContain('Unlock Player Props');
  });

  it('renders pricing options', () => {
    const element = renderModal();
    const texts = collectText(element);

    expect(texts).toContain('$6.99/mo');
    expect(texts).toContain('$49.99/yr');
    expect(texts).toContain('Save 40%');
  });

  it('renders trial text and restore link', () => {
    const element = renderModal();
    const texts = collectText(element);

    expect(texts).toContain('Start 7-Day Free Trial');
    expect(texts).toContain('Restore Purchases');
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const element = renderModal({ onClose });

    const closeBtn = findByTestID(element, 'paywall-close');
    expect(closeBtn).not.toBeNull();
    closeBtn.props.onPress();
    expect(onClose).toHaveBeenCalled();
  });

  it('handles annual purchase flow', async () => {
    mockPurchasePackage.mockResolvedValueOnce(true);
    const onClose = jest.fn();
    const element = renderModal({ onClose });

    const annualBtn = findByTestID(element, 'paywall-annual');
    expect(annualBtn).not.toBeNull();
    await annualBtn.props.onPress();

    expect(mockGetOfferings).toHaveBeenCalled();
    expect(mockPurchasePackage).toHaveBeenCalledWith({ identifier: 'annual_pkg' });
    expect(mockRefresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('handles monthly purchase flow', async () => {
    mockPurchasePackage.mockResolvedValueOnce(true);
    const onClose = jest.fn();
    const element = renderModal({ onClose });

    const monthlyBtn = findByTestID(element, 'paywall-monthly');
    expect(monthlyBtn).not.toBeNull();
    await monthlyBtn.props.onPress();

    expect(mockPurchasePackage).toHaveBeenCalledWith({ identifier: 'monthly_pkg' });
  });

  it('does not close on failed purchase', async () => {
    mockPurchasePackage.mockResolvedValueOnce(false);
    const onClose = jest.fn();
    const element = renderModal({ onClose });

    const annualBtn = findByTestID(element, 'paywall-annual');
    await annualBtn.props.onPress();

    expect(mockPurchasePackage).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('handles restore purchases success', async () => {
    mockRestorePurchases.mockResolvedValueOnce(true);
    const onClose = jest.fn();
    const element = renderModal({ onClose });

    const restoreBtn = findByTestID(element, 'paywall-restore');
    await restoreBtn.props.onPress();

    expect(mockRestorePurchases).toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('handles restore purchases failure', async () => {
    mockRestorePurchases.mockResolvedValueOnce(false);
    const onClose = jest.fn();
    const element = renderModal({ onClose });

    const restoreBtn = findByTestID(element, 'paywall-restore');
    await restoreBtn.props.onPress();

    expect(mockRestorePurchases).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('handles missing offerings gracefully', async () => {
    mockGetOfferings.mockResolvedValueOnce(null);
    const onClose = jest.fn();
    const element = renderModal({ onClose });

    const annualBtn = findByTestID(element, 'paywall-annual');
    await annualBtn.props.onPress();

    expect(mockGetOfferings).toHaveBeenCalled();
    expect(mockPurchasePackage).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
