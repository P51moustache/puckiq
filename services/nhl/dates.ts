/**
 * Calendar math on NHL dates ("YYYY-MM-DD", Eastern). All arithmetic is done in UTC
 * on the date string itself so device timezone never shifts a game to the wrong day.
 */

import { getNhlCalendarDate } from '../nhlDate';

export { getNhlCalendarDate };

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

function toUtc(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function fromUtc(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromUtc(new Date(toUtc(date).getTime() + days * DAY_MS));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS);
}

export function weekdayAbbrev(date: string): string {
  return WEEKDAYS[toUtc(date).getUTCDay()];
}

/** Fantasy weeks run Monday–Sunday on Yahoo, ESPN, and Fantrax. */
export function mondayOf(date: string): string {
  const dow = toUtc(date).getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDays(date, offset);
}

export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** "Oct 13" */
export function shortDate(date: string): string {
  return toUtc(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** "Oct 13 – Oct 19" */
export function weekRangeLabel(monday: string): string {
  return `${shortDate(monday)} – ${shortDate(addDays(monday, 6))}`;
}

/**
 * NHL season id for a calendar date, e.g. 2026-10-15 → 20262027.
 * The new season id starts in September (training camp).
 */
export function seasonIdFor(date: string): number {
  const [y, m] = date.split('-').map(Number);
  const start = m >= 9 ? y : y - 1;
  return Number(`${start}${start + 1}`);
}

export function previousSeasonId(seasonId: number): number {
  const start = Math.floor(seasonId / 10000) - 1;
  return Number(`${start}${start + 1}`);
}

/** "2025-26" */
export function seasonLabel(seasonId: number): string {
  const start = Math.floor(seasonId / 10000);
  return `${start}-${String(start + 1).slice(2)}`;
}

/** Puck drop in the device's timezone, e.g. "7:00 PM". */
export function formatPuckDrop(startTimeUTC: string | null): string {
  if (!startTimeUTC) return 'TBD';
  const time = Date.parse(startTimeUTC);
  if (!Number.isFinite(time)) return 'TBD';
  return new Date(time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Dev builds only: EXPO_PUBLIC_DEV_DATE=2026-03-14 pins "today" (game-day UI, screenshots). */
function devDate(): string | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const value = process.env.EXPO_PUBLIC_DEV_DATE;
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function todayNhl(now: Date = new Date()): string {
  return devDate() ?? getNhlCalendarDate(now);
}
