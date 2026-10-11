/** A routed date keeps the pickup finder on the optimizer's exact night and week. */
import { addDays, daysBetween, mondayOf, shortDate } from '../nhl/dates';

export type PickupPeriod = 'week' | 'next' | 'today' | 'tomorrow' | 'date';

export function validPickupDate(value: string | undefined, today: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) return null;
  return daysBetween(today, value) >= 0 ? value : null;
}

export function pickupPeriodForDate(date: string | null, today: string): PickupPeriod {
  if (!date) return 'week';
  if (date === today) return 'today';
  if (date === addDays(today, 1)) return 'tomorrow';
  return 'date';
}

export function pickupPeriodInputs(period: PickupPeriod, today: string, selectedDate: string | null) {
  const onlyDate = period === 'today' ? today : period === 'tomorrow' ? addDays(today, 1)
    : period === 'date' ? selectedDate ?? undefined : undefined;
  return {
    onlyDate,
    weekOffset: onlyDate ? daysBetween(mondayOf(today), mondayOf(onlyDate)) / 7 : period === 'next' ? 1 : 0,
    selectedLabel: selectedDate ? shortDate(selectedDate) : null,
  };
}
