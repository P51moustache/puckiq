/**
 * Freemium pricing and flags. StoreKit / RevenueCat products are the source of
 * truth at purchase time; these list prices are what we show until offerings load.
 */

export const LIST_PRICE_ANNUAL = '$14.99/yr';
export const LIST_PRICE_MONTHLY = '$1.99/mo';

export const FREE_FEATURES = [
  'Manual roster (search and save NHL players)',
  'Tonight status for MY players only — lock countdown + Confirmed / Likely / Unknown',
  'The whole week of MY games — no paywall',
  'News filtered to MY players',
] as const;

export const PRO_UNLOCKS = [
  'Coach: sit / start / drop for MY roster (matchup + injury, not a fake model)',
  'Alerts only for MY players, before that player’s game locks',
  'League view: my team vs a friend’s roster (Yahoo attach later)',
  'Yahoo / ESPN roster read (when OAuth ships) — we never write your lineup in v1',
  'No ads',
] as const;

/** Paywall Subscribe/Restore UI. Off only when explicitly set to "0". */
export function isPaywallEnabled(): boolean {
  return process.env.EXPO_PUBLIC_PAYWALL_ENABLED !== '0';
}

/** Dismissible sports-ad placeholder. Off unless explicitly set to "1". Never loads AdMob. */
export function isAdSlotEnabled(): boolean {
  return process.env.EXPO_PUBLIC_SHOW_AD_SLOT === '1';
}
