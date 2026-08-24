/**
 * Paid app is one $1.99 tool. No Pro gate, no IAP paywall, no AdMob this week.
 */

export const LIST_PRICE = '$1.99';
export const LIST_PRICE_ANNUAL = '$1.99';
export const LIST_PRICE_MONTHLY = '$1.99';

export const FREE_FEATURES = [
  'One roster on this device',
  'This week’s lines — tap F / D / G / bench',
  'Copy last week forward',
] as const;

export const PRO_UNLOCKS = [] as const;

/** Paywall stays off unless someone explicitly sets this to "1". Do not ship a Pro gate. */
export function isPaywallEnabled(): boolean {
  return process.env.EXPO_PUBLIC_PAYWALL_ENABLED === '1';
}

/** Dismissible sports-ad placeholder. Off unless explicitly set to "1". Never loads AdMob. */
export function isAdSlotEnabled(): boolean {
  return process.env.EXPO_PUBLIC_SHOW_AD_SLOT === '1';
}
