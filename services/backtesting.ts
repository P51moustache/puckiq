/**
 * Backtesting Service
 * Runs prediction models against historical game data to measure accuracy
 *
 * Performance target: 1000+ games in <10 seconds using cached data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  PredictionModel,
  StandingsData,
  TeamStandings,
  ConfidenceWeights,
  PlayerWeights,
} from '../types/predictions';
import { createDefaultModel } from './modelStorage';
import { supabase } from '../lib/supabase';

interface HistoricalGame {
  id: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  winner: 'home' | 'away';
  homeGoalie?: string;
  awayGoalie?: string;
}

/** Internal implementation — exposed via `deps` for testability */
async function _getGamesInRangeImpl(startDate: string, endDate: string): Promise<HistoricalGame[]> {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('id, game_date, home_team_abbrev, away_team_abbrev, home_score, away_score, period_type')
      .gte('game_date', startDate)
      .lte('game_date', endDate)
      .in('game_state', ['FINAL', 'OFF'])
      .eq('game_type', 2) // regular season only
      .order('game_date');

    if (error) {
      console.error('[BACKTEST] Supabase error fetching games:', error.message);
      return [];
    }

    if (!data || data.length === 0) {
      console.warn(`[BACKTEST] No games found in Supabase for ${startDate} to ${endDate}`);
      return [];
    }

    const games: HistoricalGame[] = data.map((row) => ({
      id: row.id,
      date: row.game_date,
      homeTeam: row.home_team_abbrev,
      awayTeam: row.away_team_abbrev,
      homeScore: row.home_score ?? 0,
      awayScore: row.away_score ?? 0,
      winner: (row.home_score ?? 0) > (row.away_score ?? 0) ? 'home' as const : 'away' as const,
    }));

    console.log(`[BACKTEST] Fetched ${games.length} games from Supabase (${startDate} to ${endDate})`);
    return games;
  } catch (err) {
    console.error('[BACKTEST] Error fetching games from Supabase:', err);
    return [];
  }
}

/** Mockable dependency bag for testing */
export const deps = {
  getGamesInRange: _getGamesInRangeImpl,
};

export async function getGamesInRange(startDate: string, endDate: string): Promise<HistoricalGame[]> {
  return deps.getGamesInRange(startDate, endDate);
}

// Storage keys
const STANDINGS_CACHE_PREFIX = 'puckiq_standings_cache_';
const BACKTEST_CACHE_KEY = 'puckiq_backtest_cache';

// Cache TTL for standings (1 week - historical standings don't change)
const STANDINGS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

/**
 * Individual game result in a backtest
 */
export interface BacktestGameResult {
  gameId: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  actualWinner: 'home' | 'away';
  predictedWinner: 'home' | 'away';
  confidenceScore: number;
  isCorrect: boolean;
}

/**
 * Complete backtest results
 */
export interface BacktestResults {
  modelId: string;
  modelName: string;
  dateRange: {
    start: string;
    end: string;
  };
  totalGames: number;
  correctPicks: number;
  accuracy: number;           // 0-100 percentage
  baselineAccuracy: number;   // Classic model accuracy for comparison
  improvement: number;        // Difference from baseline (can be negative)
  results: BacktestGameResult[];
  ranAt: string;              // ISO timestamp
  durationMs: number;         // How long the backtest took
}

/**
 * Progress callback for backtest operations
 */
export type BacktestProgressCallback = (progress: {
  currentGame: number;
  totalGames: number;
  currentDate: string;
  percentComplete: number;
}) => void;

/**
 * Cached standings entry
 */
interface CachedStandings {
  date: string;
  standings: TeamStandings[];
  cachedAt: string;
}

/**
 * Cached backtest results
 */
interface BacktestCache {
  [key: string]: {
    results: BacktestResults;
    cachedAt: string;
  };
}

/**
 * Generate a hash from weights to include in cache key
 * This ensures different weight configurations get different cache entries
 */
function hashWeights(weights: ConfidenceWeights, playerWeights: PlayerWeights): string {
  const weightValues = [
    weights.standingsDifferential,
    weights.homeIceAdvantage,
    weights.streakImpact,
    weights.goalDifferentialImpact,
    weights.recentFormImpact,
    weights.backToBackPenalty,
    weights.restAdvantage,
    weights.specialTeamsImpact,
    weights.shotDifferentialImpact,
    playerWeights.goalieMatchupImpact,
    playerWeights.hotPlayersImpact,
  ];
  // Simple hash: join values and take first 8 chars of base36 representation
  const sum = weightValues.reduce((acc, val) => acc + val * 1000, 0);
  return Math.abs(sum).toString(36).substring(0, 8);
}

/**
 * Generate a cache key for backtest results
 * Includes weights hash so different configurations get different cache entries
 */
function getBacktestCacheKey(
  modelId: string,
  startDate: string,
  endDate: string,
  weightsHash: string
): string {
  return `${modelId}_${startDate}_${endDate}_${weightsHash}`;
}

/**
 * Get cached standings for a specific date
 */
async function getCachedStandings(date: string): Promise<TeamStandings[] | null> {
  try {
    const key = `${STANDINGS_CACHE_PREFIX}${date}`;
    const json = await AsyncStorage.getItem(key);

    if (!json) return null;

    const cached: CachedStandings = JSON.parse(json);

    // Check if cache is still valid
    const cachedTime = new Date(cached.cachedAt).getTime();
    if (Date.now() - cachedTime > STANDINGS_CACHE_TTL) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return cached.standings;
  } catch (error) {
    console.error(`[BACKTEST] Error getting cached standings for ${date}:`, error);
    return null;
  }
}

/**
 * Cache standings for a specific date
 */
async function cacheStandings(date: string, standings: TeamStandings[]): Promise<void> {
  try {
    const key = `${STANDINGS_CACHE_PREFIX}${date}`;
    const cached: CachedStandings = {
      date,
      standings,
      cachedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(cached));
  } catch (error) {
    console.error(`[BACKTEST] Error caching standings for ${date}:`, error);
  }
}

/**
 * Fetch standings as of a specific date
 * Primary: Supabase (exact date match, then closest prior date)
 * Fallback: NHL API
 */
async function fetchStandingsForDate(date: string): Promise<TeamStandings[] | null> {
  try {
    // First check AsyncStorage cache
    const cached = await getCachedStandings(date);
    if (cached) {
      return cached;
    }

    // Try Supabase — exact date match
    const { data: exactData, error: exactError } = await supabase
      .from('standings')
      .select('*')
      .eq('snapshot_date', date);

    if (!exactError && exactData && exactData.length > 0) {
      const standings = mapSupabaseStandings(exactData);
      if (standings.length > 0) {
        await cacheStandings(date, standings);
        return standings;
      }
    }

    // Supabase — closest prior date (up to 32 teams)
    const { data: nearData, error: nearError } = await supabase
      .from('standings')
      .select('*')
      .lte('snapshot_date', date)
      .order('snapshot_date', { ascending: false })
      .limit(32);

    if (!nearError && nearData && nearData.length > 0) {
      const standings = mapSupabaseStandings(nearData);
      if (standings.length > 0) {
        await cacheStandings(date, standings);
        return standings;
      }
    }

    // Supabase-only: no NHL API fallback (deprecated service)
    console.warn(`[BACKTEST] No Supabase standings data for ${date}`);
    return null;
  } catch (error) {
    console.error(`[BACKTEST] Error fetching standings for ${date}:`, error);
    return null;
  }
}

/**
 * Map Supabase standings rows to TeamStandings interface
 */
function mapSupabaseStandings(rows: Record<string, unknown>[]): TeamStandings[] {
  return rows.map((row) => ({
    teamAbbrev: row.team_abbrev as string,
    pointPctg: row.point_pctg as number | undefined,
    wins: row.wins as number | undefined,
    losses: row.losses as number | undefined,
    otLosses: row.ot_losses as number | undefined,
    points: row.points as number | undefined,
    goalFor: row.goals_for as number | undefined,
    goalAgainst: row.goals_against as number | undefined,
    gamesPlayed: row.games_played as number | undefined,
    streakCode: row.streak_code
      ? `${row.streak_code}${row.streak_count ?? ''}`
      : undefined,
  }));
}

/**
 * Create a standings map from standings array for quick lookup
 */
function createStandingsMap(standings: TeamStandings[]): Map<string, TeamStandings> {
  const map = new Map<string, TeamStandings>();

  for (const team of standings) {
    const abbrev = typeof team.teamAbbrev === 'string'
      ? team.teamAbbrev
      : team.teamAbbrev?.default || '';

    if (abbrev) {
      map.set(abbrev, team);
    }
  }

  return map;
}

/**
 * Extract numeric value from streak code
 */
function getStreakValue(streakCode?: string): number {
  if (!streakCode) return 0;

  const isWin = streakCode.startsWith('W');
  const isLoss = streakCode.startsWith('L');
  const streakNum = parseInt(streakCode.substring(1)) || 0;

  const cappedStreak = Math.min(streakNum, 10);
  const scaledImpact = Math.pow(cappedStreak, 0.8);

  if (isWin) return scaledImpact;
  if (isLoss) return -scaledImpact;
  return 0;
}

/**
 * Calculate goal differential per game
 */
function getGoalDifferentialPerGame(team: TeamStandings): number {
  const gamesPlayed = team.gamesPlayed || 1;
  const goalDiff = (team.goalFor || 0) - (team.goalAgainst || 0);
  return goalDiff / gamesPlayed;
}

/**
 * Simplified confidence calculation for backtesting
 * Uses only standings data (no API calls) for performance
 */
function calculateBacktestConfidence(
  homeTeam: TeamStandings,
  awayTeam: TeamStandings,
  weights: ConfidenceWeights,
  _playerWeights: PlayerWeights
): number {
  let score = 50; // Base score

  // Factor 1: Standings differential
  const pointDiff = (homeTeam.pointPctg || 0.5) - (awayTeam.pointPctg || 0.5);
  score += pointDiff * weights.standingsDifferential;

  // Factor 2: Home ice advantage
  score += weights.homeIceAdvantage;

  // Factor 3: Win streaks
  const homeStreakValue = getStreakValue(homeTeam.streakCode);
  const awayStreakValue = getStreakValue(awayTeam.streakCode);
  score += (homeStreakValue - awayStreakValue) * weights.streakImpact;

  // Factor 4: Goal differential per game
  const homeGDPerGame = getGoalDifferentialPerGame(homeTeam);
  const awayGDPerGame = getGoalDifferentialPerGame(awayTeam);
  score += (homeGDPerGame - awayGDPerGame) * weights.goalDifferentialImpact;

  // Note: For backtesting, we skip factors that require API calls:
  // - Recent form (requires schedule API)
  // - Situational factors (requires schedule API)
  // - Special teams (requires stats API)
  // - Shot differential (requires stats API)
  // - Player factors (requires player API)
  //
  // This is intentional for performance - backtesting 1000+ games
  // must complete in <10 seconds. The core factors (standings, home ice,
  // streaks, goal diff) provide a good baseline for model comparison.

  // Normalize to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Predict a single game for backtesting
 */
function predictGameForBacktest(
  game: HistoricalGame,
  standingsMap: Map<string, TeamStandings>,
  weights: ConfidenceWeights,
  playerWeights: PlayerWeights
): { predictedWinner: 'home' | 'away'; confidenceScore: number } | null {
  const homeTeam = standingsMap.get(game.homeTeam);
  const awayTeam = standingsMap.get(game.awayTeam);

  if (!homeTeam || !awayTeam) {
    return null;
  }

  const confidenceScore = calculateBacktestConfidence(
    homeTeam,
    awayTeam,
    weights,
    playerWeights
  );

  // Score > 50 = home favored, < 50 = away favored
  const predictedWinner: 'home' | 'away' = confidenceScore >= 50 ? 'home' : 'away';

  return { predictedWinner, confidenceScore };
}

/**
 * Get cached backtest results if available
 */
async function getCachedBacktest(
  modelId: string,
  startDate: string,
  endDate: string,
  weightsHash: string
): Promise<BacktestResults | null> {
  try {
    const json = await AsyncStorage.getItem(BACKTEST_CACHE_KEY);
    if (!json) return null;

    const cache: BacktestCache = JSON.parse(json);
    const key = getBacktestCacheKey(modelId, startDate, endDate, weightsHash);
    const cached = cache[key];

    if (!cached) return null;

    // Backtest results are valid indefinitely (historical data doesn't change)
    return cached.results;
  } catch (error) {
    console.error('[BACKTEST] Error getting cached backtest:', error);
    return null;
  }
}

/**
 * Cache backtest results
 */
async function cacheBacktest(results: BacktestResults, weightsHash: string): Promise<void> {
  try {
    const json = await AsyncStorage.getItem(BACKTEST_CACHE_KEY);
    const cache: BacktestCache = json ? JSON.parse(json) : {};

    const key = getBacktestCacheKey(
      results.modelId,
      results.dateRange.start,
      results.dateRange.end,
      weightsHash
    );

    cache[key] = {
      results,
      cachedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(BACKTEST_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('[BACKTEST] Error caching backtest results:', error);
  }
}

/**
 * Clear backtest cache
 */
export async function clearBacktestCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BACKTEST_CACHE_KEY);
    console.log('[BACKTEST] Cleared backtest cache');
  } catch (error) {
    console.error('[BACKTEST] Error clearing backtest cache:', error);
  }
}

/**
 * Run a backtest for a model against historical games
 *
 * @param model - The prediction model to test
 * @param dateRange - Date range to test (YYYY-MM-DD format)
 * @param onProgress - Optional progress callback
 * @returns Backtest results including accuracy comparison to Classic baseline
 */
export async function runBacktest(
  model: PredictionModel,
  dateRange: { start: string; end: string },
  onProgress?: BacktestProgressCallback,
  skipCache: boolean = false
): Promise<BacktestResults> {
  const startTime = Date.now();

  // Generate weights hash for cache key (ensures different weights = different cache entries)
  const weightsHash = hashWeights(model.weights, model.playerWeights);

  console.log(`[BACKTEST] Starting backtest for model "${model.name}" from ${dateRange.start} to ${dateRange.end}`);
  console.log(`[BACKTEST] Weights hash: ${weightsHash}, Home Ice: ${model.weights.homeIceAdvantage}, Standings: ${model.weights.standingsDifferential}, skipCache: ${skipCache}`);

  // Check cache first (unless skipCache is true - used during model editing for fresh results)
  if (!skipCache) {
    const cachedResults = await getCachedBacktest(model.id, dateRange.start, dateRange.end, weightsHash);
    if (cachedResults) {
      console.log(`[BACKTEST] Using cached results for model "${model.name}" (hash: ${weightsHash})`);
      return cachedResults;
    }
  }

  console.log(`[BACKTEST] Running fresh backtest (skipCache: ${skipCache})`);

  // Get historical games
  const games = await deps.getGamesInRange(dateRange.start, dateRange.end);

  if (games.length === 0) {
    console.warn('[BACKTEST] No games found in date range');
    return {
      modelId: model.id,
      modelName: model.name,
      dateRange,
      totalGames: 0,
      correctPicks: 0,
      accuracy: 0,
      baselineAccuracy: 0,
      improvement: 0,
      results: [],
      ranAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }

  // Get Classic model for baseline comparison
  const classicModel = createDefaultModel();

  // Group games by date for efficient standings fetching
  const gamesByDate = new Map<string, HistoricalGame[]>();
  for (const game of games) {
    const dateGames = gamesByDate.get(game.date) || [];
    dateGames.push(game);
    gamesByDate.set(game.date, dateGames);
  }

  // Pre-fetch all standings (batch for efficiency)
  const standingsByDate = new Map<string, Map<string, TeamStandings>>();
  const dates = Array.from(gamesByDate.keys()).sort();

  // Batch fetch standings
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const standings = await fetchStandingsForDate(date);

    if (standings) {
      standingsByDate.set(date, createStandingsMap(standings));
    }

    // Small yield to prevent blocking
    if (i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Process all games
  const results: BacktestGameResult[] = [];
  let modelCorrect = 0;
  let baselineCorrect = 0;
  let processedGames = 0;

  for (const [date, dateGames] of gamesByDate) {
    const standingsMap = standingsByDate.get(date);

    if (!standingsMap) {
      continue;
    }

    for (const game of dateGames) {
      processedGames++;

      // Report progress
      if (onProgress) {
        onProgress({
          currentGame: processedGames,
          totalGames: games.length,
          currentDate: date,
          percentComplete: Math.round((processedGames / games.length) * 100),
        });
      }

      // Predict with the model being tested
      const modelPrediction = predictGameForBacktest(
        game,
        standingsMap,
        model.weights,
        model.playerWeights
      );

      // Predict with Classic model for baseline
      const baselinePrediction = predictGameForBacktest(
        game,
        standingsMap,
        classicModel.weights,
        classicModel.playerWeights
      );

      if (!modelPrediction || !baselinePrediction) {
        continue;
      }

      const isCorrect = modelPrediction.predictedWinner === game.winner;
      const baselineIsCorrect = baselinePrediction.predictedWinner === game.winner;

      if (isCorrect) modelCorrect++;
      if (baselineIsCorrect) baselineCorrect++;

      results.push({
        gameId: game.id,
        date: game.date,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        actualWinner: game.winner,
        predictedWinner: modelPrediction.predictedWinner,
        confidenceScore: modelPrediction.confidenceScore,
        isCorrect,
      });
    }
  }

  const totalGames = results.length;
  const accuracy = totalGames > 0 ? Math.round((modelCorrect / totalGames) * 1000) / 10 : 0;
  const baselineAccuracy = totalGames > 0 ? Math.round((baselineCorrect / totalGames) * 1000) / 10 : 0;
  const improvement = Math.round((accuracy - baselineAccuracy) * 10) / 10;

  const backtestResults: BacktestResults = {
    modelId: model.id,
    modelName: model.name,
    dateRange,
    totalGames,
    correctPicks: modelCorrect,
    accuracy,
    baselineAccuracy,
    improvement,
    results,
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };

  // Cache the results (with weights hash so different configurations are cached separately)
  await cacheBacktest(backtestResults, weightsHash);

  console.log(`[BACKTEST] Completed in ${backtestResults.durationMs}ms. Model: ${accuracy}%, Baseline: ${baselineAccuracy}%`);

  return backtestResults;
}

/**
 * Get a summary of backtest results without full game results
 * Useful for displaying in UI without loading all data
 */
export function getBacktestSummary(results: BacktestResults): Omit<BacktestResults, 'results'> & { results: undefined } {
  return {
    ...results,
    results: undefined,
  };
}

/**
 * Calculate accuracy for a specific confidence range
 * Useful for analyzing model performance at different confidence levels
 */
export function getAccuracyByConfidenceRange(
  results: BacktestGameResult[],
  ranges: { min: number; max: number; label: string }[]
): { label: string; games: number; correct: number; accuracy: number }[] {
  return ranges.map(range => {
    const gamesInRange = results.filter(
      r => r.confidenceScore >= range.min && r.confidenceScore < range.max
    );
    const correct = gamesInRange.filter(r => r.isCorrect).length;
    const accuracy = gamesInRange.length > 0
      ? Math.round((correct / gamesInRange.length) * 1000) / 10
      : 0;

    return {
      label: range.label,
      games: gamesInRange.length,
      correct,
      accuracy,
    };
  });
}

/**
 * Default confidence ranges for analysis
 */
export const DEFAULT_CONFIDENCE_RANGES = [
  { min: 0, max: 45, label: 'Away Strong (0-45)' },
  { min: 45, max: 48, label: 'Away Slight (45-48)' },
  { min: 48, max: 52, label: 'Toss-up (48-52)' },
  { min: 52, max: 55, label: 'Home Slight (52-55)' },
  { min: 55, max: 100, label: 'Home Strong (55+)' },
];

/**
 * Clear standings cache (for debugging/testing)
 */
export async function clearStandingsCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const standingsKeys = keys.filter(k => k.startsWith(STANDINGS_CACHE_PREFIX));

    if (standingsKeys.length > 0) {
      await AsyncStorage.multiRemove(standingsKeys);
      console.log(`[BACKTEST] Cleared ${standingsKeys.length} standings cache entries`);
    }
  } catch (error) {
    console.error('[BACKTEST] Error clearing standings cache:', error);
  }
}
