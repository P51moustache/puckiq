/** Receipt-derived access classification. None of these fields proves a charge settled. */
export type PurchaseResult = 'purchased' | 'cancelled' | 'failed';
export type StoreEnvironment = 'production' | 'sandbox' | 'unknown';
export type SubscriptionPeriod = 'trial' | 'intro' | 'normal' | 'prepaid' | 'unknown';

interface Entitlement {
  isSandbox?: boolean;
  periodType?: string;
  productIdentifier?: string;
}

export interface PurchaseOutcome {
  result: PurchaseResult;
  store_environment: StoreEnvironment;
  subscription_period: SubscriptionPeriod;
  access_kind: 'trial' | 'subscription' | 'sandbox' | 'unknown' | 'none';
  product_id?: string;
  error_code?: string;
}

export function entitlementDetails(entitlement?: Entitlement) {
  const store_environment: StoreEnvironment = typeof entitlement?.isSandbox === 'boolean'
    ? entitlement.isSandbox ? 'sandbox' : 'production' : 'unknown';
  const raw = entitlement?.periodType?.toLowerCase();
  const subscription_period: SubscriptionPeriod = raw === 'trial' || raw === 'intro' || raw === 'normal' || raw === 'prepaid' ? raw : 'unknown';
  return { store_environment, subscription_period };
}

export function purchaseOutcome(result: PurchaseResult, entitlement?: Entitlement, error?: unknown): PurchaseOutcome {
  const details = entitlementDetails(entitlement);
  const access_kind = result !== 'purchased' ? 'none'
    : details.store_environment === 'sandbox' ? 'sandbox'
    : details.store_environment === 'unknown' || details.subscription_period === 'unknown' ? 'unknown'
    : details.subscription_period === 'trial' ? 'trial' : 'subscription';
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  return {
    result, ...details, access_kind,
    ...(entitlement?.productIdentifier ? { product_id: entitlement.productIdentifier } : {}),
    // SDK codes only. Never include exception messages, receipts, customer or transaction IDs.
    ...(typeof code === 'number' || typeof code === 'string' && /^\d{1,3}$/.test(code) ? { error_code: String(code) } : {}),
  };
}
