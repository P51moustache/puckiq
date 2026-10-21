/**
 * How many days someone has really used PuckIQ: a day counts once the app has been in front for
 * a minute in total that day, so a glance at a notification doesn't. Kept on this device only;
 * the review ask waits for a few of these days (services/engagement/reviewPrompt).
 */

/**
 * One minute in front, summed over the day. In PostHog (Oct 2026, production) the median day of
 * use was about 2.4 minutes and 70% of days of use reached one minute.
 */
export const ACTIVE_DAY_MIN_MS = 60 * 1000;

export interface ActiveDays {
  /** Days that reached the minute. */
  count: number;
  /** The first day that counted (NHL calendar date, YYYY-MM-DD). */
  firstDay: string | null;
  /** The day `todayMs` belongs to. */
  day: string | null;
  /** Time in front so far on `day`. */
  todayMs: number;
}

export const NO_ACTIVE_DAYS: ActiveDays = { count: 0, firstDay: null, day: null, todayMs: 0 };

/** Adds a stretch of foreground time on `day`; the day counts the moment it reaches the minute. */
export function addForegroundTime(state: ActiveDays, day: string, ms: number): ActiveDays {
  if (!(ms > 0)) return state;
  const before = state.day === day ? state.todayMs : 0;
  const after = before + ms;
  const counts = before < ACTIVE_DAY_MIN_MS && after >= ACTIVE_DAY_MIN_MS;
  return {
    count: state.count + (counts ? 1 : 0),
    firstDay: state.firstDay ?? (counts ? day : null),
    day,
    todayMs: after,
  };
}

export function parseActiveDays(raw: string | null): ActiveDays {
  if (!raw) return NO_ACTIVE_DAYS;
  try {
    const value = JSON.parse(raw) as Partial<ActiveDays>;
    return {
      count: typeof value.count === 'number' && value.count >= 0 ? Math.floor(value.count) : 0,
      firstDay: typeof value.firstDay === 'string' ? value.firstDay : null,
      day: typeof value.day === 'string' ? value.day : null,
      todayMs: typeof value.todayMs === 'number' && value.todayMs >= 0 ? value.todayMs : 0,
    };
  } catch {
    return NO_ACTIVE_DAYS;
  }
}
