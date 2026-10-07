/**
 * Free plan: "Already taken" hides a pickup so the next one surfaces — which, on a plan that
 * shows only the top pick, also walks down the Pro list. Two hides a week cover the honest
 * case (your top pick got claimed); the third opens the paywall instead.
 */

/** Free "mark taken" taps per week before the paywall. */
export const FREE_WEEKLY_HIDES = 2;

export function hideAllowanceKey(monday: string): string {
  return `puckiq_free_hides_${monday}`;
}

/** May a free user hide one more pickup, having used `used` this week? Pro always may. */
export function canHidePickup(isPro: boolean, used: number): boolean {
  return isPro || used < FREE_WEEKLY_HIDES;
}

export function parseHideCount(raw: string | null): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
