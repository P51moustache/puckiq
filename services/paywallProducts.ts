import type { PurchasesPackage } from 'react-native-purchases';

export function packagePrice(pkg: PurchasesPackage | null | undefined): string | null {
  const price = pkg?.product?.priceString;
  return typeof price === 'string' && price ? price : null;
}

const TRIAL_UNIT_DAYS: Record<string, number> = { DAY: 1, WEEK: 7 };
const TRIAL_UNIT_NAME: Record<string, string> = { MONTH: 'month', YEAR: 'year' };

/** Label from the actual FREE intro offer; eligibility must be checked separately. */
export function trialLabel(pkg: PurchasesPackage | null | undefined): string | null {
  const intro = pkg?.product?.introPrice;
  if (!intro || intro.price !== 0) return null;
  const count = Number(intro.periodNumberOfUnits) || 1;
  const unit = String(intro.periodUnit ?? '').toUpperCase();
  if (TRIAL_UNIT_DAYS[unit]) return `${count * TRIAL_UNIT_DAYS[unit]}-day free trial`;
  if (TRIAL_UNIT_NAME[unit]) return `${count}-${TRIAL_UNIT_NAME[unit]} free trial`;
  return 'free trial';
}

/** Listed price is not charged revenue, especially when an intro offer applies. */
export function packageProperties(pkg: PurchasesPackage) {
  return {
    product_id: String(pkg.product.identifier ?? 'unknown'),
    ...(typeof pkg.product.price === 'number' && Number.isFinite(pkg.product.price) ? { listed_price: pkg.product.price } : {}),
    currency: String(pkg.product.currencyCode ?? 'unknown'),
  };
}
