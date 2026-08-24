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

  it('describes the paid $1.99 coach tool, not a Pro gate', () => {
    expect(FREE_FEATURES.join(' ')).toMatch(/This week/);
    expect(FREE_FEATURES.join(' ')).toMatch(/Copy last week/);
    expect(FREE_FEATURES.join(' ')).not.toMatch(/News|Tonight|Yahoo|Lock of the Day/);
    expect(PRO_UNLOCKS).toHaveLength(0);
  });

  it('keeps the paywall off unless explicitly set to 1', () => {
    delete process.env.EXPO_PUBLIC_PAYWALL_ENABLED;
    expect(isPaywallEnabled()).toBe(false);
    process.env.EXPO_PUBLIC_PAYWALL_ENABLED = '1';
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
