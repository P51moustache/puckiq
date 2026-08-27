/**
 * Paid $1.99 app. No RevenueCat, no IAP, no Pro.
 * Never import react-native-purchases — that TurboModule aborted App Review (2.1(a)).
 */

export async function initializeSubscription(_userId?: string): Promise<void> {
  return;
}

export async function isPro(): Promise<boolean> {
  return true;
}

export async function getOfferings(): Promise<null> {
  return null;
}

export async function purchasePackage(_pkg: unknown): Promise<boolean> {
  return false;
}

export async function restorePurchases(): Promise<boolean> {
  return true;
}
