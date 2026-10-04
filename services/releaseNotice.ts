import { RELEASE_NOTICE_ID } from '../constants/release';
import { isReturningDownload } from './loyaltyAccess';

export const RELEASE_NOTICE_KEY = 'puckiq_release_notice_seen';
/** Read-only remnants of 1.x/2.x; never created by the new app. */
export const LEGACY_ACTIVITY_KEYS = ['puckiq_daily_picks', 'puckiq_last_check_date'] as const;

/** Reopening or restoring storage cannot cause repeated release announcements. */
export function shouldShowReleaseNotice(seen: string | null, originalDownload: string | null, hadSavedSetup: boolean): boolean {
  return seen !== RELEASE_NOTICE_ID && (hadSavedSetup || isReturningDownload(originalDownload));
}
