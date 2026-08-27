/**
 * Paid app — no IAP, no Pro, no RevenueCat.
 * Last App Store 2.1(a) reject was a Purchases TurboModule abort on launch.
 * This module must never import the Purchases native module.
 */

export async function initializeSubscription(_userId?: string): Promise<void> {
  return;
}

/** Whole tool is paid up front. There is no Pro entitlement to check. */
export async function isPro(): Promise<boolean> {
  return true;
}

export type OfferingsStub = {
  current: {
    monthly: unknown | null;
    annual: unknown | null;
  } | null;
};

export async function getOfferings(): Promise<OfferingsStub | null> {
  return null;
}

export async function purchasePackage(_pkg: unknown): Promise<boolean> {
  return false;
}

export async function restorePurchases(): Promise<boolean> {
  return false;
}
