import { PaywallJourney } from '../PaywallJourney';

it('correlates retry, checkout and dismissal without inflating impressions', () => {
  const emit = jest.fn();
  let now = 100;
  const journey = new PaywallJourney(emit, () => now, () => 'visit');
  journey.open('pickups');
  now = 600;
  journey.record('paywall_store_retry');
  journey.record('paywall_checkout_started', { plan: 'annual' });
  now = 2000;
  journey.close('close_button');
  journey.close('hidden');
  expect(emit.mock.calls.filter(([event]) => event === 'paywall_view')).toHaveLength(1);
  expect(emit.mock.calls.filter(([event]) => event === 'paywall_dismiss')).toHaveLength(1);
  expect(emit).toHaveBeenLastCalledWith('paywall_dismiss', { source: 'pickups', paywall_visit_id: 'visit', elapsed_ms: 1900, reason: 'close_button' });
  expect(emit.mock.calls.every(([, data]) => data.paywall_visit_id === 'visit')).toBe(true);
});

it('starts a separate visit on reopening and ignores events after closing', () => {
  const emit = jest.fn();
  let id = 0;
  const journey = new PaywallJourney(emit, () => 1, () => String(++id));
  journey.open('settings');
  journey.close('access_granted');
  journey.record('paywall_store_result');
  journey.open('teams');
  expect(emit.mock.calls.map(([event]) => event)).toEqual(['paywall_view', 'paywall_dismiss', 'paywall_view']);
  expect(emit.mock.calls[2][1]).toMatchObject({ source: 'teams', paywall_visit_id: '2' });
});
