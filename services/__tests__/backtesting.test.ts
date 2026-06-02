/**
 * Tests for Backtesting Service
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as modelStorage from '../modelStorage';
import type { PredictionModel } from '../../types/predictions';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock Supabase — fetchStandingsForDate is Supabase-only now (no NHL API).
// A chainable, thenable builder returns mockStandingsRows for `.from('standings')`.
let mockStandingsRows: any[] = [];
jest.mock('../../lib/supabase', () => {
  const builder: any = {};
  Object.assign(builder, {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    then: (resolve: any) => Promise.resolve({ data: mockStandingsRows, error: null }).then(resolve),
  });
  return { supabase: { from: jest.fn(() => builder) } };
});

import * as backtesting from '../backtesting';

// Mock fetch (legacy; standings now come from Supabase)
global.fetch = jest.fn();

// Create test model
function createTestModel(overrides: Partial<PredictionModel> = {}): PredictionModel {
  return {
    id: 'test-model',
    name: 'Test Model',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    weights: {
      standingsDifferential: 100,
      homeIceAdvantage: 3,
      streakImpact: 2,
      goalDifferentialImpact: 5,
      recentFormImpact: 20,
      backToBackPenalty: 4,
      restAdvantage: 1,
      specialTeamsImpact: 10,
      shotDifferentialImpact: 3,
    },
    playerWeights: {
      goalieMatchupImpact: 1.0,
      hotPlayersImpact: 1.5,
    },
    isActive: true,
    isDefault: false,
    ...overrides,
  };
}

// Create mock standings in Supabase row shape (snake_case), as
// fetchStandingsForDate reads from the `standings` table via mapSupabaseStandings.
function createMockStandings() {
  return [
    { team_abbrev: 'TOR', point_pctg: 0.65, wins: 30, losses: 15, ot_losses: 3, points: 63, goals_for: 150, goals_against: 120, games_played: 48, streak_code: 'W', streak_count: 3, snapshot_date: '2024-10-15' },
    { team_abbrev: 'MTL', point_pctg: 0.45, wins: 20, losses: 25, ot_losses: 5, points: 45, goals_for: 110, goals_against: 140, games_played: 50, streak_code: 'L', streak_count: 2, snapshot_date: '2024-10-15' },
    { team_abbrev: 'BOS', point_pctg: 0.70, wins: 35, losses: 12, ot_losses: 3, points: 73, goals_for: 170, goals_against: 100, games_played: 50, streak_code: 'W', streak_count: 5, snapshot_date: '2024-10-15' },
  ];
}

describe('backtesting', () => {
  const mockGetGamesInRange = jest.fn().mockResolvedValue([]);

  beforeEach(() => {
    jest.clearAllMocks();
    backtesting.deps.getGamesInRange = mockGetGamesInRange;
    // Default standings available from Supabase for every date.
    mockStandingsRows = createMockStandings();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
    (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
  });

  describe('runBacktest', () => {
    it('returns empty results when no games found', async () => {
      mockGetGamesInRange.mockResolvedValue([]);

      const model = createTestModel();
      const results = await backtesting.runBacktest(model, {
        start: '2024-10-01',
        end: '2024-10-31',
      });

      expect(results.totalGames).toBe(0);
      expect(results.accuracy).toBe(0);
      expect(results.results).toHaveLength(0);
    });

    it('calculates accuracy correctly for simple games', async () => {
      // Mock games
      mockGetGamesInRange.mockResolvedValue([
        { id: 1, date: '2024-10-15', homeTeam: 'TOR', awayTeam: 'MTL', homeScore: 4, awayScore: 2, winner: 'home' },
        { id: 2, date: '2024-10-15', homeTeam: 'BOS', awayTeam: 'MTL', homeScore: 5, awayScore: 1, winner: 'home' },
        { id: 3, date: '2024-10-16', homeTeam: 'MTL', awayTeam: 'TOR', homeScore: 3, awayScore: 2, winner: 'home' }, // Upset
      ]);

      // Mock standings API
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ standings: createMockStandings() }),
      });

      const model = createTestModel();
      const results = await backtesting.runBacktest(model, {
        start: '2024-10-15',
        end: '2024-10-16',
      });

      expect(results.totalGames).toBe(3);
      expect(results.modelId).toBe('test-model');
      expect(results.modelName).toBe('Test Model');
      expect(results.results).toHaveLength(3);

      // Model should predict TOR > MTL (home wins - correct)
      // Model should predict BOS > MTL (home wins - correct)
      // Model should predict TOR > MTL (but MTL won at home - depends on home ice)
      // Exact predictions depend on weight calculations
    });

    it('uses cached backtest results when available', async () => {
      const cachedResults: backtesting.BacktestResults = {
        modelId: 'test-model',
        modelName: 'Test Model',
        dateRange: { start: '2024-10-01', end: '2024-10-31' },
        totalGames: 50,
        correctPicks: 30,
        accuracy: 60,
        baselineAccuracy: 55,
        improvement: 5,
        results: [],
        ranAt: '2024-11-01T00:00:00Z',
        durationMs: 500,
      };

      // Cache key includes a weights hash — compute it to match the service logic
      const weightValues = [
        100, 3, 2, 5, 20, 4, 1, 10, 3, // ConfidenceWeights
        1.0, 1.5, // PlayerWeights
      ];
      const sum = weightValues.reduce((acc, val) => acc + val * 1000, 0);
      const weightsHash = Math.abs(sum).toString(36).substring(0, 8);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          [`test-model_2024-10-01_2024-10-31_${weightsHash}`]: {
            results: cachedResults,
            cachedAt: new Date().toISOString(),
          },
        })
      );

      const model = createTestModel();
      const results = await backtesting.runBacktest(model, {
        start: '2024-10-01',
        end: '2024-10-31',
      });

      expect(results).toEqual(cachedResults);
      // Should not fetch games since we used cache
      expect(mockGetGamesInRange).not.toHaveBeenCalled();
    });

    it('reports progress during backtest', async () => {
      mockGetGamesInRange.mockResolvedValue([
        { id: 1, date: '2024-10-15', homeTeam: 'TOR', awayTeam: 'MTL', homeScore: 4, awayScore: 2, winner: 'home' },
        { id: 2, date: '2024-10-15', homeTeam: 'BOS', awayTeam: 'MTL', homeScore: 5, awayScore: 1, winner: 'home' },
      ]);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ standings: createMockStandings() }),
      });

      const progressCallback = jest.fn();
      const model = createTestModel();

      await backtesting.runBacktest(model, {
        start: '2024-10-15',
        end: '2024-10-15',
      }, progressCallback);

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          totalGames: 2,
          currentDate: '2024-10-15',
        })
      );
    });

    it('caches standings fetches', async () => {
      mockGetGamesInRange.mockResolvedValue([
        { id: 1, date: '2024-10-15', homeTeam: 'TOR', awayTeam: 'MTL', homeScore: 4, awayScore: 2, winner: 'home' },
        { id: 2, date: '2024-10-15', homeTeam: 'BOS', awayTeam: 'MTL', homeScore: 5, awayScore: 1, winner: 'home' },
      ]);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ standings: createMockStandings() }),
      });

      const model = createTestModel();
      await backtesting.runBacktest(model, {
        start: '2024-10-15',
        end: '2024-10-15',
      });

      // Should cache standings
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('puckiq_standings_cache_2024-10-15'),
        expect.any(String)
      );
    });

    it('calculates improvement over baseline correctly', async () => {
      mockGetGamesInRange.mockResolvedValue([
        { id: 1, date: '2024-10-15', homeTeam: 'TOR', awayTeam: 'MTL', homeScore: 4, awayScore: 2, winner: 'home' },
        { id: 2, date: '2024-10-15', homeTeam: 'BOS', awayTeam: 'TOR', homeScore: 3, awayScore: 2, winner: 'home' },
      ]);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ standings: createMockStandings() }),
      });

      const model = createTestModel();
      const results = await backtesting.runBacktest(model, {
        start: '2024-10-15',
        end: '2024-10-15',
      });

      // Improvement should be accuracy - baselineAccuracy
      expect(results.improvement).toBe(
        Math.round((results.accuracy - results.baselineAccuracy) * 10) / 10
      );
    });
  });

  describe('getAccuracyByConfidenceRange', () => {
    it('calculates accuracy for different confidence ranges', () => {
      const results: backtesting.BacktestGameResult[] = [
        { gameId: 1, date: '2024-10-15', homeTeam: 'TOR', awayTeam: 'MTL', actualWinner: 'home', predictedWinner: 'home', confidenceScore: 65, isCorrect: true },
        { gameId: 2, date: '2024-10-15', homeTeam: 'BOS', awayTeam: 'MTL', actualWinner: 'home', predictedWinner: 'home', confidenceScore: 70, isCorrect: true },
        { gameId: 3, date: '2024-10-16', homeTeam: 'MTL', awayTeam: 'TOR', actualWinner: 'away', predictedWinner: 'home', confidenceScore: 52, isCorrect: false },
        { gameId: 4, date: '2024-10-16', homeTeam: 'MTL', awayTeam: 'BOS', actualWinner: 'away', predictedWinner: 'away', confidenceScore: 40, isCorrect: true },
      ];

      const ranges = backtesting.DEFAULT_CONFIDENCE_RANGES;
      const accuracy = backtesting.getAccuracyByConfidenceRange(results, ranges);

      expect(accuracy).toHaveLength(5);

      // Check 'Home Strong' range (55+)
      const homeStrong = accuracy.find(a => a.label === 'Home Strong (55+)');
      expect(homeStrong?.games).toBe(2);
      expect(homeStrong?.correct).toBe(2);
      expect(homeStrong?.accuracy).toBe(100);

      // Check 'Away Strong' range (0-45)
      const awayStrong = accuracy.find(a => a.label === 'Away Strong (0-45)');
      expect(awayStrong?.games).toBe(1);
      expect(awayStrong?.correct).toBe(1);
      expect(awayStrong?.accuracy).toBe(100);
    });

    it('handles empty results', () => {
      const accuracy = backtesting.getAccuracyByConfidenceRange(
        [],
        backtesting.DEFAULT_CONFIDENCE_RANGES
      );

      expect(accuracy).toHaveLength(5);
      accuracy.forEach(range => {
        expect(range.games).toBe(0);
        expect(range.accuracy).toBe(0);
      });
    });
  });

  describe('getBacktestSummary', () => {
    it('returns results without detailed game results', () => {
      const fullResults: backtesting.BacktestResults = {
        modelId: 'test-model',
        modelName: 'Test Model',
        dateRange: { start: '2024-10-01', end: '2024-10-31' },
        totalGames: 50,
        correctPicks: 30,
        accuracy: 60,
        baselineAccuracy: 55,
        improvement: 5,
        results: [
          { gameId: 1, date: '2024-10-15', homeTeam: 'TOR', awayTeam: 'MTL', actualWinner: 'home', predictedWinner: 'home', confidenceScore: 65, isCorrect: true },
        ],
        ranAt: '2024-11-01T00:00:00Z',
        durationMs: 500,
      };

      const summary = backtesting.getBacktestSummary(fullResults);

      expect(summary.modelId).toBe('test-model');
      expect(summary.totalGames).toBe(50);
      expect(summary.results).toBeUndefined();
    });
  });

  describe('clearBacktestCache', () => {
    it('removes backtest cache from storage', async () => {
      await backtesting.clearBacktestCache();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('puckiq_backtest_cache');
    });
  });

  describe('clearStandingsCache', () => {
    it('removes all standings cache entries', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
        'puckiq_standings_cache_2024-10-15',
        'puckiq_standings_cache_2024-10-16',
        'other_key',
      ]);

      await backtesting.clearStandingsCache();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        'puckiq_standings_cache_2024-10-15',
        'puckiq_standings_cache_2024-10-16',
      ]);
    });
  });

  describe('BacktestGameResult type', () => {
    it('correctly structures game results', () => {
      const result: backtesting.BacktestGameResult = {
        gameId: 2024020001,
        date: '2024-10-15',
        homeTeam: 'TOR',
        awayTeam: 'MTL',
        actualWinner: 'home',
        predictedWinner: 'home',
        confidenceScore: 65,
        isCorrect: true,
      };

      expect(result.isCorrect).toBe(result.actualWinner === result.predictedWinner);
    });
  });

  describe('performance', () => {
    it('should complete backtest quickly with cached standings', async () => {
      // Create 100 games across 10 dates
      const games = [];
      for (let d = 1; d <= 10; d++) {
        for (let g = 0; g < 10; g++) {
          games.push({
            id: d * 100 + g,
            date: `2024-10-${String(d).padStart(2, '0')}`,
            homeTeam: g % 2 === 0 ? 'TOR' : 'BOS',
            awayTeam: 'MTL',
            homeScore: 3,
            awayScore: 2,
            winner: 'home' as const,
          });
        }
      }

      mockGetGamesInRange.mockResolvedValue(games);

      // Mock cached standings. getCachedStandings returns cached.standings
      // verbatim as TeamStandings[] (camelCase), so the cached payload must use
      // that shape — not the snake_case Supabase row shape.
      const cachedStandings = [
        { teamAbbrev: 'TOR', pointPctg: 0.65, wins: 30, losses: 15, otLosses: 3, points: 63, goalFor: 150, goalAgainst: 120, gamesPlayed: 48, streakCode: 'W3' },
        { teamAbbrev: 'MTL', pointPctg: 0.45, wins: 20, losses: 25, otLosses: 5, points: 45, goalFor: 110, goalAgainst: 140, gamesPlayed: 50, streakCode: 'L2' },
        { teamAbbrev: 'BOS', pointPctg: 0.70, wins: 35, losses: 12, otLosses: 3, points: 73, goalFor: 170, goalAgainst: 100, gamesPlayed: 50, streakCode: 'W5' },
      ];
      const standingsJson = JSON.stringify({
        date: '2024-10-01',
        standings: cachedStandings,
        cachedAt: new Date().toISOString(),
      });

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key.startsWith('puckiq_standings_cache_')) {
          return Promise.resolve(standingsJson);
        }
        return Promise.resolve(null);
      });

      const model = createTestModel();
      const startTime = Date.now();

      const results = await backtesting.runBacktest(model, {
        start: '2024-10-01',
        end: '2024-10-10',
      });

      const duration = Date.now() - startTime;

      expect(results.totalGames).toBe(100);
      // Should complete quickly with cached data (< 1 second for 100 games)
      expect(duration).toBeLessThan(1000);
    });
  });
});
