/**
 * NHL dates are Eastern Time, not the device timezone.
 *
 * A fantasy *game day* is not the calendar day: a 10:30 PM ET puck drop (every Pacific home
 * game) is still in the third period after midnight Eastern, and it counts toward the day it
 * started. So "today" for the coach rolls over at 6:00 AM Eastern instead of midnight.
 */

/**
 * Hour (Eastern) when the coach's "today" becomes the new calendar day. Late Pacific games end
 * around 1:00–1:30 AM ET (later with overtime and a shootout); 6 AM leaves room for all of them
 * and is still before the earliest NHL puck drops (noon matinees).
 */
export const GAME_DAY_ROLLOVER_HOUR_ET = 6;

const HOUR_MS = 60 * 60 * 1000;

const etDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const etHour = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  hourCycle: 'h23',
});

/** The Eastern calendar date (YYYY-MM-DD) at `now`. */
export function getNhlCalendarDate(now: Date = new Date()): string {
  return etDate.format(now);
}

/**
 * The NHL game day at `now`: the Eastern date until 6 AM ET, then the next one. Shifting the
 * instant by 6 hours keeps it exact except on the two DST-change nights, when the rollover
 * lands at 5 or 7 AM — never near a game.
 */
export function getNhlGameDay(now: Date = new Date()): string {
  return etDate.format(new Date(now.getTime() - GAME_DAY_ROLLOVER_HOUR_ET * HOUR_MS));
}

/** The hour of day in Eastern time (0–23). */
export function getEtHour(now: Date = new Date()): number {
  const hour = Number(etHour.format(now));
  return Number.isFinite(hour) ? hour % 24 : 0;
}
