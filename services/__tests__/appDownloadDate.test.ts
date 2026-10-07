import { appDownloadTimestamp } from '../appDownloadDate';
import { isReturningDownload, loyaltyExpiration } from '../loyaltyAccess';

describe('original app download dates', () => {
  const sandboxDate = '2013-08-01T07:00:00Z';

  it('rejects Apple’s fixed sandbox date across equivalent timezone formats', () => {
    expect(appDownloadTimestamp(sandboxDate)).toBeNull();
    expect(appDownloadTimestamp('2013-08-01T00:00:00-07:00')).toBeNull();
    expect(isReturningDownload(sandboxDate)).toBe(false);
    expect(loyaltyExpiration({ originalPurchaseDate: sandboxDate, firstSeen: '2026-10-04' }, new Date('2026-10-05'))).toBeNull();
  });

  it('preserves real production download dates', () => {
    const date = '2025-12-01T00:00:00Z';
    expect(appDownloadTimestamp(date)).toBe(Date.parse(date));
    expect(isReturningDownload(date)).toBe(true);
  });

  it('rejects missing and invalid dates', () => {
    for (const date of [null, undefined, '', 'invalid']) expect(appDownloadTimestamp(date)).toBeNull();
  });
});
