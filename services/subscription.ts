/**
 * Paid app is the whole tool. There is no Pro entitlement and no RevenueCat.
 * Keep these no-ops so leftover paywall files cannot import react-native-purchases.
 */

export async function initializeSubscription(_userId?: string): Promise<void> {
  return;
}

export async function isPro(): Promise<boolean> {
  return true;
}

export async function getOfferings(): Promise<{
  current?: { monthly?: unknown; annual?: unknown };
} | null> {
  return null;
}

export async function purchasePackage(_pkg: unknown): Promise<boolean> {
  return false;
}

export async function restorePurchases(): Promise<boolean> {
  return false;
}
