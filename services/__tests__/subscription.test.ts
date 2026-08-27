import {
  initializeSubscription,
  isPro,
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '../subscription';

describe('subscription service — RevenueCat stays out', () => {
  it('does not import react-native-purchases', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../subscription.ts'), 'utf8');
    expect(src).not.toMatch(/from ['"]react-native-purchases['"]/);
    expect(src).not.toMatch(/Purchases\.configure/);
  });

  it('initializeSubscription is a no-op', async () => {
    await expect(initializeSubscription('user-1')).resolves.toBeUndefined();
  });

  it('treats the paid app as unlocked with no Pro check', async () => {
    await expect(isPro()).resolves.toBe(true);
  });

  it('never talks to a store kit for offerings or restore', async () => {
    await expect(getOfferings()).resolves.toBeNull();
    await expect(purchasePackage({ identifier: 'monthly' })).resolves.toBe(false);
    await expect(restorePurchases()).resolves.toBe(false);
  });
});
