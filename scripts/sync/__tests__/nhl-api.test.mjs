import assert from 'node:assert/strict';
import test from 'node:test';
import { getCurrentSeason, parseSeasonArg, endpoints, fetchWithRetry, standingsSnapshotDate } from '../nhl-api.mjs';

test('season rolls on July 1 UTC including opening night', () => {
  assert.equal(getCurrentSeason(new Date('2026-06-30T23:59:59Z')), 20252026);
  assert.equal(getCurrentSeason(new Date('2026-07-01T00:00:00Z')), 20262027);
  assert.equal(getCurrentSeason(new Date('2026-10-07T12:00:00Z')), 20262027);
});
test('historical override is explicit and validated', () => {
  assert.equal(parseSeasonArg(['--season=20232024']).season, 20232024);
  assert.throws(() => parseSeasonArg(['--season', '20262028']));
  assert.throws(() => parseSeasonArg(['--season']));
});
test('player sync endpoint requests the stored regular-season period', () => {
  assert.equal(endpoints.teamStats('TOR', 20252026), 'https://api-web.nhle.com/v1/club-stats/TOR/20252026/2');
});
test('standings cannot relabel a prior season or invent a fresh snapshot', () => {
  const rows = [{ seasonId: 20252026, date: '2026-06-15' }, { seasonId: 20252026, date: '2026-06-15' }];
  assert.throws(() => standingsSnapshotDate(rows, 20262027));
  assert.equal(standingsSnapshotDate(rows, 20252026), '2026-06-15');
  assert.throws(() => standingsSnapshotDate([...rows, { seasonId: 20252026, date: '2026-06-16' }], 20252026));
  assert.throws(() => standingsSnapshotDate([{ seasonId: 20252026 }], 20252026));
});
test('team categories request regular season separately from playoffs', () => {
  assert.match(endpoints.teamStatCategory('summary', 20252026), /seasonId=20252026%20and%20gameTypeId=2$/);
});
test('an HTTP error remains an unsuccessful fetch', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503, statusText: 'Unavailable' });
  try {
    await assert.rejects(() => fetchWithRetry('https://example.invalid', 0, 0), /HTTP 503/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
