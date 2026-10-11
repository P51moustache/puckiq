import { pickupPeriodForDate, pickupPeriodInputs, validPickupDate } from '../pickupPeriod';
it('preserves the optimizer’s selected date in its actual week', () => {
  const today = '2026-10-13'; const date = validPickupDate('2026-10-26', today);
  expect(pickupPeriodInputs(pickupPeriodForDate(date, today), today, date)).toMatchObject({ onlyDate: '2026-10-26', weekOffset: 2 });
});
it('routes tomorrow across a Sunday boundary into next week', () => {
  expect(pickupPeriodInputs('tomorrow', '2026-10-18', '2026-10-19')).toMatchObject({ onlyDate: '2026-10-19', weekOffset: 1 });
});
it.each(['2026-02-30', 'bad', '2026-10-12'])('rejects invalid or expired route dates (%s)', (date) => {
  expect(validPickupDate(date, '2026-10-13')).toBeNull();
});
