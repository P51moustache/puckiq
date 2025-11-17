/**
 * Tests for prediction accuracy tracking over time
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveDailyAccuracy,
  getAccuracyHistory,
  getAccuracyTrends,
  calculateTrendDirection,
} from '../accuracyTracking';
import type { DailyAccuracy, AccuracyTrend } from '../../types/predictions';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('accuracyTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveDailyAccuracy', () => {
    it('should save daily accuracy to AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const dailyAccuracy: DailyAccuracy = {
        date: '2024-11-15',
        lockCorrect: true,
        smartPicksCorrect: 3,
        smartPicksTotal: 4,
        overallAccuracy: 80,
      };

      await saveDailyAccuracy(dailyAccuracy);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'puckiq_prediction_accuracy_history',
        JSON.stringify({ '2024-11-15': dailyAccuracy })
      );
    });

    it('should append to existing accuracy history', async () => {
      const existingData = {
        '2024-11-14': {
          date: '2024-11-14',
          lockCorrect: false,
          smartPicksCorrect: 2,
          smartPicksTotal: 4,
          overallAccuracy: 40,
        },
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(existingData));

      const newAccuracy: DailyAccuracy = {
        date: '2024-11-15',
        lockCorrect: true,
        smartPicksCorrect: 3,
        smartPicksTotal: 4,
        overallAccuracy: 80,
      };

      await saveDailyAccuracy(newAccuracy);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'puckiq_prediction_accuracy_history',
        JSON.stringify({
          '2024-11-14': existingData['2024-11-14'],
          '2024-11-15': newAccuracy,
        })
      );
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      const dailyAccuracy: DailyAccuracy = {
        date: '2024-11-15',
        lockCorrect: true,
        smartPicksCorrect: 3,
        smartPicksTotal: 4,
        overallAccuracy: 80,
      };

      await expect(saveDailyAccuracy(dailyAccuracy)).rejects.toThrow();
    });
  });

  describe('getAccuracyHistory', () => {
    it('should retrieve accuracy history from AsyncStorage', async () => {
      const mockData = {
        '2024-11-14': {
          date: '2024-11-14',
          lockCorrect: false,
          smartPicksCorrect: 2,
          smartPicksTotal: 4,
          overallAccuracy: 40,
        },
        '2024-11-15': {
          date: '2024-11-15',
          lockCorrect: true,
          smartPicksCorrect: 3,
          smartPicksTotal: 4,
          overallAccuracy: 80,
        },
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockData));

      const history = await getAccuracyHistory();

      expect(history).toEqual(mockData);
    });

    it('should return empty object when no history exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const history = await getAccuracyHistory();

      expect(history).toEqual({});
    });

    it('should handle AsyncStorage errors', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      const history = await getAccuracyHistory();

      expect(history).toEqual({});
    });
  });

  describe('calculateTrendDirection', () => {
    it('should detect improving trend', () => {
      const trend = calculateTrendDirection(75, 65, 60);
      expect(trend).toBe('improving');
    });

    it('should detect declining trend', () => {
      const trend = calculateTrendDirection(60, 70, 75);
      expect(trend).toBe('declining');
    });

    it('should detect stable trend when within 5%', () => {
      const trend = calculateTrendDirection(70, 68, 72);
      expect(trend).toBe('stable');
    });

    it('should detect stable trend when exactly same', () => {
      const trend = calculateTrendDirection(70, 70, 70);
      expect(trend).toBe('stable');
    });

    it('should handle edge case with 0 accuracy', () => {
      const trend = calculateTrendDirection(0, 0, 0);
      expect(trend).toBe('stable');
    });

    it('should handle trend with missing historical data (use 50% default)', () => {
      const trend = calculateTrendDirection(60, 50, 50);
      expect(trend).toBe('improving');
    });
  });

  describe('getAccuracyTrends', () => {
    it('should calculate trends correctly with sufficient data', async () => {
      const mockHistory = {
        '2024-11-01': { date: '2024-11-01', lockCorrect: true, smartPicksCorrect: 3, smartPicksTotal: 4, overallAccuracy: 80 },
        '2024-11-02': { date: '2024-11-02', lockCorrect: false, smartPicksCorrect: 2, smartPicksTotal: 4, overallAccuracy: 40 },
        '2024-11-03': { date: '2024-11-03', lockCorrect: true, smartPicksCorrect: 4, smartPicksTotal: 4, overallAccuracy: 100 },
        '2024-11-04': { date: '2024-11-04', lockCorrect: true, smartPicksCorrect: 3, smartPicksTotal: 4, overallAccuracy: 80 },
        '2024-11-05': { date: '2024-11-05', lockCorrect: true, smartPicksCorrect: 3, smartPicksTotal: 4, overallAccuracy: 80 },
        '2024-11-06': { date: '2024-11-06', lockCorrect: false, smartPicksCorrect: 2, smartPicksTotal: 4, overallAccuracy: 40 },
        '2024-11-07': { date: '2024-11-07', lockCorrect: true, smartPicksCorrect: 4, smartPicksTotal: 4, overallAccuracy: 100 },
        '2024-11-08': { date: '2024-11-08', lockCorrect: true, smartPicksCorrect: 3, smartPicksTotal: 4, overallAccuracy: 80 },
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockHistory));

      const trends = await getAccuracyTrends(30);

      expect(trends.history).toHaveLength(8);
      expect(trends.currentAccuracy).toBe(80); // Most recent
      expect(trends.last7DaysAvg).toBeGreaterThan(0);
      expect(trends.last30DaysAvg).toBeGreaterThan(0);
      expect(['improving', 'declining', 'stable']).toContain(trends.trend);
    });

    it('should handle empty history', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const trends = await getAccuracyTrends(30);

      expect(trends.currentAccuracy).toBe(0);
      expect(trends.last7DaysAvg).toBe(0);
      expect(trends.last30DaysAvg).toBe(0);
      expect(trends.trend).toBe('stable');
      expect(trends.history).toEqual([]);
    });

    it('should limit history to requested days', async () => {
      const mockHistory: Record<string, DailyAccuracy> = {};
      for (let i = 1; i <= 40; i++) {
        const date = `2024-11-${String(i).padStart(2, '0')}`;
        mockHistory[date] = {
          date,
          lockCorrect: true,
          smartPicksCorrect: 3,
          smartPicksTotal: 4,
          overallAccuracy: 80,
        };
      }

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockHistory));

      const trends = await getAccuracyTrends(10);

      expect(trends.history.length).toBeLessThanOrEqual(10);
    });

    it('should calculate 7-day average correctly', async () => {
      const mockHistory = {
        '2024-11-01': { date: '2024-11-01', lockCorrect: true, smartPicksCorrect: 4, smartPicksTotal: 4, overallAccuracy: 100 },
        '2024-11-02': { date: '2024-11-02', lockCorrect: true, smartPicksCorrect: 4, smartPicksTotal: 4, overallAccuracy: 100 },
        '2024-11-03': { date: '2024-11-03', lockCorrect: true, smartPicksCorrect: 4, smartPicksTotal: 4, overallAccuracy: 100 },
        '2024-11-04': { date: '2024-11-04', lockCorrect: true, smartPicksCorrect: 4, smartPicksTotal: 4, overallAccuracy: 100 },
        '2024-11-05': { date: '2024-11-05', lockCorrect: true, smartPicksCorrect: 4, smartPicksTotal: 4, overallAccuracy: 100 },
        '2024-11-06': { date: '2024-11-06', lockCorrect: true, smartPicksCorrect: 4, smartPicksTotal: 4, overallAccuracy: 100 },
        '2024-11-07': { date: '2024-11-07', lockCorrect: true, smartPicksCorrect: 4, smartPicksTotal: 4, overallAccuracy: 100 },
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockHistory));

      const trends = await getAccuracyTrends(30);

      expect(trends.last7DaysAvg).toBe(100);
    });
  });
});
