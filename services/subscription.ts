/**
 * Paid $1.99 app. No Pro gate. RevenueCat is not linked.
 *
 * RNPurchases.configure / getCustomerInfo aborted on iOS 26 + New Architecture
 * (ObjCTurboModule::performVoidMethodInvocation → SIGABRT). Do not import
 * react-native-purchases. Leftover paywall UI can call these stubs.
 */

const LOG_PREFIX = '[SUBSCRIPTION]';

export type PurchasesPackage = {
  identifier?: string;
};

export type PurchasesOfferings = {
  current: {
    monthly: PurchasesPackage | null;
    annual: PurchasesPackage | null;
    lifetime: PurchasesPackage | null;
    availablePackages: PurchasesPackage[];
  } | null;
  all: Record<string, unknown>;
};

/**
 * No-op. Previously called Purchases.configure on every launch.
 */
export async function initializeSubscription(_userId?: string): Promise<void> {
  return;
}

/**
 * Always false. There is no Pro entitlement in this packet.
 */
export async function isPro(): Promise<boolean> {
  return false;
}

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  return null;
}

export async function purchasePackage(_pkg: PurchasesPackage): Promise<boolean> {
  console.warn(`${LOG_PREFIX} Purchase skipped — RevenueCat is not linked`);
  return false;
}

export async function restorePurchases(): Promise<boolean> {
  return false;
}
