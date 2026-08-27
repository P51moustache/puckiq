import {
  initializeSubscription,
  isPro,
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '../subscription';

describe('subscription service', () => {
  it('does not import RevenueCat', () => {
    const source = require('fs').readFileSync(require('path').join(__dirname, '../subscription.ts'), 'utf8');
    expect(source).not.toMatch(/react-native-purchases/);
    expect(source).not.toMatch(/Purchases/);
    expect(source).not.toMatch(/RevenueCat/);
    expect(source).not.toMatch(/EXPO_PUBLIC_REVENUECAT/);
  });

  it('does not configure any purchase SDK', async () => {
    await expect(initializeSubscription('user-1')).resolves.toBeUndefined();
    await expect(isPro()).resolves.toBe(true);
    await expect(getOfferings()).resolves.toBeNull();
    await expect(purchasePackage({ identifier: 'monthly' })).resolves.toBe(false);
    await expect(restorePurchases()).resolves.toBe(false);
  });
});
