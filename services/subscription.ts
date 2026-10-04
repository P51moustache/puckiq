import { Platform } from 'react-native';
import Purchases, { PurchasesPackage, CustomerInfo, PurchasesOfferings } from 'react-native-purchases';
import { loyaltyExpiration } from './loyaltyAccess';

const LOG_PREFIX = '[SUBSCRIPTION]';
export const PRO_ENTITLEMENT = 'pro';

export type ProSource = 'subscription' | 'legacy' | 'loyalty' | 'developer' | null;

export interface ProStatus {
  isPro: boolean;
  source: ProSource;
  /** Store renewal date / expiry, when a subscription is active. */
  expiresAt: string | null;
  willRenew: boolean;
}

export const FREE_STATUS: ProStatus = { isPro: false, source: null, expiresAt: null, willRenew: false };

let configured = false;
let receiptSync: Promise<CustomerInfo> | null = null;

/** Paid-app migration: upload a missing receipt without an automatic Restore prompt. */
async function customerInfo(): Promise<CustomerInfo> {
  const info = await Purchases.getCustomerInfo();
  if (Platform.OS !== 'ios' || info.originalPurchaseDate || info.entitlements?.active?.[PRO_ENTITLEMENT]) return info;
  if (!receiptSync) {
    receiptSync = Purchases.syncPurchasesForResult().then((result) => result.customerInfo).catch((error) => {
      receiptSync = null;
      console.warn(`${LOG_PREFIX} Receipt sync unavailable:`, error);
      return info;
    });
  }
  return receiptSync ?? info;
}

export async function getOriginalDownloadDate(): Promise<string | null> {
  if (!configured || Platform.OS !== 'ios') return null;
  try { return (await customerInfo()).originalPurchaseDate ?? null; } catch { return null; }
}

/**
 * Initialize RevenueCat with platform-specific API key.
 * Call once on app startup (typically from SubscriptionProvider).
 */
export async function initializeSubscription(userId?: string): Promise<boolean> {
  try {
    const apiKey = Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

    if (!apiKey) {
      console.warn(`${LOG_PREFIX} No RevenueCat API key for platform: ${Platform.OS}`);
      return false;
    }

    if (!configured) {
      await Purchases.configure({ apiKey, appUserID: userId || undefined });
      configured = true;
      console.log(`${LOG_PREFIX} RevenueCat configured for ${Platform.OS}`);
    }
    return true;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to initialize:`, error);
    return false;
  }
}

export function isSubscriptionConfigured(): boolean {
  return configured;
}

/**
 * People who bought PuckIQ when it was a paid app keep Pro.
 * EXPO_PUBLIC_FREEMIUM_CUTOVER is the ISO date the App Store price went to Free;
 * any original app purchase before it came with a price tag.
 */
export function isLegacyPurchaser(
  info: Pick<CustomerInfo, 'originalPurchaseDate'>,
  cutoverIso: string | undefined = process.env.EXPO_PUBLIC_FREEMIUM_CUTOVER,
  now: Date = new Date(),
  untilIso: string | undefined = process.env.EXPO_PUBLIC_LEGACY_PRO_UNTIL,
): boolean {
  if (!cutoverIso || !info.originalPurchaseDate) return false;
  const cutover = Date.parse(cutoverIso);
  const purchased = Date.parse(info.originalPurchaseDate);
  if (!Number.isFinite(cutover) || !Number.isFinite(purchased)) return false;
  // Optional end date (e.g. "free Pro through the 2026-27 season"). Unset = no end.
  if (untilIso) {
    const until = Date.parse(untilIso);
    if (Number.isFinite(until) && now.getTime() > until) return false;
  }
  return purchased < cutover;
}

export function statusFromCustomerInfo(info: CustomerInfo, cutoverIso?: string, now: Date = new Date()): ProStatus {
  const entitlement = info.entitlements?.active?.[PRO_ENTITLEMENT];
  if (entitlement) {
    return {
      isPro: true,
      source: 'subscription',
      expiresAt: entitlement.expirationDate ?? null,
      willRenew: entitlement.willRenew === true,
    };
  }
  if (Platform.OS === 'ios' && isLegacyPurchaser(info, cutoverIso ?? process.env.EXPO_PUBLIC_FREEMIUM_CUTOVER, now)) {
    return { isPro: true, source: 'legacy', expiresAt: null, willRenew: false };
  }
  const giftEnd = Platform.OS === 'ios' ? loyaltyExpiration(info, now) : null;
  if (giftEnd) return { isPro: true, source: 'loyalty', expiresAt: giftEnd, willRenew: false };
  return FREE_STATUS;
}

export async function getProStatus(): Promise<ProStatus> {
  if (!configured) return FREE_STATUS;
  try {
    return statusFromCustomerInfo(await customerInfo());
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to check pro status:`, error);
    return FREE_STATUS;
  }
}

/**
 * Check if the current user has the 'pro' entitlement.
 */
export async function isPro(): Promise<boolean> {
  return (await getProStatus()).isPro;
}

export function onCustomerInfoChange(listener: (status: ProStatus) => void): () => void {
  if (!configured) return () => undefined;
  const handler = (info: CustomerInfo) => listener(statusFromCustomerInfo(info));
  try {
    Purchases.addCustomerInfoUpdateListener(handler);
  } catch {
    return () => undefined;
  }
  return () => {
    try {
      Purchases.removeCustomerInfoUpdateListener(handler);
    } catch {
      // ignore
    }
  };
}

/**
 * Fetch available subscription offerings from RevenueCat.
 */
export async function getOfferings(): Promise<PurchasesOfferings | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to fetch offerings:`, error);
    return null;
  }
}

const INTRO_OFFER_ELIGIBLE = 2; // RevenueCat INTRO_ELIGIBILITY_STATUS_ELIGIBLE.

/** Only promise the App Store trial when this Apple ID is eligible for it. */
export async function getTrialEligibility(productIds: string[]): Promise<Record<string, boolean>> {
  if (!configured || !productIds.length) return {};
  try {
    const result = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds);
    return Object.fromEntries(Object.entries(result).map(([id, value]) => [id, value.status === INTRO_OFFER_ELIGIBLE]));
  } catch { return {}; }
}

export type PurchaseResult = 'purchased' | 'cancelled' | 'failed';

/**
 * Purchase a subscription package.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined ? 'purchased' : 'failed';
  } catch (error: any) {
    if (error?.userCancelled) {
      console.log(`${LOG_PREFIX} User cancelled purchase`);
      return 'cancelled';
    }
    console.warn(`${LOG_PREFIX} Purchase failed:`, error);
    return 'failed';
  }
}

/**
 * Restore previous purchases. Returns the resulting status (legacy app buyers included).
 */
export async function restorePurchases(): Promise<ProStatus> {
  if (!configured) return FREE_STATUS;
  try {
    const customerInfo: CustomerInfo = await Purchases.restorePurchases();
    return statusFromCustomerInfo(customerInfo);
  } catch (error) {
    console.warn(`${LOG_PREFIX} Restore failed:`, error);
    return FREE_STATUS;
  }
}
