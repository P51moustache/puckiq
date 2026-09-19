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
const mockLogIn = jest.fn();
const mockLogOut = jest.fn();
const mockGetAppUserID = jest.fn();
const mockIsAnonymous = jest.fn();
const mockCheckTrialOrIntroductoryPriceEligibility = jest.fn();
const mockAddCustomerInfoUpdateListener = jest.fn();
const mockRemoveCustomerInfoUpdateListener = jest.fn();

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: mockConfigure,
    getCustomerInfo: mockGetCustomerInfo,
    getOfferings: mockGetOfferings,
    purchasePackage: mockPurchasePackage,
    restorePurchases: mockRestorePurchases,
    logIn: mockLogIn,
    logOut: mockLogOut,
    getAppUserID: mockGetAppUserID,
    isAnonymous: mockIsAnonymous,
    checkTrialOrIntroductoryPriceEligibility: mockCheckTrialOrIntroductoryPriceEligibility,
    addCustomerInfoUpdateListener: mockAddCustomerInfoUpdateListener,
    removeCustomerInfoUpdateListener: mockRemoveCustomerInfoUpdateListener,
  },
}), { virtual: true });

let subscription: typeof import('../subscription');
let Platform: typeof import('react-native').Platform;

describe('subscription service', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    subscription = require('../subscription');
    Platform = require('react-native').Platform;
    mockGetAppUserID.mockResolvedValue('$RCAnonymousID:test');
    mockIsAnonymous.mockResolvedValue(true);
  });

  // -----------------------------------------------------------------------
  // initializeSubscription
  // -----------------------------------------------------------------------
  describe('initializeSubscription', () => {
    it('configures RevenueCat with iOS key on iOS', async () => {
      Platform.OS = 'ios';
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'ios_key_123';

      await subscription.initializeSubscription();

      expect(mockConfigure).toHaveBeenCalledWith({ apiKey: 'ios_key_123' });
    });

    it('configures RevenueCat with Android key on Android', async () => {
      Platform.OS = 'android';
      process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'android_key_456';

      await subscription.initializeSubscription();

      expect(mockConfigure).toHaveBeenCalledWith({ apiKey: 'android_key_456' });
    });

    it('warns and returns when no API key is set', async () => {
      Platform.OS = 'ios';
      delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

      const result = await subscription.initializeSubscription();

      expect(mockConfigure).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('handles configure errors gracefully', async () => {
      Platform.OS = 'ios';
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'ios_key_123';
      mockConfigure.mockRejectedValueOnce(new Error('Network error'));

      await expect(subscription.initializeSubscription()).resolves.toBe(false);
    });

    it('configures RevenueCat only once, then authenticates and logs out identities', async () => {
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'ios_key_123';
      mockLogIn.mockResolvedValue({ customerInfo: { entitlements: { active: {} } } });
      mockLogOut.mockResolvedValue({ entitlements: { active: {} } });

      await subscription.initializeSubscription();
      await subscription.initializeSubscription();
      await subscription.setSubscriptionUser('user-1');
      await subscription.setSubscriptionUser(undefined);

      expect(mockConfigure).toHaveBeenCalledTimes(1);
      expect(mockLogIn).toHaveBeenCalledWith('user-1');
      expect(mockLogOut).toHaveBeenCalledTimes(1);
    });

    it('subscribes and unsubscribes customer-info listeners', async () => {
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'ios_key_123';
      await subscription.initializeSubscription();
      const listener = jest.fn();

      const unsubscribe = subscription.subscribeToCustomerInfo(listener);
      unsubscribe();

      expect(mockAddCustomerInfoUpdateListener).toHaveBeenCalledWith(listener);
      expect(mockRemoveCustomerInfoUpdateListener).toHaveBeenCalledWith(listener);
    });

    it('serializes rapid identity changes before logging out or reading customer info', async () => {
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'ios_key_123';
      await subscription.initializeSubscription();

      let releaseLogin!: (value: { customerInfo: { entitlements: { active: Record<string, never> } } }) => void;
      mockLogIn.mockReturnValueOnce(new Promise((resolve) => { releaseLogin = resolve; }));
      mockLogOut.mockResolvedValueOnce({ entitlements: { active: {} } });

      const login = subscription.setSubscriptionUser('user-1');
      await Promise.resolve();
      const logout = subscription.setSubscriptionUser(undefined);
      await Promise.resolve();

      expect(mockLogOut).not.toHaveBeenCalled();
      expect(mockGetCustomerInfo).not.toHaveBeenCalled();

      releaseLogin({ customerInfo: { entitlements: { active: {} } } });
      await login;
      await logout;

      expect(mockLogOut).toHaveBeenCalledTimes(1);
    });

    it('logs out a persisted native identity before a guest cold start reads entitlements', async () => {
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'ios_key_123';
      mockIsAnonymous.mockResolvedValue(false);
      mockGetAppUserID.mockResolvedValue('persisted-user');
      mockLogOut.mockResolvedValueOnce({ entitlements: { active: {} } });

      await subscription.initializeSubscription();
      await subscription.setSubscriptionUser(undefined);

      expect(mockGetAppUserID).toHaveBeenCalledTimes(1);
      expect(mockIsAnonymous).toHaveBeenCalledTimes(1);
      expect(mockLogOut).toHaveBeenCalledTimes(1);
      expect(mockGetCustomerInfo).not.toHaveBeenCalled();
    });

    it('returns introductory eligibility only when the store verifies it', async () => {
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'ios_key_123';
      mockCheckTrialOrIntroductoryPriceEligibility.mockResolvedValueOnce({
        monthly: { status: 2 },
        annual: { status: 1 },
      });

      const result = await subscription.getIntroductoryPriceEligibility(['monthly', 'annual']);

      expect(result).toEqual({ monthly: true, annual: false });
      expect(mockCheckTrialOrIntroductoryPriceEligibility).toHaveBeenCalledWith(['monthly', 'annual']);
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

      const result = await subscription.isPro();
      expect(result).toBe(true);
    });

    it('returns false when pro entitlement is not active', async () => {
      mockGetCustomerInfo.mockResolvedValueOnce({
        entitlements: { active: {} },
      });

      const result = await subscription.isPro();
      expect(result).toBe(false);
    });

    it('returns false on error', async () => {
      mockGetCustomerInfo.mockRejectedValueOnce(new Error('fail'));

      const result = await subscription.isPro();
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

      const result = await subscription.getOfferings();
      expect(result).toEqual(mockOfferingsData);
    });

    it('returns null on error', async () => {
      mockGetOfferings.mockRejectedValueOnce(new Error('fail'));

      await expect(subscription.getOfferings()).rejects.toThrow('fail');
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

      const result = await subscription.purchasePackage(mockPkg);
      expect(result.status).toBe('active');
      expect(mockPurchasePackage).toHaveBeenCalledWith(mockPkg);
    });

    it('returns false when purchase does not grant pro', async () => {
      mockPurchasePackage.mockResolvedValueOnce({
        customerInfo: { entitlements: { active: {} } },
      });

      const result = await subscription.purchasePackage(mockPkg);
      expect(result.status).toBe('no_entitlement');
    });

    it('returns false when user cancels', async () => {
      mockPurchasePackage.mockRejectedValueOnce({ userCancelled: true });

      const result = await subscription.purchasePackage(mockPkg);
      expect(result.status).toBe('cancelled');
    });

    it('returns false on other errors', async () => {
      mockPurchasePackage.mockRejectedValueOnce(new Error('network'));

      const result = await subscription.purchasePackage(mockPkg);
      expect(result).toMatchObject({ status: 'error', error: new Error('network') });
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

      const result = await subscription.restorePurchases();
      expect(result.status).toBe('restored');
    });

    it('returns false when restore finds no pro', async () => {
      mockRestorePurchases.mockResolvedValueOnce({
        entitlements: { active: {} },
      });

      const result = await subscription.restorePurchases();
      expect(result.status).toBe('no_entitlement');
    });

    it('returns false on error', async () => {
      mockRestorePurchases.mockRejectedValueOnce(new Error('fail'));

      const result = await subscription.restorePurchases();
      expect(result).toMatchObject({ status: 'error', error: new Error('fail') });
    });
  });
});
