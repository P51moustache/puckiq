import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getTodayDateString,
  getYesterdayDateString,
  calculatePickStats,
  saveDailyPicks,
  getAllDailyPicks,
  getPicksForDate,
  saveLockOfTheDay,
  saveSmartPicks,
  addUserPick,
  removeUserPick,
  updatePickOutcomes,
  getTodaysPicks,
  getAllPicks,
  getUserPickStats,
  getSmartPickStats,
  getLockStats,
} from '../pickTracking';
import {
  createMockPick,
  createMockDailyPicks,
  createWinningPick,
  createLosingPick,
  createPushPick,
} from '@/__tests__/utils/factories';

// Mock AsyncStorage
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('pickTracking', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
  });

  describe('getTodayDateString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const today = getTodayDateString();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return current date', () => {
      const today = new Date();
      const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      expect(getTodayDateString()).toBe(expected);
    });
  });

  describe('getYesterdayDateString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const yesterday = getYesterdayDateString();
      expect(yesterday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return yesterday\'s date', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const expected = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      expect(getYesterdayDateString()).toBe(expected);
    });
  });

  describe('calculatePickStats', () => {
    it('should calculate stats correctly with wins and losses', () => {
      const picks = [
        createWinningPick(),
        createWinningPick(),
        createLosingPick(),
      ];

      const stats = calculatePickStats(picks);

      expect(stats.total).toBe(3);
      expect(stats.wins).toBe(2);
      expect(stats.losses).toBe(1);
      expect(stats.pushes).toBe(0);
      expect(stats.accuracy).toBe(67); // 2 wins out of 3 total = 66.67% rounded to 67%
    });

    it('should handle pushes correctly', () => {
      const picks = [
        createWinningPick(),
        createLosingPick(),
        createPushPick(),
      ];

      const stats = calculatePickStats(picks);

      expect(stats.total).toBe(3);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(1);
      expect(stats.pushes).toBe(1);
      expect(stats.accuracy).toBe(50); // Pushes excluded from accuracy
    });

    it('should return zero accuracy for empty picks', () => {
      const stats = calculatePickStats([]);

      expect(stats.total).toBe(0);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(0);
      expect(stats.pushes).toBe(0);
      expect(stats.accuracy).toBe(0);
    });

    it('should only count completed picks', () => {
      const picks = [
        createWinningPick(),
        createMockPick(), // No outcome
        createLosingPick(),
      ];

      const stats = calculatePickStats(picks);

      expect(stats.total).toBe(2); // Only the completed ones
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(1);
    });

    it('should handle all wins correctly', () => {
      const picks = [
        createWinningPick(),
        createWinningPick(),
        createWinningPick(),
      ];

      const stats = calculatePickStats(picks);

      expect(stats.accuracy).toBe(100);
    });

    it('should handle all losses correctly', () => {
      const picks = [
        createLosingPick(),
        createLosingPick(),
      ];

      const stats = calculatePickStats(picks);

      expect(stats.accuracy).toBe(0);
    });
  });

  describe('saveDailyPicks and getAllDailyPicks', () => {
    it('should save daily picks to AsyncStorage', async () => {
      const dailyPicks = createMockDailyPicks();

      await saveDailyPicks(dailyPicks);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'puckiq_daily_picks',
        expect.stringContaining(dailyPicks.date)
      );
    });

    it('should retrieve all daily picks from AsyncStorage', async () => {
      const mockData = {
        '2024-01-01': createMockDailyPicks({ date: '2024-01-01' }),
        '2024-01-02': createMockDailyPicks({ date: '2024-01-02' }),
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockData));

      const result = await getAllDailyPicks();

      expect(result).toEqual(mockData);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('puckiq_daily_picks');
    });

    it('should return empty object when no picks exist', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await getAllDailyPicks();

      expect(result).toEqual({});
    });

    it('should merge new picks with existing picks', async () => {
      const existingPicks = {
        '2024-01-01': createMockDailyPicks({ date: '2024-01-01' }),
      };
      const newPicks = createMockDailyPicks({ date: '2024-01-02' });

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(existingPicks));

      await saveDailyPicks(newPicks);

      const savedData = JSON.parse(
        (mockAsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );

      expect(savedData).toHaveProperty('2024-01-01');
      expect(savedData).toHaveProperty('2024-01-02');
    });
  });

  describe('getPicksForDate', () => {
    it('should return picks for specific date', async () => {
      const mockData = {
        '2024-01-01': createMockDailyPicks({ date: '2024-01-01' }),
        '2024-01-02': createMockDailyPicks({ date: '2024-01-02' }),
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockData));

      const result = await getPicksForDate('2024-01-01');

      expect(result).toEqual(mockData['2024-01-01']);
    });

    it('should return null when date has no picks', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({}));

      const result = await getPicksForDate('2024-01-01');

      expect(result).toBeNull();
    });
  });

  describe('saveLockOfTheDay', () => {
    it('should save lock pick for today', async () => {
      const lockPick = {
        gameId: '123',
        predictedWinner: 'TOR',
        homeTeam: 'TOR',
        awayTeam: 'MTL',
        confidenceScore: 85,
      };

      await saveLockOfTheDay(lockPick);

      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(
        (mockAsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      const today = getTodayDateString();
      expect(savedData[today].lock.type).toBe('lock');
      expect(savedData[today].lock.gameId).toBe('123');
    });
  });

  describe('saveSmartPicks', () => {
    it('should save smart picks for today', async () => {
      const smartPicks = [
        {
          gameId: '123',
          predictedWinner: 'TOR',
          homeTeam: 'TOR',
          awayTeam: 'MTL',
          confidenceScore: 75,
        },
        {
          gameId: '456',
          predictedWinner: 'BOS',
          homeTeam: 'BOS',
          awayTeam: 'NYR',
          confidenceScore: 70,
        },
      ];

      await saveSmartPicks(smartPicks);

      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(
        (mockAsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      const today = getTodayDateString();
      expect(savedData[today].smartPicks).toHaveLength(2);
      expect(savedData[today].smartPicks[0].type).toBe('smart-pick');
    });
  });

  describe('addUserPick and removeUserPick', () => {
    it('should add a user pick', async () => {
      const userPick = {
        gameId: '789',
        predictedWinner: 'CHI',
        homeTeam: 'CHI',
        awayTeam: 'DET',
      };

      await addUserPick(userPick);

      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(
        (mockAsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      const today = getTodayDateString();
      expect(savedData[today].userPicks).toHaveLength(1);
      expect(savedData[today].userPicks[0].type).toBe('user-pick');
    });

    it('should replace existing user pick for same game', async () => {
      const existingPicks = createMockDailyPicks({
        userPicks: [
          createMockPick({ gameId: '789', type: 'user-pick', predictedWinner: 'CHI' }),
        ],
      });

      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({ [getTodayDateString()]: existingPicks })
      );

      const updatedPick = {
        gameId: '789',
        predictedWinner: 'DET', // Changed prediction
        homeTeam: 'CHI',
        awayTeam: 'DET',
      };

      await addUserPick(updatedPick);

      const savedData = JSON.parse(
        (mockAsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      const today = getTodayDateString();
      expect(savedData[today].userPicks).toHaveLength(1);
      expect(savedData[today].userPicks[0].predictedWinner).toBe('DET');
    });

    it('should remove a user pick', async () => {
      const existingPicks = createMockDailyPicks({
        userPicks: [
          createMockPick({ gameId: '789', type: 'user-pick' }),
          createMockPick({ gameId: '790', type: 'user-pick' }),
        ],
      });

      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({ [getTodayDateString()]: existingPicks })
      );

      await removeUserPick('789');

      const savedData = JSON.parse(
        (mockAsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      const today = getTodayDateString();
      expect(savedData[today].userPicks).toHaveLength(1);
      expect(savedData[today].userPicks[0].gameId).toBe('790');
    });
  });

  describe('updatePickOutcomes', () => {
    it('should update pick outcomes based on game results', async () => {
      const picks = createMockDailyPicks({
        date: '2024-01-01',
        lock: createMockPick({ gameId: '123', predictedWinner: 'TOR' }),
        smartPicks: [
          createMockPick({ gameId: '456', predictedWinner: 'BOS' }),
        ],
      });

      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({ '2024-01-01': picks })
      );

      const gameResults = [
        { gameId: '123', winner: 'TOR' }, // Lock wins
        { gameId: '456', winner: 'NYR' }, // Smart pick loses
      ];

      await updatePickOutcomes('2024-01-01', gameResults);

      const savedData = JSON.parse(
        (mockAsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedData['2024-01-01'].lock.outcome).toBe('win');
      expect(savedData['2024-01-01'].smartPicks[0].outcome).toBe('loss');
    });

    it('should handle tie games as pushes', async () => {
      const picks = createMockDailyPicks({
        date: '2024-01-01',
        lock: createMockPick({ gameId: '123', predictedWinner: 'TOR' }),
      });

      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({ '2024-01-01': picks })
      );

      const gameResults = [{ gameId: '123', winner: 'tie' }];

      await updatePickOutcomes('2024-01-01', gameResults);

      const savedData = JSON.parse(
        (mockAsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedData['2024-01-01'].lock.outcome).toBe('push');
    });

    it('should not update picks that already have outcomes', async () => {
      const picks = createMockDailyPicks({
        date: '2024-01-01',
        lock: createWinningPick({ gameId: '123' }),
      });

      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({ '2024-01-01': picks })
      );

      const gameResults = [{ gameId: '123', winner: 'MTL' }];

      await updatePickOutcomes('2024-01-01', gameResults);

      const savedData = JSON.parse(
        (mockAsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      // Should still be 'win', not updated to 'loss'
      expect(savedData['2024-01-01'].lock.outcome).toBe('win');
    });
  });

  describe('getTodaysPicks', () => {
    it('should return today\'s picks', async () => {
      const todaysPicks = createMockDailyPicks();

      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({ [getTodayDateString()]: todaysPicks })
      );

      const result = await getTodaysPicks();

      expect(result).not.toBeNull();
      expect(result?.lock).toBeDefined();
      expect(result?.smartPicks).toHaveLength(2);
    });

    it('should return null when no picks exist for today', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({}));

      const result = await getTodaysPicks();

      expect(result).toBeNull();
    });
  });

  describe('getAllPicks', () => {
    it('should return all picks sorted by date (most recent first)', async () => {
      const mockData = {
        '2024-01-01': {
          date: '2024-01-01',
          smartPicks: [createMockPick({ date: '2024-01-01', gameId: '1' })],
          userPicks: [],
        },
        '2024-01-03': {
          date: '2024-01-03',
          smartPicks: [createMockPick({ date: '2024-01-03', gameId: '3' })],
          userPicks: [],
        },
        '2024-01-02': {
          date: '2024-01-02',
          smartPicks: [createMockPick({ date: '2024-01-02', gameId: '2' })],
          userPicks: [],
        },
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockData));

      const result = await getAllPicks();

      expect(result.length).toBeGreaterThan(0);
      // Check that dates are sorted in descending order
      expect(result[0].date).toBe('2024-01-03');
      expect(result[result.length - 1].date).toBe('2024-01-01');
    });

    it('should include lock, smart picks, and user picks', async () => {
      const mockData = {
        '2024-01-01': createMockDailyPicks({
          date: '2024-01-01',
          lock: createMockPick({ type: 'lock', gameId: 'lock-1' }),
          smartPicks: [createMockPick({ type: 'smart-pick', gameId: 'smart-1' })],
          userPicks: [createMockPick({ type: 'user-pick', gameId: 'user-1' })],
        }),
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockData));

      const result = await getAllPicks();

      expect(result).toHaveLength(3);
      expect(result.some(p => p.type === 'lock')).toBe(true);
      expect(result.some(p => p.type === 'smart-pick')).toBe(true);
      expect(result.some(p => p.type === 'user-pick')).toBe(true);
    });
  });

  describe('getUserPickStats, getSmartPickStats, getLockStats', () => {
    beforeEach(() => {
      const mockData = {
        '2024-01-01': createMockDailyPicks({
          date: '2024-01-01',
          lock: createWinningPick({ type: 'lock' }),
          smartPicks: [
            createWinningPick({ type: 'smart-pick' }),
            createLosingPick({ type: 'smart-pick' }),
          ],
          userPicks: [
            createWinningPick({ type: 'user-pick' }),
            createWinningPick({ type: 'user-pick' }),
            createLosingPick({ type: 'user-pick' }),
          ],
        }),
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockData));
    });

    it('should calculate user pick stats correctly', async () => {
      const stats = await getUserPickStats();

      expect(stats.total).toBe(3);
      expect(stats.wins).toBe(2);
      expect(stats.losses).toBe(1);
      expect(stats.accuracy).toBe(67);
    });

    it('should calculate smart pick stats correctly', async () => {
      const stats = await getSmartPickStats();

      expect(stats.total).toBe(2);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(1);
      expect(stats.accuracy).toBe(50);
    });

    it('should calculate lock pick stats correctly', async () => {
      const stats = await getLockStats();

      expect(stats.total).toBe(1);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(0);
      expect(stats.accuracy).toBe(100);
    });
  });
});
