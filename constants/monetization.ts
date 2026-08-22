/**
 * Freemium pricing and flags. StoreKit / RevenueCat products are the source of
 * truth at purchase time; these list prices are what we show until offerings load.
 */

export const LIST_PRICE_ANNUAL = '$14.99/yr';
export const LIST_PRICE_MONTHLY = '$1.99/mo';

export const FREE_FEATURES = [
  'Manual roster (search and save NHL players)',
  'Tonight status for MY players only',
  'News filtered to MY players',
] as const;

export const PRO_UNLOCKS = [
  'Yahoo / ESPN roster sync (when OAuth ships)',
  'Push alerts only for MY players (goalie / scratch / injury)',
  'No ads',
  'More than one league (later)',
] as const;

/** Paywall Subscribe/Restore UI. Off only when explicitly set to "0". */
export function isPaywallEnabled(): boolean {
  return process.env.EXPO_PUBLIC_PAYWALL_ENABLED !== '0';
}

/** Dismissible sports-ad placeholder. Off unless explicitly set to "1". Never loads AdMob. */
export function isAdSlotEnabled(): boolean {
  return process.env.EXPO_PUBLIC_SHOW_AD_SLOT === '1';
}
