import { FREE_FEATURES, PRO_UNLOCKS, isAdSlotEnabled, isPaywallEnabled } from '../monetization';

describe('monetization flags', () => {
  const originalPaywall = process.env.EXPO_PUBLIC_PAYWALL_ENABLED;
  const originalAd = process.env.EXPO_PUBLIC_SHOW_AD_SLOT;

  afterEach(() => {
    if (originalPaywall === undefined) delete process.env.EXPO_PUBLIC_PAYWALL_ENABLED;
    else process.env.EXPO_PUBLIC_PAYWALL_ENABLED = originalPaywall;
    if (originalAd === undefined) delete process.env.EXPO_PUBLIC_SHOW_AD_SLOT;
    else process.env.EXPO_PUBLIC_SHOW_AD_SLOT = originalAd;
  });

  it('keeps the core app on the free list and extras on Pro', () => {
    expect(FREE_FEATURES.join(' ')).toMatch(/Tonight/);
    expect(FREE_FEATURES.join(' ')).toMatch(/News/);
    expect(PRO_UNLOCKS.join(' ')).toMatch(/Yahoo/);
    expect(PRO_UNLOCKS.join(' ')).toMatch(/alerts/i);
    expect(PRO_UNLOCKS.join(' ')).toMatch(/No ads/);
  });

  it('enables the paywall unless explicitly set to 0', () => {
    delete process.env.EXPO_PUBLIC_PAYWALL_ENABLED;
    expect(isPaywallEnabled()).toBe(true);
    process.env.EXPO_PUBLIC_PAYWALL_ENABLED = '0';
    expect(isPaywallEnabled()).toBe(false);
  });

  it('keeps the ad slot off unless explicitly set to 1', () => {
    delete process.env.EXPO_PUBLIC_SHOW_AD_SLOT;
    expect(isAdSlotEnabled()).toBe(false);
    process.env.EXPO_PUBLIC_SHOW_AD_SLOT = '1';
    expect(isAdSlotEnabled()).toBe(true);
  });
});
