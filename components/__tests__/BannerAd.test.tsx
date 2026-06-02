// Mock react-native
import React from 'react';
import { Platform } from 'react-native';
import BannerAd from '../BannerAd';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Platform: { OS: 'ios' },
  StyleSheet: { create: (styles: any) => styles },
}));

// Mock SubscriptionProvider
const mockUseSubscription = jest.fn(() => ({
  isPremium: false,
  loading: false,
  refresh: jest.fn(),
}));

jest.mock('../SubscriptionProvider', () => ({
  useSubscription: () => mockUseSubscription(),
}));

// Mock react-native-google-mobile-ads (virtual — not installed)
const MockBannerAdComponent = jest.fn((_props: any) => null);

jest.mock('react-native-google-mobile-ads', () => ({
  BannerAd: MockBannerAdComponent,
  BannerAdSize: {
    ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER',
  },
}), { virtual: true });

// Cast to callable for direct invocation in node test environment
const renderBannerAd = BannerAd as unknown as () => any;

describe('BannerAd', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      loading: false,
      refresh: jest.fn(),
    });
    (Platform as any).OS = 'ios';
  });

  it('renders ad container for free users on native', () => {
    const element = renderBannerAd();
    expect(element).not.toBeNull();
    expect(element?.props?.testID).toBe('banner-ad-container');
  });

  it('returns null for premium users', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      loading: false,
      refresh: jest.fn(),
    });

    const element = renderBannerAd();
    expect(element).toBeNull();
  });

  it('returns null on web platform', () => {
    (Platform as any).OS = 'web';

    const element = renderBannerAd();
    expect(element).toBeNull();
  });

  it('uses test ad unit ID in dev mode', () => {
    const element = renderBannerAd();
    // The ad banner is a child of the container View
    const children = React.Children.toArray(element?.props?.children);
    const adElement = children[0] as React.ReactElement<any>;
    expect(adElement?.props?.unitId).toBe('ca-app-pub-3940256099942544/6300978111');
  });

  it('passes ANCHORED_ADAPTIVE_BANNER size', () => {
    const element = renderBannerAd();
    const children = React.Children.toArray(element?.props?.children);
    const adElement = children[0] as React.ReactElement<any>;
    expect(adElement?.props?.size).toBe('ANCHORED_ADAPTIVE_BANNER');
  });
});
