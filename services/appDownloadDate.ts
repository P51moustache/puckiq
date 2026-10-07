// Apple returns this fixed value for every sandbox original app purchase.
// It is not evidence that a test user bought PuckIQ before its free cutover.
// https://developer.apple.com/documentation/storekit/apptransaction/originalpurchasedate
const APPLE_SANDBOX_ORIGINAL_PURCHASE_MS = 1_375_340_400_000;

/** Parse a real original-download date; reject missing, invalid and sandbox dates. */
export function appDownloadTimestamp(value: string | null | undefined): number | null {
  const timestamp = Date.parse(value ?? '');
  return Number.isFinite(timestamp) && timestamp !== APPLE_SANDBOX_ORIGINAL_PURCHASE_MS
    ? timestamp
    : null;
}
