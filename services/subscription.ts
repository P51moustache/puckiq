/**
 * Paid $1.99 app. No IAP, no Pro, no purchase SDK on the launch path.
 * Last App Review 2.1(a) abort was a purchases TurboModule. That import stays out.
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
