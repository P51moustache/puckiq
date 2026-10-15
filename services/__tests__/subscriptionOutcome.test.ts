import { purchaseOutcome } from '../subscriptionOutcome';

it('separates a production trial from subscription access without claiming charged revenue', () => {
  expect(purchaseOutcome('purchased', { isSandbox: false, periodType: 'TRIAL', productIdentifier: 'annual' }))
    .toEqual({ result: 'purchased', store_environment: 'production', subscription_period: 'trial', access_kind: 'trial', product_id: 'annual' });
  expect(purchaseOutcome('purchased', { isSandbox: false, periodType: 'NORMAL' })).toMatchObject({ access_kind: 'subscription' });
});

it('never counts sandbox or missing receipt metadata as production subscription access', () => {
  expect(purchaseOutcome('purchased', { isSandbox: true, periodType: 'NORMAL' })).toMatchObject({ access_kind: 'sandbox', store_environment: 'sandbox' });
  expect(purchaseOutcome('purchased', { periodType: 'TRIAL' })).toMatchObject({ access_kind: 'unknown', store_environment: 'unknown' });
  expect(purchaseOutcome('purchased', { isSandbox: false })).toMatchObject({ access_kind: 'unknown', subscription_period: 'unknown' });
});

it('retains cancellations and numeric error codes without exposing messages or customer IDs', () => {
  expect(purchaseOutcome('cancelled')).toMatchObject({ result: 'cancelled', access_kind: 'none' });
  const outcome = purchaseOutcome('failed', undefined, { code: 3, message: 'email@example.com', appUserId: 'customer' });
  expect(outcome).toMatchObject({ result: 'failed', access_kind: 'none', error_code: '3' });
  expect(JSON.stringify(outcome)).not.toMatch(/email|customer|message/);
  expect(purchaseOutcome('failed', undefined, { code: '3' }).error_code).toBe('3');
  expect(purchaseOutcome('failed', undefined, { code: 'private@example.com' }).error_code).toBeUndefined();
});
