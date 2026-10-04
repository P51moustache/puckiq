// Mock react-native first (node test environment can't parse it)
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const mockConfigure = jest.fn();
const mockGetCustomerInfo = jest.fn();
const mockGetOfferings = jest.fn();
const mockPurchasePackage = jest.fn();
const mockRestorePurchases = jest.fn();
const mockSyncPurchases = jest.fn();
const mockTrialEligibility = jest.fn();

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: mockConfigure,
    getCustomerInfo: mockGetCustomerInfo,
    getOfferings: mockGetOfferings,
    purchasePackage: mockPurchasePackage,
    restorePurchases: mockRestorePurchases,
    syncPurchasesForResult: mockSyncPurchases,
    checkTrialOrIntroductoryPriceEligibility: mockTrialEligibility,
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
  },
}), { virtual: true });

import { Platform } from 'react-native';

type SubscriptionModule = typeof import('../subscription');

function freshModule(): SubscriptionModule {
  let mod: SubscriptionModule | undefined;
  jest.isolateModules(() => {
    mod = require('../subscription');
  });
  return mod as SubscriptionModule;
}

const proInfo = {
  entitlements: { active: { pro: { expirationDate: '2027-04-30T00:00:00Z', willRenew: true } }, all: {} },
  originalPurchaseDate: null,
};
const freeInfo = { entitlements: { active: {}, all: {} }, originalPurchaseDate: null };

describe('subscription service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'ios';
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'ios_key_123';
    delete process.env.EXPO_PUBLIC_FREEMIUM_CUTOVER;
    mockSyncPurchases.mockResolvedValue({ customerInfo: freeInfo });
  });

  it('configures RevenueCat once with the platform key', async () => {
    const sub = freshModule();
    await expect(sub.initializeSubscription('user-1')).resolves.toBe(true);
    await sub.initializeSubscription('user-1');
    expect(mockConfigure).toHaveBeenCalledTimes(1);
    expect(mockConfigure).toHaveBeenCalledWith({ apiKey: 'ios_key_123', appUserID: 'user-1' });
  });

  it('stays free and never calls the SDK when no key is set', async () => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    const sub = freshModule();
    await expect(sub.initializeSubscription()).resolves.toBe(false);
    await expect(sub.isPro()).resolves.toBe(false);
    await expect(sub.getOfferings()).resolves.toBeNull();
    expect(mockGetCustomerInfo).not.toHaveBeenCalled();
  });

  it('survives configure errors', async () => {
    mockConfigure.mockRejectedValueOnce(new Error('Network error'));
    const sub = freshModule();
    await expect(sub.initializeSubscription()).resolves.toBe(false);
  });

  it('reads the pro entitlement with renewal details', async () => {
    const sub = freshModule();
    await sub.initializeSubscription();
    mockGetCustomerInfo.mockResolvedValueOnce(proInfo);
    await expect(sub.getProStatus()).resolves.toEqual({
      isPro: true,
      source: 'subscription',
      expiresAt: '2027-04-30T00:00:00Z',
      willRenew: true,
    });
    mockGetCustomerInfo.mockRejectedValueOnce(new Error('offline'));
    await expect(sub.isPro()).resolves.toBe(false);
  });

  it('grandfathers people who bought the paid app before the freemium cutover', () => {
    const sub = freshModule();
    expect(sub.isLegacyPurchaser({ originalPurchaseDate: '2026-03-01T00:00:00Z' }, '2026-10-01')).toBe(true);
    expect(sub.isLegacyPurchaser({ originalPurchaseDate: '2026-10-05T00:00:00Z' }, '2026-10-01')).toBe(false);
    expect(sub.isLegacyPurchaser({ originalPurchaseDate: '2026-03-01T00:00:00Z' }, undefined)).toBe(false);
    expect(sub.statusFromCustomerInfo({ ...freeInfo, originalPurchaseDate: '2025-12-01T00:00:00Z' } as never, '2026-10-01').source).toBe('legacy');
  });

  it('keeps sandbox reviewers free until they purchase a subscription', () => {
    const sub = freshModule();
    const sandboxInfo = { ...freeInfo, originalPurchaseDate: '2013-08-01T07:00:00Z', firstSeen: '2026-10-04T00:00:00Z' };
    expect(sub.isLegacyPurchaser(sandboxInfo, '2026-09-27T01:00:00Z')).toBe(false);
    expect(sub.statusFromCustomerInfo(sandboxInfo as never, '2026-09-27T01:00:00Z', new Date('2026-10-05'))).toEqual(sub.FREE_STATUS);
    expect(sub.statusFromCustomerInfo({ ...sandboxInfo, entitlements: proInfo.entitlements } as never, '2026-09-27T01:00:00Z').source).toBe('subscription');
  });

  it('syncs a missing app receipt before deciding whether an old paid buyer has Pro', async () => {
    process.env.EXPO_PUBLIC_FREEMIUM_CUTOVER = '2026-09-27T01:00:00Z';
    const sub = freshModule();
    await sub.initializeSubscription();
    mockGetCustomerInfo.mockResolvedValue(freeInfo);
    mockSyncPurchases.mockResolvedValueOnce({ customerInfo: { ...freeInfo, originalPurchaseDate: '2025-12-01' } });
    await expect(sub.getProStatus()).resolves.toMatchObject({ isPro: true, source: 'legacy' });
    await sub.getProStatus();
    expect(mockSyncPurchases).toHaveBeenCalledTimes(1);
    expect(mockRestorePurchases).not.toHaveBeenCalled();
  });

  it('gives an existing free downloader a nonrenewing gift without purchasing anything', () => {
    const sub = freshModule();
    const info = { ...freeInfo, originalPurchaseDate: '2026-09-29', firstSeen: '2026-10-06T12:00:00Z' };
    expect(sub.statusFromCustomerInfo(info as never, '2026-09-27', new Date('2026-10-06T12:00:00Z'))).toEqual({
      isPro: true, source: 'loyalty', expiresAt: '2026-11-05T12:00:00.000Z', willRenew: false,
    });
    expect(sub.statusFromCustomerInfo(info as never, '2026-09-27', new Date('2026-11-05T12:00:00Z'))).toEqual(sub.FREE_STATUS);
    expect(mockPurchasePackage).not.toHaveBeenCalled();
  });

  it('promises an introductory trial only to eligible customers', async () => {
    const sub = freshModule();
    await sub.initializeSubscription();
    mockTrialEligibility.mockResolvedValueOnce({ annual: { status: 2 }, previous: { status: 1 }, unknown: { status: 0 } });
    await expect(sub.getTrialEligibility(['annual', 'previous', 'unknown'])).resolves.toEqual({ annual: true, previous: false, unknown: false });
  });

  it('only grandfathers on iOS (the paid app was iOS-only)', () => {
    (Platform as { OS: string }).OS = 'android';
    const sub = freshModule();
    expect(sub.statusFromCustomerInfo({ ...freeInfo, originalPurchaseDate: '2025-12-01T00:00:00Z' } as never, '2026-10-01').isPro).toBe(false);
  });

  it('reports purchase outcomes, including a user cancel', async () => {
    const sub = freshModule();
    mockPurchasePackage.mockResolvedValueOnce({ customerInfo: proInfo });
    await expect(sub.purchasePackage({} as never)).resolves.toBe('purchased');
    mockPurchasePackage.mockRejectedValueOnce({ userCancelled: true });
    await expect(sub.purchasePackage({} as never)).resolves.toBe('cancelled');
    mockPurchasePackage.mockRejectedValueOnce(new Error('boom'));
    await expect(sub.purchasePackage({} as never)).resolves.toBe('failed');
  });

  it('restores to a pro status when the entitlement comes back', async () => {
    const sub = freshModule();
    await sub.initializeSubscription();
    mockRestorePurchases.mockResolvedValueOnce(proInfo);
    await expect(sub.restorePurchases()).resolves.toMatchObject({ isPro: true });
    mockRestorePurchases.mockRejectedValueOnce(new Error('nope'));
    await expect(sub.restorePurchases()).resolves.toMatchObject({ isPro: false });
  });

  it('fetches offerings once configured', async () => {
    const sub = freshModule();
    await sub.initializeSubscription();
    mockGetOfferings.mockResolvedValueOnce({ current: { identifier: 'default' }, all: {} });
    await expect(sub.getOfferings()).resolves.toMatchObject({ current: { identifier: 'default' } });
  });
});

describe('legacy Pro end date', () => {
  it('can limit grandfathered Pro to a season', () => {
    const sub = freshModule();
    const info = { originalPurchaseDate: '2026-03-01T00:00:00Z' };
    expect(sub.isLegacyPurchaser(info, '2026-10-01', new Date('2027-05-01'), '2027-06-30')).toBe(true);
    expect(sub.isLegacyPurchaser(info, '2026-10-01', new Date('2027-07-15'), '2027-06-30')).toBe(false);
    expect(sub.isLegacyPurchaser(info, '2026-10-01', new Date('2030-01-01'), undefined)).toBe(true);
  });
});
