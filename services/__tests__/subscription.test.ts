/**
 * RevenueCat is not linked. These stubs must stay native-free so launch
 * cannot call RNPurchases.configure / getCustomerInfo.
 */
import {
  initializeSubscription,
  isPro,
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '../subscription';

describe('subscription service (RevenueCat unloaded)', () => {
  it('initializeSubscription is a no-op and never throws', async () => {
    await expect(initializeSubscription('user-1')).resolves.toBeUndefined();
    await expect(initializeSubscription()).resolves.toBeUndefined();
  });

  it('isPro is always false — no native Purchases.getCustomerInfo', async () => {
    await expect(isPro()).resolves.toBe(false);
  });

  it('getOfferings returns null', async () => {
    await expect(getOfferings()).resolves.toBeNull();
  });

  it('purchasePackage returns false', async () => {
    await expect(purchasePackage({ identifier: 'monthly' })).resolves.toBe(false);
  });

  it('restorePurchases returns false', async () => {
    await expect(restorePurchases()).resolves.toBe(false);
  });

  it('does not import react-native-purchases', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../subscription.ts'), 'utf8');
    expect(src).not.toMatch(/react-native-purchases/);
    expect(src).not.toMatch(/Purchases\.configure/);
    expect(src).not.toMatch(/Purchases\.getCustomerInfo/);
  });
});
