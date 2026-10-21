/**
 * What the import sheet says between attempts. Most people who opened the screenshot picker had no
 * roster screenshot yet and cancelled (Oct 2026), so the sheet sends them to their league app and
 * greets them when they come back, instead of showing the same three steps again.
 */

export type ImportGuide =
  /** First open: the steps, with a way to open the league app. */
  | 'start'
  /** Left for the league app from the sheet; PuckIQ is in the background. */
  | 'away'
  /** Came back from the league app: "pick the screenshots you just took". */
  | 'returned'
  /** Closed the picker without choosing anything: probably no screenshot yet. */
  | 'no_screenshots';

export type ImportGuideEvent = 'left_for_host' | 'came_back' | 'pick_cancelled' | 'reset';

export const INITIAL_GUIDE: ImportGuide = 'start';

export function nextGuide(guide: ImportGuide, event: ImportGuideEvent): ImportGuide {
  switch (event) {
    case 'left_for_host':
      return 'away';
    case 'came_back':
      // Only a trip to the league app counts; any other return to PuckIQ changes nothing.
      return guide === 'away' ? 'returned' : guide;
    case 'pick_cancelled':
      return 'no_screenshots';
    case 'reset':
      return INITIAL_GUIDE;
  }
}
