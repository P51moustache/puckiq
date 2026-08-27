/**
 * Paid $1.99 app. No RevenueCat, no IAP, no Pro gate.
 * Last App Store reject was 2.1(a) RevenueCat TurboModule abort — that SDK stays out.
 */

export async function initializeSubscription(_userId?: string): Promise<void> {
  return;
}

export async function isPro(): Promise<boolean> {
  return true;
}

export async function getOfferings(): Promise<{
  current: { monthly: null; annual: null } | null;
} | null> {
  return null;
}

export async function purchasePackage(_pkg: unknown): Promise<boolean> {
  return false;
}

export async function restorePurchases(): Promise<boolean> {
  return true;
}
