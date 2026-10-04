import { LOYALTY_CAMPAIGN } from '../constants/release';
import type { ProStatus } from './subscription';

/** Shared explanation for Settings, the release notice, and Pro access. */
export function proAccessCopy(status: ProStatus): string {
  const date = status.expiresAt ? new Date(status.expiresAt).toLocaleDateString() : null;
  const copy = {
    legacy: 'Included with your original PuckIQ purchase. No end date or new subscription. Thanks for being early.',
    loyalty: `Your ${LOYALTY_CAMPAIGN.days}-day thank-you gift unlocks Pro${date ? ` through ${date}` : ''}. No subscription starts and there is no automatic charge.`,
    developer: 'Developer override (local build only).',
    subscription: date ? `${status.willRenew ? 'Renews' : 'Ends'} ${date}. Your existing billing schedule stays the same.` : 'Every coach tool is unlocked.',
  };
  return status.source ? copy[status.source] : 'Bought PuckIQ before it became free? Your original purchase includes Pro. Restore purchases if it is missing.';
}
