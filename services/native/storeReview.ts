/**
 * Apple's in-app review request (StoreKit, via expo-store-review). Apple decides whether the
 * dialog actually appears, so callers never promise one. Builds without the native module (older
 * shells running a newer bundle, Android, web) report it unavailable instead of crashing on import.
 */

import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type StoreReviewModule = typeof import('expo-store-review');

function storeReview(): StoreReviewModule | null {
  if (Platform.OS !== 'ios' || !requireOptionalNativeModule('ExpoStoreReview')) return null;
  // Loaded only once the native side is known to exist: the package throws on import without it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-store-review') as StoreReviewModule;
}

export async function storeReviewAvailable(): Promise<boolean> {
  try {
    return (await storeReview()?.isAvailableAsync()) ?? false;
  } catch {
    return false;
  }
}

/** Hands over to StoreKit; true when the request was made (not that a dialog showed). */
export async function requestStoreReview(): Promise<boolean> {
  const module = storeReview();
  if (!module) return false;
  try {
    await module.requestReview();
    return true;
  } catch {
    return false;
  }
}
