import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccuracyStats } from '../accuracyStats';
import type { DailyPicks, Pick } from '../pickTracking';
import { getDateString } from '@/__tests__/utils/factories';

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

function makePick(overrides: Partial<Pick> = {}): Pick {
  return {
    gameId: '1',
    date: '2026-04-01',
    type: 'smart-pick',
    predictedWinner: 'TOR',
    homeTeam: 'TOR',
    awayTeam: 'MTL',
    ...overrides,
  };
}

function makeDailyPicks(date: string, picks: Partial<DailyPicks> = {}): DailyPicks {
  return {
    date,
    smartPicks: [],
    userPicks: [],
    ...picks,
  };
}

function setPickData(data: Record<string, DailyPicks>) {
  mockAsyncStorage.getItem.mockImplementation(async (key: string) => {
    if (key === 'puckiq_daily_picks') return JSON.stringify(data);
    return null;
  });
}

describe('accuracyStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
  });

  describe('getAccuracyStats', () => {
    it('returns empty stats when no picks exist', async () => {
      const stats = await getAccuracyStats();
      expect(stats.totalPicks).toBe(0);
      expect(stats.correctPicks).toBe(0);
      expect(stats.accuracy).toBe(0);
      expect(stats.currentStreak).toBe(0);
      expect(stats.bestStreak).toBe(0);
      expect(stats.dailyAccuracy).toEqual([]);
    });

    it('calculates overall accuracy from resolved picks', async () => {
      setPickData({
        '2026-04-01': makeDailyPicks('2026-04-01', {
          lock: makePick({ date: '2026-04-01', type: 'lock', outcome: 'win', actualWinner: 'TOR' }),
          smartPicks: [
            makePick({ date: '2026-04-01', gameId: '2', outcome: 'win', actualWinner: 'TOR' }),
            makePick({ date: '2026-04-01', gameId: '3', outcome: 'loss', actualWinner: 'MTL' }),
          ],
        }),
      });

      const stats = await getAccuracyStats();
      expect(stats.totalPicks).toBe(3);
      expect(stats.correctPicks).toBe(2);
      expect(stats.accuracy).toBeCloseTo(2 / 3, 5);
    });

    it('excludes pushes from accuracy calculations', async () => {
      setPickData({
        '2026-04-01': makeDailyPicks('2026-04-01', {
          smartPicks: [
            makePick({ date: '2026-04-01', gameId: '1', outcome: 'win', actualWinner: 'TOR' }),
            makePick({ date: '2026-04-01', gameId: '2', outcome: 'push', actualWinner: 'tie' }),
          ],
        }),
      });

      const stats = await getAccuracyStats();
      expect(stats.totalPicks).toBe(1);
      expect(stats.correctPicks).toBe(1);
      expect(stats.accuracy).toBe(1);
    });

    it('excludes unresolved picks', async () => {
      setPickData({
        '2026-04-01': makeDailyPicks('2026-04-01', {
          smartPicks: [
            makePick({ date: '2026-04-01', gameId: '1', outcome: 'win', actualWinner: 'TOR' }),
            makePick({ date: '2026-04-01', gameId: '2' }), // no outcome
          ],
        }),
      });

      const stats = await getAccuracyStats();
      expect(stats.totalPicks).toBe(1);
    });

    it('calculates current streak of consecutive correct picks', async () => {
      const today = getDateString(0);
      const yesterday = getDateString(-1);
      const twoDaysAgo = getDateString(-2);

      setPickData({
        [twoDaysAgo]: makeDailyPicks(twoDaysAgo, {
          smartPicks: [makePick({ date: twoDaysAgo, gameId: '1', outcome: 'loss', actualWinner: 'MTL' })],
        }),
        [yesterday]: makeDailyPicks(yesterday, {
          smartPicks: [makePick({ date: yesterday, gameId: '2', outcome: 'win', actualWinner: 'TOR' })],
        }),
        [today]: makeDailyPicks(today, {
          smartPicks: [makePick({ date: today, gameId: '3', outcome: 'win', actualWinner: 'TOR' })],
        }),
      });

      const stats = await getAccuracyStats();
      expect(stats.currentStreak).toBe(2);
    });

    it('resets current streak on a loss', async () => {
      const today = getDateString(0);
      const yesterday = getDateString(-1);

      setPickData({
        [yesterday]: makeDailyPicks(yesterday, {
          smartPicks: [makePick({ date: yesterday, gameId: '1', outcome: 'win', actualWinner: 'TOR' })],
        }),
        [today]: makeDailyPicks(today, {
          smartPicks: [makePick({ date: today, gameId: '2', outcome: 'loss', actualWinner: 'MTL' })],
        }),
      });

      const stats = await getAccuracyStats();
      expect(stats.currentStreak).toBe(0);
    });

    it('calculates best streak across all history', async () => {
      setPickData({
        '2026-03-01': makeDailyPicks('2026-03-01', {
          smartPicks: [
            makePick({ date: '2026-03-01', gameId: '1', outcome: 'win', actualWinner: 'TOR' }),
            makePick({ date: '2026-03-01', gameId: '2', outcome: 'win', actualWinner: 'TOR' }),
            makePick({ date: '2026-03-01', gameId: '3', outcome: 'win', actualWinner: 'TOR' }),
          ],
        }),
        '2026-03-02': makeDailyPicks('2026-03-02', {
          smartPicks: [makePick({ date: '2026-03-02', gameId: '4', outcome: 'loss', actualWinner: 'MTL' })],
        }),
        '2026-03-03': makeDailyPicks('2026-03-03', {
          smartPicks: [makePick({ date: '2026-03-03', gameId: '5', outcome: 'win', actualWinner: 'TOR' })],
        }),
      });

      const stats = await getAccuracyStats();
      expect(stats.bestStreak).toBe(3);
    });

    it('calculates 7-day rolling window', async () => {
      const recent = getDateString(-2);
      const old = getDateString(-10);

      setPickData({
        [old]: makeDailyPicks(old, {
          smartPicks: [makePick({ date: old, gameId: '1', outcome: 'loss', actualWinner: 'MTL' })],
        }),
        [recent]: makeDailyPicks(recent, {
          smartPicks: [makePick({ date: recent, gameId: '2', outcome: 'win', actualWinner: 'TOR' })],
        }),
      });

      const stats = await getAccuracyStats();
      expect(stats.last7Days.total).toBe(1);
      expect(stats.last7Days.correct).toBe(1);
      expect(stats.last7Days.accuracy).toBe(1);
    });

    it('calculates 30-day rolling window', async () => {
      const recent = getDateString(-5);
      const old = getDateString(-45);

      setPickData({
        [old]: makeDailyPicks(old, {
          smartPicks: [makePick({ date: old, gameId: '1', outcome: 'win', actualWinner: 'TOR' })],
        }),
        [recent]: makeDailyPicks(recent, {
          smartPicks: [makePick({ date: recent, gameId: '2', outcome: 'loss', actualWinner: 'MTL' })],
        }),
      });

      const stats = await getAccuracyStats();
      // Only the recent pick should be in 30-day window
      expect(stats.last30Days.total).toBe(1);
      expect(stats.last30Days.correct).toBe(0);
      // But overall should include both
      expect(stats.totalPicks).toBe(2);
    });

    it('builds daily accuracy array sorted by date', async () => {
      setPickData({
        '2026-04-02': makeDailyPicks('2026-04-02', {
          smartPicks: [
            makePick({ date: '2026-04-02', gameId: '3', outcome: 'win', actualWinner: 'TOR' }),
          ],
        }),
        '2026-04-01': makeDailyPicks('2026-04-01', {
          smartPicks: [
            makePick({ date: '2026-04-01', gameId: '1', outcome: 'win', actualWinner: 'TOR' }),
            makePick({ date: '2026-04-01', gameId: '2', outcome: 'loss', actualWinner: 'MTL' }),
          ],
        }),
      });

      const stats = await getAccuracyStats();
      expect(stats.dailyAccuracy).toHaveLength(2);
      // Sorted by date ascending
      expect(stats.dailyAccuracy[0].date).toBe('2026-04-01');
      expect(stats.dailyAccuracy[0].accuracy).toBe(0.5);
      expect(stats.dailyAccuracy[0].total).toBe(2);
      expect(stats.dailyAccuracy[1].date).toBe('2026-04-02');
      expect(stats.dailyAccuracy[1].accuracy).toBe(1);
      expect(stats.dailyAccuracy[1].total).toBe(1);
    });

    it('includes user picks in calculations', async () => {
      setPickData({
        '2026-04-01': makeDailyPicks('2026-04-01', {
          userPicks: [
            makePick({ date: '2026-04-01', gameId: '1', type: 'user-pick', outcome: 'win', actualWinner: 'TOR' }),
          ],
        }),
      });

      const stats = await getAccuracyStats();
      expect(stats.totalPicks).toBe(1);
      expect(stats.correctPicks).toBe(1);
    });

    it('handles days with no resolved picks gracefully', async () => {
      setPickData({
        '2026-04-01': makeDailyPicks('2026-04-01', {
          smartPicks: [makePick({ date: '2026-04-01', gameId: '1' })], // no outcome
        }),
      });

      const stats = await getAccuracyStats();
      expect(stats.totalPicks).toBe(0);
      expect(stats.dailyAccuracy).toHaveLength(0);
    });
  });
});
