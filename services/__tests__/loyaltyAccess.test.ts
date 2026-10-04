import { isReturningDownload, loyaltyExpiration } from '../loyaltyAccess';
import { RELEASE_NOTICE_ID } from '../../constants/release';
import { shouldShowReleaseNotice } from '../releaseNotice';

const receipt = { originalPurchaseDate: '2026-09-29T00:00:00Z', firstSeen: '2026-10-06T12:00:00Z' };
const now = new Date('2026-10-06T12:00:00Z');

describe('loyalty access', () => {
  it('freezes the cohort; a new download never gets the returning-user gift', () => {
    expect(isReturningDownload('2026-10-03T23:59:59Z')).toBe(true);
    expect(isReturningDownload('2026-10-04T00:00:00Z')).toBe(false);
    expect(loyaltyExpiration({ ...receipt, originalPurchaseDate: '2026-10-05' }, now)).toBeNull();
  });
  it('expires exactly 30 days after the server customer anchor', () => {
    expect(loyaltyExpiration(receipt, now)).toBe('2026-11-05T12:00:00.000Z');
    expect(loyaltyExpiration(receipt, new Date('2026-11-05T12:00:00Z'))).toBeNull();
    expect(loyaltyExpiration(receipt, new Date('2026-11-04'))).toBe('2026-11-05T12:00:00.000Z');
  });
  it('starts earlier beta customers at campaign launch', () => {
    expect(loyaltyExpiration({ ...receipt, firstSeen: '2026-09-30' }, new Date('2026-10-04'))).toBe('2026-11-03T00:00:00.000Z');
  });
  it('does not invent eligibility from missing, malformed, or future receipt dates', () => {
    expect(loyaltyExpiration({ ...receipt, originalPurchaseDate: null }, now)).toBeNull();
    expect(loyaltyExpiration({ ...receipt, firstSeen: 'invalid' }, now)).toBeNull();
    expect(loyaltyExpiration({ ...receipt, firstSeen: '2026-12-01' }, now)).toBeNull();
    expect(loyaltyExpiration({ ...receipt, firstSeen: '2026-09-01' }, now)).toBeNull();
  });
});

describe('release announcement', () => {
  it('reaches receipt-confirmed returners, including those who never set up a roster', () => {
    expect(shouldShowReleaseNotice(null, receipt.originalPurchaseDate, false)).toBe(true);
  });
  it('reaches local upgraders even when a receipt is temporarily unavailable', () => {
    expect(shouldShowReleaseNotice(null, null, true)).toBe(true);
    expect(shouldShowReleaseNotice(null, null, false)).toBe(false);
  });
  it('stays dismissed across relaunches and opens no permission prompt', () => {
    expect(shouldShowReleaseNotice(RELEASE_NOTICE_ID, receipt.originalPurchaseDate, true)).toBe(false);
  });
});
