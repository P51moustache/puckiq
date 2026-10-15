import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearNhlMemoryCache } from '../../nhl/client';
import { fetchWeekSchedule } from '../../nhl/schedule';
import { fetchRosterNewsWithSource } from '../../rosterNews';
import { loadNight } from '../loadNight';
import { currentStatuses, incompleteChecks, lineupCheckedAt, namedLineupChecks } from '../lineupChecks';
import { player } from './fixtures';

const date = '2026-10-13';
const roster = [player(8478402, 'Connor McDavid', 'EDM', 'C')];
const game = { id: 12, gameType: 2, gameDate: date, gameState: 'FUT', homeTeam: { abbrev: 'EDM' }, awayTeam: { abbrev: 'TOR' } };
const sheet = { gameInfo: { homeTeam: { scratches: [] }, awayTeam: { scratches: [] } } };
const originalFetch = global.fetch;
let fail: string | null;
let scratchPayload: unknown;
let clock: jest.SpyInstance;

beforeEach(async () => {
  clearNhlMemoryCache();
  await AsyncStorage.clear();
  fail = null;
  scratchPayload = sheet;
  clock = jest.spyOn(Date, 'now').mockReturnValue(Date.parse(`${date}T16:00:00Z`));
  global.fetch = jest.fn(async (input: unknown) => {
    const url = String(input);
    if (fail && url.includes(fail)) throw new Error('offline');
    return {
      ok: true, status: 200,
      json: async () => url.includes('right-rail') ? scratchPayload : { games: [game] },
      text: async () => '<rss><channel></channel></rss>',
    };
  }) as unknown as typeof fetch;
});
afterEach(() => { global.fetch = originalFetch; clearNhlMemoryCache(); clock.mockRestore(); });

it('distinguishes fresh empty results from unpublished scratch coverage', async () => {
  const fresh = await loadNight(roster, date, { force: true });
  expect(fresh.statuses.get(8478402)?.signal).toBe('ok');
  expect(incompleteChecks(namedLineupChecks(fresh.checks), Date.now())).toEqual([]);
  expect(lineupCheckedAt(namedLineupChecks(fresh.checks), Date.now())).toBe(Date.now());
  scratchPayload = { gameInfo: {} };
  const unpublished = await loadNight(roster, date, { force: true });
  expect(unpublished.statuses.get(8478402)?.signal).toBe('unknown');
  expect(incompleteChecks(namedLineupChecks(unpublished.checks), Date.now())).toEqual(['Scratch list: check unavailable']);
});

it.each(['right-rail', 'espn'])('keeps a failed %s check visible and recovers only after a successful retry', async (source) => {
  fail = source;
  const unavailable = await loadNight(roster, date, { force: true });
  expect(unavailable.statuses.get(8478402)?.signal).toBe('unknown');
  expect(incompleteChecks(namedLineupChecks(unavailable.checks), Date.now())).toEqual([
    `${source === 'right-rail' ? 'Scratch list' : 'Injury news'}: check unavailable`,
  ]);
  expect(lineupCheckedAt(namedLineupChecks(unavailable.checks), Date.now())).toBeNull();
  fail = null;
  const recovered = await loadNight(roster, date, { force: true });
  expect(incompleteChecks(namedLineupChecks(recovered.checks), Date.now())).toEqual([]);
});

it('does not hide a failed forced news refresh by reusing its still-young feed cache', async () => {
  const first = await fetchRosterNewsWithSource(roster, { force: true });
  clock.mockReturnValue(Date.now() + 1000);
  expect((await fetchRosterNewsWithSource(roster)).check.fetchedAt).toBe(first.check.fetchedAt);
  fail = 'espn';
  await expect(fetchRosterNewsWithSource(roster, { force: true })).rejects.toThrow('offline');
  await expect(fetchRosterNewsWithSource(roster)).rejects.toThrow('offline');
});

it('marks a partial planning week as incomplete rather than treating missing dates as verified quiet nights', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ gameWeek: [{ date, games: [game] }] }) })) as unknown as typeof fetch;
  const week = await fetchWeekSchedule('2026-10-12');
  expect(week.days.find((day) => day.date === date)?.games).toHaveLength(1);
  expect(week.check?.state).toBe('unavailable');
});

it('keeps the original schedule timestamp when offline instead of treating a cached slate as newly checked', async () => {
  const fresh = await loadNight(roster, date, { force: true });
  const fetchedAt = fresh.checks.schedule.fetchedAt;
  clock.mockReturnValue(Date.now() + 2 * 60_000);
  fail = '/score/';
  const cached = await loadNight(roster, date, { force: true });
  expect(cached.games).toHaveLength(1);
  expect(cached.checks.schedule).toMatchObject({ state: 'stale', fetchedAt });
  expect(incompleteChecks(namedLineupChecks(cached.checks), Date.now())).toEqual(['Game schedule: last saved data']);
  expect(lineupCheckedAt(namedLineupChecks(cached.checks), Date.now())).toBeNull();
});

it('does not promote a cached scratch to a current confirmed absence after a failed refresh', async () => {
  scratchPayload = { gameInfo: { ...sheet.gameInfo, homeTeam: { scratches: [{ id: 8478402 }] } } };
  const fresh = await loadNight(roster, date, { force: true });
  expect(fresh.statuses.get(8478402)).toMatchObject({ signal: 'scratch', confidence: 'confirmed' });
  fail = 'right-rail';
  const stale = await loadNight(roster, date, { force: true });
  expect(stale.statuses.get(8478402)).toMatchObject({ signal: 'scratch', confidence: 'likely', note: expect.stringContaining('Last saved') });
  expect(stale.checks.scratches[0].state).toBe('stale');
});

it('ages otherwise successful checks when reused and rejects future timestamps', async () => {
  const night = await loadNight(roster, date, { force: true });
  const checks = namedLineupChecks(night.checks);
  expect(incompleteChecks(checks, Date.now() + 60_000)).toEqual(['Game schedule: last saved data']);
  expect(lineupCheckedAt(checks, Date.now() - 1)).toBeNull();
});

it('downgrades a confirmed scratch when cached evidence expires while the app remains open', async () => {
  scratchPayload = { gameInfo: { ...sheet.gameInfo, homeTeam: { scratches: [{ id: 8478402 }] } } };
  const night = await loadNight(roster, date, { force: true });
  expect(currentStatuses(night.statuses, Date.now() + 2 * 60_000).get(8478402)).toMatchObject({
    signal: 'scratch', confidence: 'likely', note: expect.stringContaining('Last saved'),
  });
});

it('does not relabel a tentative news warning as an official scratch-list observation', () => {
  const note = 'Recent scratch report — verify before lineup lock';
  const statuses = new Map([[1, { playerId: 1, signal: 'scratch' as const, confidence: 'likely' as const, note,
    check: { source: 'news', fetchedAt: Date.now() - 1000, maxAgeMs: 1, state: 'fresh' as const } }]]);
  expect(currentStatuses(statuses, Date.now()).get(1)?.note).toBe(note);
});

it('does not treat a malformed daily or weekly response as an empty successful schedule', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
  await expect(loadNight(roster, date, { force: true, news: false })).rejects.toThrow('Daily schedule response is incomplete');
  await expect(fetchWeekSchedule('2026-10-12')).rejects.toThrow('Schedule response is incomplete');
});
