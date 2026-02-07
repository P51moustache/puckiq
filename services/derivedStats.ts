/**
 * Derived Stats Service
 * Calculates momentum, clutch rating, and rest advantage
 * from existing game_results data + standings.
 */

import type {
  MomentumData,
  MomentumTrend,
  ClutchRating,
  ClutchRatingLevel,
  EdgeQuickStats,
  NHLNameField,
} from '../types/edgeStats';
import type { GameResult } from '../types/gameResults';
import type { EdgeSkaterLanding } from '../types/edgeStats';

/** Game shape from NHL schedule API (used in buildEdgeQuickStats) */
interface ScheduleGame {
  homeTeam?: { abbrev?: string };
  awayTeam?: { abbrev?: string };
  [key: string]: unknown;
}

// ============================================
// Momentum Index
// ============================================

/**
 * Calculate momentum from last 5 completed games.
 * Score ranges from -10 (cold) to +10 (hot).
 * Trend arrow based on slope of recent goal differentials.
 */
export function calculateMomentum(
  teamAbbrev: string,
  gameResults: GameResult[]
): MomentumData {
  const DEFAULT: MomentumData = { score: 0, trend: '→', history: [], label: 'No data' };

  if (!gameResults?.length) return DEFAULT;

  // Filter completed games for this team, sorted by date desc
  const teamGames = gameResults
    .filter(
      (g) =>
        g.game_state === 'FINAL' || g.game_state === 'OFF'
    )
    .filter((g) => g.home_team === teamAbbrev || g.away_team === teamAbbrev)
    .sort((a, b) => new Date(b.game_date).getTime() - new Date(a.game_date).getTime())
    .slice(0, 5);

  if (teamGames.length === 0) return DEFAULT;

  // Calculate goal differentials (positive = team outscored)
  const diffs = teamGames.map((g) => {
    const isHome = g.home_team === teamAbbrev;
    return isHome ? g.home_score - g.away_score : g.away_score - g.home_score;
  });

  // Momentum score = sum of diffs, clamped to -10..+10
  const rawScore = diffs.reduce((sum, d) => sum + d, 0);
  const score = Math.max(-10, Math.min(10, rawScore));

  // Trend: compare first half vs second half
  const trend = calculateTrend(diffs);

  // Label
  const label = score >= 5 ? 'Surging' : score >= 2 ? 'Warming up' : score <= -5 ? 'Cold streak' : score <= -2 ? 'Cooling off' : 'Steady';

  return { score, trend, history: diffs.reverse(), label };
}

function calculateTrend(diffs: number[]): MomentumTrend {
  if (diffs.length < 2) return '→';

  // diffs[0] = most recent, diffs[last] = oldest
  const recentAvg = diffs.slice(0, Math.ceil(diffs.length / 2)).reduce((s, d) => s + d, 0) / Math.ceil(diffs.length / 2);
  const olderAvg = diffs.slice(Math.ceil(diffs.length / 2)).reduce((s, d) => s + d, 0) / Math.floor(diffs.length / 2);

  const slope = recentAvg - olderAvg;

  if (slope > 2) return '↑';
  if (slope > 0.5) return '↗';
  if (slope < -2) return '↓';
  if (slope < -0.5) return '↘';
  return '→';
}

// ============================================
// Clutch Rating
// ============================================

/**
 * Calculate clutch rating from one-goal game performance and OT record.
 * CLUTCH = strong in close games
 * CLOSER = decent in close games
 * ICE COLD = poor in close games
 */
export function calculateClutchRating(
  teamAbbrev: string,
  gameResults: GameResult[]
): ClutchRating {
  const DEFAULT: ClutchRating = {
    rating: null,
    oneGoalRecord: '0-0',
    otRecord: '0-0',
    thirdPeriodGoalDiff: 0,
  };

  if (!gameResults?.length) return DEFAULT;

  const teamGames = gameResults.filter(
    (g) =>
      (g.game_state === 'FINAL' || g.game_state === 'OFF') &&
      (g.home_team === teamAbbrev || g.away_team === teamAbbrev)
  );

  if (teamGames.length === 0) return DEFAULT;

  // One-goal games
  let oneGoalWins = 0;
  let oneGoalLosses = 0;

  for (const g of teamGames) {
    const isHome = g.home_team === teamAbbrev;
    const teamScore = isHome ? g.home_score : g.away_score;
    const oppScore = isHome ? g.away_score : g.home_score;
    const diff = Math.abs(teamScore - oppScore);

    if (diff === 1) {
      if (teamScore > oppScore) oneGoalWins++;
      else oneGoalLosses++;
    }
  }

  const totalCloseGames = oneGoalWins + oneGoalLosses;
  const clutchPct = totalCloseGames > 0 ? oneGoalWins / totalCloseGames : 0.5;

  let rating: ClutchRatingLevel = null;
  if (totalCloseGames >= 5) {
    if (clutchPct >= 0.65) rating = 'CLUTCH';
    else if (clutchPct >= 0.45) rating = 'CLOSER';
    else rating = 'ICE COLD';
  }

  return {
    rating,
    oneGoalRecord: `${oneGoalWins}-${oneGoalLosses}`,
    otRecord: '0-0', // OT data not available in game_results schema
    thirdPeriodGoalDiff: 0,
  };
}

// ============================================
// Rest Advantage
// ============================================

/**
 * Calculate rest advantage score (0-100).
 * Based on days since last game. Higher = more rested.
 * 0 = back-to-back, 50 = 1 day rest, 75 = 2 days, 100 = 3+ days
 */
export function calculateRestAdvantage(
  teamAbbrev: string,
  todayDateStr: string,
  gameResults: GameResult[]
): number {
  if (!gameResults?.length) return 50; // Default: neutral

  const today = new Date(todayDateStr);

  const teamGames = gameResults
    .filter(
      (g) =>
        (g.home_team === teamAbbrev || g.away_team === teamAbbrev) &&
        new Date(g.game_date) < today
    )
    .sort((a, b) => new Date(b.game_date).getTime() - new Date(a.game_date).getTime());

  if (teamGames.length === 0) return 75; // No recent games = well rested

  const lastGameDate = new Date(teamGames[0].game_date);
  const daysSinceLastGame = Math.floor(
    (today.getTime() - lastGameDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLastGame <= 0) return 0;   // Back-to-back
  if (daysSinceLastGame === 1) return 50;  // 1 day rest
  if (daysSinceLastGame === 2) return 75;  // 2 days rest
  return 100;                               // 3+ days rest
}

// ============================================
// Edge Quick Stats for QuickStatsBar
// ============================================

/**
 * Build dynamic Edge-powered stats for QuickStatsBar
 */
export function buildEdgeQuickStats(
  skaterLanding: EdgeSkaterLanding | null,
  momentumMap: Map<string, MomentumData>,
  restMap: Map<string, number>,
  games: ScheduleGame[]
): EdgeQuickStats {
  // Top shot speed from landing
  let topShotSpeed: EdgeQuickStats['topShotSpeed'] = null;
  if (skaterLanding?.hardestShot) {
    const entry = skaterLanding.hardestShot;
    const speed = entry.shotSpeed?.imperial?.speed;
    const lastName = entry.player?.lastName?.default ?? '';
    if (speed && lastName) {
      topShotSpeed = { value: speed, playerName: lastName };
    }
  }

  // Hottest momentum team
  let hottestMomentum: EdgeQuickStats['hottestMomentum'] = null;
  let maxMomentum = -Infinity;
  for (const [abbrev, data] of momentumMap) {
    if (data.score > maxMomentum) {
      maxMomentum = data.score;
      hottestMomentum = { value: data.score, teamAbbrev: abbrev };
    }
  }

  // Biggest fatigue mismatch
  let biggestFatigueMismatch: EdgeQuickStats['biggestFatigueMismatch'] = null;
  let maxDiff = 0;
  for (const game of games ?? []) {
    const away = game.awayTeam?.abbrev;
    const home = game.homeTeam?.abbrev;
    if (!away || !home) continue;
    const awayRest = restMap.get(away) ?? 50;
    const homeRest = restMap.get(home) ?? 50;
    const diff = Math.abs(homeRest - awayRest);
    if (diff > maxDiff) {
      maxDiff = diff;
      const advantage = homeRest > awayRest ? home : away;
      biggestFatigueMismatch = {
        value: Math.round(Math.max(homeRest, awayRest)),
        matchup: `${advantage}`,
      };
    }
  }

  return { topShotSpeed, hottestMomentum, biggestFatigueMismatch };
}
