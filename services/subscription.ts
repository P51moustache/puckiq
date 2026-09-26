import { Platform } from 'react-native';
import Purchases, { PurchasesPackage, CustomerInfo, PurchasesOfferings } from 'react-native-purchases';

const LOG_PREFIX = '[SUBSCRIPTION]';
export const PRO_ENTITLEMENT = 'pro';

export type ProSource = 'subscription' | 'legacy' | 'developer' | null;

export interface ProStatus {
  isPro: boolean;
  source: ProSource;
  /** Store renewal date / expiry, when a subscription is active. */
  expiresAt: string | null;
  willRenew: boolean;
}

export const FREE_STATUS: ProStatus = { isPro: false, source: null, expiresAt: null, willRenew: false };

let configured = false;

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

export function statusFromCustomerInfo(info: CustomerInfo, cutoverIso?: string): ProStatus {
  const entitlement = info.entitlements?.active?.[PRO_ENTITLEMENT];
  if (entitlement) {
    return {
      isPro: true,
      source: 'subscription',
      expiresAt: entitlement.expirationDate ?? null,
      willRenew: entitlement.willRenew === true,
    };
  }
  if (Platform.OS === 'ios' && isLegacyPurchaser(info, cutoverIso ?? process.env.EXPO_PUBLIC_FREEMIUM_CUTOVER)) {
    return { isPro: true, source: 'legacy', expiresAt: null, willRenew: false };
  }
  return FREE_STATUS;
}

export async function getProStatus(): Promise<ProStatus> {
  if (!configured) return FREE_STATUS;
  try {
    const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
    return statusFromCustomerInfo(customerInfo);
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
