/**
 * Sizes and marks for the Week stint chart, shared by its header, rows, bars and key.
 * Phones fit seven ~30pt day columns beside the name column; iPad (useWide) gets full
 * names and long bars with "vs TOR" labels.
 */

export interface GridMetrics {
  nameWidth: number;
  totalWidth: number;
  avatarSize: number;
  barHeight: number;
  labelSize: number;
  /** Full "Connor MCDAVID" names and "vs TOR" / "@ TOR" bar labels. */
  long: boolean;
}

/** 116pt name column leaves seven ~30pt days on a 375pt phone — room for "TOR" at 9pt. */
const PHONE: GridMetrics = { nameWidth: 116, totalWidth: 30, avatarSize: 30, barHeight: 18, labelSize: 9, long: false };
/** iPad days are ~100–140pt wide: full names and home/away labels fit. */
const WIDE: GridMetrics = { nameWidth: 200, totalWidth: 40, avatarSize: 34, barHeight: 22, labelSize: 11, long: true };

export function gridMetrics(wide: boolean): GridMetrics {
  return wide ? WIDE : PHONE;
}

/** Space between neighbouring days' bars: a back-to-back still reads as one stint, and the now line fits inside. */
export const DAY_GAP = 4;
/** Corner radius where a stint carries on into the next day (stint ends are fully round). */
export const JOIN_RADIUS = 3;
/** The live-timing "now" line; thinner than DAY_GAP so it never touches a bar. */
export const NOW_LINE_WIDTH = 2;
/** The dot that caps the now line at the top of the chart. */
export const NOW_CAP_SIZE = 6;
/** Player rows: a 44pt touch target plus air around the 30pt tile. */
export const ROW_MIN_HEIGHT = 48;
/** Days already played fade back, like completed laps. */
export const PAST_OPACITY = 0.35;
/** Warm tint for off-night columns (7 or fewer NHL games) on the white card. */
export const OFF_NIGHT_TINT = '#F4F0E9';
/** Edge for the off-night key swatch, which sits on the paper background. */
export const OFF_NIGHT_EDGE = '#DDD6CB';
/** Bench hatching: stripe pitch and weight that stay crisp in an 18pt bar without turning into a flat tint. */
export const HATCH = { pitch: 5, stroke: 1.5, opacity: 0.45, outline: 1.5 } as const;
