import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  CustomerInfoUpdateListener,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';

const LOG_PREFIX = '[SUBSCRIPTION]';
const PRO_ENTITLEMENT = 'pro';
const INTRO_ELIGIBLE_STATUS = 2;

let configured = false;
let configurePromise: Promise<boolean> | null = null;
let currentUserId: string | null = null;
let identityPromise: Promise<void> = Promise.resolve();

export type PurchaseResult =
  | { status: 'active'; customerInfo: CustomerInfo }
  | { status: 'no_entitlement'; customerInfo: CustomerInfo }
  | { status: 'cancelled' }
  | { status: 'error'; error: unknown };

export type RestoreResult =
  | { status: 'restored'; customerInfo: CustomerInfo }
  | { status: 'no_entitlement'; customerInfo: CustomerInfo }
  | { status: 'error'; error: unknown };

export function hasProEntitlement(customerInfo: CustomerInfo): boolean {
  const entitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT];
  return Boolean(entitlement && (entitlement.isActive ?? true));
}

/**
 * Initialize RevenueCat with platform-specific API key.
 * Call once on app startup (typically from SubscriptionProvider).
 */
export async function initializeSubscription(): Promise<boolean> {
  if (configured) return true;
  if (configurePromise) return configurePromise;

  const apiKey = Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

  if (!apiKey) {
    console.warn(`${LOG_PREFIX} No RevenueCat API key for platform: ${Platform.OS}`);
    return false;
  }

  configurePromise = Promise.resolve().then(() => {
    return Promise.resolve(Purchases.configure({ apiKey })).then(() => {
      configured = true;
      console.log(`${LOG_PREFIX} RevenueCat configured for ${Platform.OS}`);
      return true;
    });
  }).catch((error) => {
    console.warn(`${LOG_PREFIX} Failed to initialize:`, error);
    return false;
  }).finally(() => {
    configurePromise = null;
  });

  return configurePromise;
}

export function setSubscriptionUser(userId?: string): Promise<CustomerInfo | null> {
  const nextIdentity = identityPromise.then(() => setSubscriptionUserNow(userId));
  identityPromise = nextIdentity.then(() => undefined, () => undefined);
  return nextIdentity;
}

async function setSubscriptionUserNow(userId?: string): Promise<CustomerInfo | null> {
  if (!await initializeSubscription()) return null;

  const [nativeIsAnonymous, nativeAppUserId] = await Promise.all([
    Purchases.isAnonymous(),
    Purchases.getAppUserID(),
  ]);

  if (userId) {
    if (currentUserId === userId && !nativeIsAnonymous && nativeAppUserId === userId) {
      return Purchases.getCustomerInfo();
    }
    if (!nativeIsAnonymous && nativeAppUserId !== userId) {
      await Purchases.logOut();
      currentUserId = null;
    }
    const { customerInfo } = await Purchases.logIn(userId);
    currentUserId = userId;
    return customerInfo;
  }

  if (currentUserId !== null || !nativeIsAnonymous) {
    const customerInfo = await Purchases.logOut();
    currentUserId = null;
    return customerInfo;
  }

  return Purchases.getCustomerInfo();
}

export async function getIntroductoryPriceEligibility(productIds: string[]): Promise<Record<string, boolean>> {
  if (Platform.OS !== 'ios' || productIds.length === 0) return {};

  try {
    const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds);
    return Object.fromEntries(
      Object.entries(eligibility).map(([productId, result]) => [
        productId,
        result.status === INTRO_ELIGIBLE_STATUS,
      ]),
    );
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to check introductory price eligibility:`, error);
    return {};
  }
}

export function subscribeToCustomerInfo(listener: CustomerInfoUpdateListener): () => void {
  if (!configured) return () => undefined;
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

/**
 * Check if the current user has the 'pro' entitlement.
 */
export async function isPro(): Promise<boolean> {
  try {
    const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
    return hasProEntitlement(customerInfo);
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to check pro status:`, error);
    return false;
  }
}

/**
 * Fetch available subscription offerings from RevenueCat.
 */
export async function getOfferings(): Promise<PurchasesOfferings> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to fetch offerings:`, error);
    throw error;
  }
}

/**
 * Purchase a subscription package and preserve the store outcome for the UI.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return hasProEntitlement(customerInfo)
      ? { status: 'active', customerInfo }
      : { status: 'no_entitlement', customerInfo };
  } catch (error: any) {
    if (error?.userCancelled) {
      console.log(`${LOG_PREFIX} User cancelled purchase`);
      return { status: 'cancelled' };
    }
    console.warn(`${LOG_PREFIX} Purchase failed:`, error);
    return { status: 'error', error };
  }
}

/**
 * Restore previous purchases and preserve the entitlement outcome for the UI.
 */
export async function restorePurchases(): Promise<RestoreResult> {
  try {
    const customerInfo: CustomerInfo = await Purchases.restorePurchases();
    return hasProEntitlement(customerInfo)
      ? { status: 'restored', customerInfo }
      : { status: 'no_entitlement', customerInfo };
  } catch (error) {
    console.warn(`${LOG_PREFIX} Restore failed:`, error);
    return { status: 'error', error };
  }
}
