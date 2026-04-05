// Mock react-native first (node test environment can't parse it)
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// Mock react-native-purchases (virtual since not installed)
const mockConfigure = jest.fn();
const mockGetCustomerInfo = jest.fn();
const mockGetOfferings = jest.fn();
const mockPurchasePackage = jest.fn();
const mockRestorePurchases = jest.fn();

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: mockConfigure,
    getCustomerInfo: mockGetCustomerInfo,
    getOfferings: mockGetOfferings,
    purchasePackage: mockPurchasePackage,
    restorePurchases: mockRestorePurchases,
  },
}), { virtual: true });

import { Platform } from 'react-native';
import {
  initializeSubscription,
  isPro,
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '../subscription';

describe('subscription service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // initializeSubscription
  // -----------------------------------------------------------------------
  describe('initializeSubscription', () => {
    it('configures RevenueCat with iOS key on iOS', async () => {
      Platform.OS = 'ios';
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'ios_key_123';

      await initializeSubscription('user-1');

      expect(mockConfigure).toHaveBeenCalledWith({
        apiKey: 'ios_key_123',
        appUserID: 'user-1',
      });
    });

    it('configures RevenueCat with Android key on Android', async () => {
      Platform.OS = 'android';
      process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'android_key_456';

      await initializeSubscription();

      expect(mockConfigure).toHaveBeenCalledWith({
        apiKey: 'android_key_456',
        appUserID: undefined,
      });
    });

    it('warns and returns when no API key is set', async () => {
      Platform.OS = 'ios';
      delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

      await initializeSubscription();

      expect(mockConfigure).not.toHaveBeenCalled();
    });

    it('handles configure errors gracefully', async () => {
      Platform.OS = 'ios';
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'ios_key_123';
      mockConfigure.mockRejectedValueOnce(new Error('Network error'));

      await expect(initializeSubscription()).resolves.toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // isPro
  // -----------------------------------------------------------------------
  describe('isPro', () => {
    it('returns true when pro entitlement is active', async () => {
      mockGetCustomerInfo.mockResolvedValueOnce({
        entitlements: { active: { pro: { isActive: true } } },
      });

      const result = await isPro();
      expect(result).toBe(true);
    });

    it('returns false when pro entitlement is not active', async () => {
      mockGetCustomerInfo.mockResolvedValueOnce({
        entitlements: { active: {} },
      });

      const result = await isPro();
      expect(result).toBe(false);
    });

    it('returns false on error', async () => {
      mockGetCustomerInfo.mockRejectedValueOnce(new Error('fail'));

      const result = await isPro();
      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // getOfferings
  // -----------------------------------------------------------------------
  describe('getOfferings', () => {
    it('returns offerings on success', async () => {
      const mockOfferingsData = { current: { monthly: {} } };
      mockGetOfferings.mockResolvedValueOnce(mockOfferingsData);

      const result = await getOfferings();
      expect(result).toEqual(mockOfferingsData);
    });

    it('returns null on error', async () => {
      mockGetOfferings.mockRejectedValueOnce(new Error('fail'));

      const result = await getOfferings();
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // purchasePackage
  // -----------------------------------------------------------------------
  describe('purchasePackage', () => {
    const mockPkg = { identifier: 'monthly' } as any;

    it('returns true when purchase grants pro entitlement', async () => {
      mockPurchasePackage.mockResolvedValueOnce({
        customerInfo: { entitlements: { active: { pro: { isActive: true } } } },
      });

      const result = await purchasePackage(mockPkg);
      expect(result).toBe(true);
      expect(mockPurchasePackage).toHaveBeenCalledWith(mockPkg);
    });

    it('returns false when purchase does not grant pro', async () => {
      mockPurchasePackage.mockResolvedValueOnce({
        customerInfo: { entitlements: { active: {} } },
      });

      const result = await purchasePackage(mockPkg);
      expect(result).toBe(false);
    });

    it('returns false when user cancels', async () => {
      mockPurchasePackage.mockRejectedValueOnce({ userCancelled: true });

      const result = await purchasePackage(mockPkg);
      expect(result).toBe(false);
    });

    it('returns false on other errors', async () => {
      mockPurchasePackage.mockRejectedValueOnce(new Error('network'));

      const result = await purchasePackage(mockPkg);
      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // restorePurchases
  // -----------------------------------------------------------------------
  describe('restorePurchases', () => {
    it('returns true when restore finds pro entitlement', async () => {
      mockRestorePurchases.mockResolvedValueOnce({
        entitlements: { active: { pro: { isActive: true } } },
      });

      const result = await restorePurchases();
      expect(result).toBe(true);
    });

    it('returns false when restore finds no pro', async () => {
      mockRestorePurchases.mockResolvedValueOnce({
        entitlements: { active: {} },
      });

      const result = await restorePurchases();
      expect(result).toBe(false);
    });

    it('returns false on error', async () => {
      mockRestorePurchases.mockRejectedValueOnce(new Error('fail'));

      const result = await restorePurchases();
      expect(result).toBe(false);
    });
  });
});
