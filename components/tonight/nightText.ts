/**
 * Small text helpers for the Tonight screen and its cards.
 */

import { shortDate, weekdayAbbrev } from '../../services/nhl/dates';

/** "Tue Oct 13". */
export function niceDate(date: string): string {
  const day = weekdayAbbrev(date);
  return `${day.slice(0, 1)}${day.slice(1).toLowerCase()} ${shortDate(date)}`;
}

/** "02H : 14M" style countdown, F1 lock-deadline format. */
export function countdownText(startTimeUTC: string | null, now: Date): string {
  if (!startTimeUTC) return '—';
  const ms = Date.parse(startTimeUTC) - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 'LOCKED';
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return days > 0 ? `${pad(days)}D : ${pad(hours)}H` : `${pad(hours)}H : ${pad(mins % 60)}M`;
}

/** Last name only, for tight spots ("MCDAVID"). */
export function lastNameOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}
