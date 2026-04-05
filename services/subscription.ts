import { Platform } from 'react-native';
import Purchases, { PurchasesPackage, CustomerInfo, PurchasesOfferings } from 'react-native-purchases';

const LOG_PREFIX = '[SUBSCRIPTION]';

/**
 * Initialize RevenueCat with platform-specific API key.
 * Call once on app startup (typically from SubscriptionProvider).
 */
export async function initializeSubscription(userId?: string): Promise<void> {
  try {
    const apiKey = Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

    if (!apiKey) {
      console.warn(`${LOG_PREFIX} No RevenueCat API key for platform: ${Platform.OS}`);
      return;
    }

    await Purchases.configure({ apiKey, appUserID: userId || undefined });
    console.log(`${LOG_PREFIX} RevenueCat configured for ${Platform.OS}`);
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to initialize:`, error);
  }
}

/**
 * Check if the current user has the 'pro' entitlement.
 */
export async function isPro(): Promise<boolean> {
  try {
    const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active['pro'] !== undefined;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to check pro status:`, error);
    return false;
  }
}

/**
 * Fetch available subscription offerings from RevenueCat.
 */
export async function getOfferings(): Promise<PurchasesOfferings | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to fetch offerings:`, error);
    return null;
  }
}

/**
 * Purchase a subscription package. Returns true on success.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active['pro'] !== undefined;
  } catch (error: any) {
    if (error?.userCancelled) {
      console.log(`${LOG_PREFIX} User cancelled purchase`);
      return false;
    }
    console.warn(`${LOG_PREFIX} Purchase failed:`, error);
    return false;
  }
}

/**
 * Restore previous purchases. Returns true if pro entitlement is found.
 */
export async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo: CustomerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active['pro'] !== undefined;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Restore failed:`, error);
    return false;
  }
}
