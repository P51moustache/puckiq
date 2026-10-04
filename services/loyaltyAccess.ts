import { LOYALTY_CAMPAIGN } from '../constants/release';

export interface LoyaltyReceipt {
  originalPurchaseDate?: string | null;
  /** RevenueCat's original customer creation time, retained in its customer record. */
  firstSeen: string;
}

export interface LoyaltyCampaign {
  downloadedBefore: string;
  startsAt: string;
  days: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function isReturningDownload(date: string | null | undefined, cutoff: string = LOYALTY_CAMPAIGN.downloadedBefore): boolean {
  const downloaded = Date.parse(date ?? '');
  const before = Date.parse(cutoff);
  return Number.isFinite(downloaded) && Number.isFinite(before) && downloaded < before;
}

/**
 * Gift access without starting a subscription or changing Apple's billing dates.
 * Use a server-supplied firstSeen anchor, never a resettable local claim timestamp.
 * Beta customers first seen before launch start their gift at campaign launch.
 */
export function loyaltyExpiration(
  receipt: LoyaltyReceipt,
  now: Date = new Date(),
  campaign: LoyaltyCampaign = LOYALTY_CAMPAIGN,
): string | null {
  if (!isReturningDownload(receipt.originalPurchaseDate, campaign.downloadedBefore)) return null;
  const firstSeen = Date.parse(receipt.firstSeen);
  const launch = Date.parse(campaign.startsAt);
  const downloaded = Date.parse(receipt.originalPurchaseDate ?? '');
  const current = now.getTime();
  if (![firstSeen, launch, current].every(Number.isFinite) || !Number.isInteger(campaign.days) || campaign.days <= 0) return null;
  const start = Math.max(firstSeen, launch);
  if (firstSeen < downloaded || start > current) return null;
  const end = start + campaign.days * DAY_MS;
  return current < end ? new Date(end).toISOString() : null;
}
