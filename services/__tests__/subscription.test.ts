import {
  initializeSubscription,
  isPro,
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '../subscription';
import * as subscription from '../subscription';

describe('subscription service', () => {
  it('never imports RevenueCat', () => {
    const source = require('fs').readFileSync(require('path').join(__dirname, '../subscription.ts'), 'utf8');
    expect(source).not.toMatch(/from 'react-native-purchases'/);
    expect(source).not.toMatch(/from "react-native-purchases"/);
  });

  it('does not configure a native purchase SDK', async () => {
    await expect(initializeSubscription('user-1')).resolves.toBeUndefined();
    await expect(isPro()).resolves.toBe(true);
    await expect(getOfferings()).resolves.toBeNull();
    await expect(purchasePackage({})).resolves.toBe(false);
    await expect(restorePurchases()).resolves.toBe(true);
    expect(Object.keys(subscription)).toEqual(
      expect.arrayContaining([
        'initializeSubscription',
        'isPro',
        'getOfferings',
        'purchasePackage',
        'restorePurchases',
      ]),
    );
  });
});
