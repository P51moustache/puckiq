import { FREE_FEATURES, PRO_FEATURES, isPaywallEnabled } from '../monetization';

describe('monetization flags', () => {
  const originalPaywall = process.env.EXPO_PUBLIC_PAYWALL_ENABLED;
  const originalAd = process.env.EXPO_PUBLIC_SHOW_AD_SLOT;

  afterEach(() => {
    if (originalPaywall === undefined) delete process.env.EXPO_PUBLIC_PAYWALL_ENABLED;
    else process.env.EXPO_PUBLIC_PAYWALL_ENABLED = originalPaywall;
    if (originalAd === undefined) delete process.env.EXPO_PUBLIC_SHOW_AD_SLOT;
    else process.env.EXPO_PUBLIC_SHOW_AD_SLOT = originalAd;
  });

  it('keeps a genuinely useful free tier and sells the coaching layer', () => {
    const free = FREE_FEATURES.join(' ');
    expect(free).toMatch(/Tonight/);
    expect(free).toMatch(/scratch/);
    expect(free).toMatch(/schedule/);
    expect(PRO_FEATURES.map((feature) => feature.title)).toEqual(
      expect.arrayContaining(['Tonight’s best lineup', 'Pickups for YOUR holes', 'Week planner', 'Up to 5 leagues']),
    );
  });

  it('turns the paywall on by default and off only when set to 0', () => {
    delete process.env.EXPO_PUBLIC_PAYWALL_ENABLED;
    expect(isPaywallEnabled()).toBe(true);
    process.env.EXPO_PUBLIC_PAYWALL_ENABLED = '0';
    expect(isPaywallEnabled()).toBe(false);
  });
});
