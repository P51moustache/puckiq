/**
 * Words and numbers for League Room cards: money, places, roster age, live gaps. Pure.
 */

import type { Room, RoomCurrency } from '../../types/league';
import { SUPPORT_EMAIL } from '../../constants/legal';
import { formatAmount } from '../../services/league';
import { formatValue } from '../../services/fantasy/scoring';

const HOURS_PER_DAY = 24;
/** Under two days a roster's age reads best in hours ("30 h ago"); after that, in days. */
const DAYS_AFTER_HOURS = 48;

/** "$50", "$1,200 CAD". Dues are whole units, so there are never cents. */
export function moneyText(amount: number, currency: RoomCurrency): string {
  return `$${formatAmount(amount)}${currency === 'CAD' ? ' CAD' : ''}`;
}

/** 1 → "1st", 2 → "2nd", 3 → "3rd", 11 → "11th", 22 → "22nd". */
export function ordinal(place: number): string {
  const lastTwo = place % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${place}th`;
  switch (place % 10) {
    case 1:
      return `${place}st`;
    case 2:
      return `${place}nd`;
    case 3:
      return `${place}rd`;
    default:
      return `${place}th`;
  }
}

/** How old a member's roster is: "updated 5 h ago", "updated 3 d ago". */
export function rosterAgeText(hours: number): string {
  if (!Number.isFinite(hours)) return 'roster not synced';
  if (hours < 1) return 'updated just now';
  if (hours < DAYS_AFTER_HOURS) return `updated ${Math.floor(hours)} h ago`;
  return `updated ${Math.floor(hours / HOURS_PER_DAY)} d ago`;
}

/** Points behind the leader, timing-tower style ("−3.2"). The leader, and anyone tied, reads LEAD. */
export function gapText(points: number | null, leaderPoints: number | null): string {
  if (points === null || leaderPoints === null) return '—';
  const behind = leaderPoints - points;
  return behind <= 0 ? 'LEAD' : `−${formatValue(behind)}`;
}

/** "+2.4". */
export function gainText(value: number): string {
  return `+${formatValue(value)}`;
}

/** "1 game", "3 games". */
export function countText(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The support email for "Report a room", with what support needs to find it already filled in. */
export function reportRoomMailto(room: Pick<Room, 'id' | 'name' | 'code'>): string {
  const subject = 'Report a League Room';
  const body = [`Room: ${room.name}`, `Code: ${room.code}`, `Room ID: ${room.id}`, '', 'What happened:', ''].join('\n');
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
