import {
  initializeSubscription,
  isPro,
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '../subscription';

describe('subscription service — no RevenueCat', () => {
  it('does not import or configure a purchases SDK', async () => {
    await expect(initializeSubscription('user-1')).resolves.toBeUndefined();
    await expect(isPro()).resolves.toBe(true);
    await expect(getOfferings()).resolves.toBeNull();
    await expect(purchasePackage({})).resolves.toBe(false);
    await expect(restorePurchases()).resolves.toBe(true);
  });
});
