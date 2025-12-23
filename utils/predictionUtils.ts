/**
 * Consolidated prediction utilities with TypeScript types
 * Replaces duplicate logic from predictionHelpers.ts and index.tsx
 * Enhanced with recent form and situational factors
 */

import type {
  TeamStandings,
  StandingsData,
  GameData,
  ConfidenceWeights,
  PredictionResult,
  EnrichedGame,
  RecentFormStats,
  SituationalFactors,
  TeamPredictionStats,
} from '../types/predictions';
import { getMatchupRecentForm } from './recentForm';
import { calculateSituationalFactors } from './situationalFactors';
import { fetchAllTeamStats } from './teamStatsForPrediction';

/**
 * Confidence scoring weights - extracted as constants for easy tuning
 * These values can be adjusted based on historical accuracy data
 * Updated to include recent form and situational factors
 * BOOSTED for more confident predictions with wider spread
 */
export const CONFIDENCE_WEIGHTS: ConfidenceWeights = {
  standingsDifferential: 80,    // Impact of point% difference - BOOSTED (0.2 diff = 16 points)
  homeIceAdvantage: 8,          // Fixed bonus for home team - slightly increased
  streakImpact: 12,             // Impact of win/loss streaks - DOUBLED for momentum
  goalDifferentialImpact: 12,   // Impact of goal differential per game - BOOSTED
  recentFormImpact: 40,         // Impact of recent form (L5/L10) - BOOSTED significantly
  backToBackPenalty: 15,        // Penalty for playing back-to-back games - increased
  restAdvantage: 8,             // Bonus per extra rest day - increased
  specialTeamsImpact: 25,       // Impact of PP% + PK% combined differential - BOOSTED
  shotDifferentialImpact: 10,   // Impact of net shots per game differential - DOUBLED
};

/**
 * Home ice advantage factor for probability calculation
 * NHL average is ~54% home win rate, so 0.1 (10%) is approximate
 */
export const HOME_ICE_ADVANTAGE = 0.1;

/**
 * Extract team abbreviation from various API formats
 */
export function getTeamAbbrev(team: TeamStandings | { abbrev: string | { default: string } }): string {
  if ('teamAbbrev' in team && team.teamAbbrev) {
    const abbrev = team.teamAbbrev;
    return typeof abbrev === 'string' ? abbrev : abbrev.default;
  }
  if ('abbrev' in team && team.abbrev) {
    const abbrev = team.abbrev;
    return typeof abbrev === 'string' ? abbrev : abbrev.default;
  }
  return '';
}

/**
 * Create optimized standings lookup using Map for O(1) access
 * Converts O(n) array.find() to O(1) Map.get()
 */
export function createStandingsMap(standings: StandingsData | null): Map<string, TeamStandings> {
  const map = new Map<string, TeamStandings>();

  if (!standings?.standings) {
    return map;
  }

  for (const team of standings.standings) {
    const abbrev = getTeamAbbrev(team);
    if (abbrev) {
      map.set(abbrev, team);
    }
  }

  return map;
}

/**
 * Get predicted winner based on standings with home ice advantage
 * Uses simple point percentage + home advantage calculation
 */
export function getPredictedWinner(
  homeAbbrev: string,
  awayAbbrev: string,
  standings: StandingsData | null
): string {
  if (!standings?.standings) {
    return homeAbbrev; // Default to home team if no standings
  }

  const standingsMap = createStandingsMap(standings);
  const home = standingsMap.get(homeAbbrev);
  const away = standingsMap.get(awayAbbrev);

  if (!home && !away) return homeAbbrev; // Default to home if neither found
  if (!home) return awayAbbrev; // Away wins if home not found
  if (!away) return homeAbbrev; // Home wins if away not found

  // Calculate win probabilities with home advantage
  const homeProb = (home.pointPctg || 0.5) + HOME_ICE_ADVANTAGE;
  const awayProb = away.pointPctg || 0.5;

  // Return team with higher probability (tie goes to home team)
  return homeProb >= awayProb ? homeAbbrev : awayAbbrev;
}

/**
 * Calculate confidence score (0-100) based on multiple factors
 * Higher score = higher confidence in prediction
 * Enhanced with optional recent form, situational factors, and team stats
 */
export function calculateConfidenceScore(
  game: GameData,
  homeTeam: TeamStandings | null,
  awayTeam: TeamStandings | null,
  weights: ConfidenceWeights = CONFIDENCE_WEIGHTS,
  recentForm?: { home: RecentFormStats; away: RecentFormStats },
  situationalFactors?: SituationalFactors,
  teamStats?: { home: TeamPredictionStats | null; away: TeamPredictionStats | null }
): number {
  let score = 50; // Base score

  if (!homeTeam || !awayTeam) return score;

  // Factor 1: Standings differential (season-long stats)
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

  // Factor 5: Recent form (L5/L10 games)
  if (recentForm && recentForm.home.gamesPlayed > 0 && recentForm.away.gamesPlayed > 0) {
    const recentFormDiff = recentForm.home.pointPctg - recentForm.away.pointPctg;
    score += recentFormDiff * weights.recentFormImpact;
  }

  // Factor 6: Situational factors (back-to-back, rest days)
  if (situationalFactors) {
    // Apply back-to-back penalty
    if (situationalFactors.homeBackToBack && !situationalFactors.awayBackToBack) {
      score -= weights.backToBackPenalty;
    } else if (situationalFactors.awayBackToBack && !situationalFactors.homeBackToBack) {
      score += weights.backToBackPenalty;
    }

    // Apply rest advantage
    const restDaysDiff = situationalFactors.homeRestDays - situationalFactors.awayRestDays;
    score += Math.min(Math.max(restDaysDiff, -3), 3) * weights.restAdvantage; // Cap at ±3 days
  }

  // Factor 7: Special Teams (PP% + PK%) - Real NHL data
  if (teamStats?.home && teamStats?.away) {
    // Combine PP% and PK% into single "special teams strength" metric
    // PP% is typically 0.15-0.28, PK% is typically 0.75-0.88
    const homeSpecialTeams = (teamStats.home.powerPlayPct + teamStats.home.penaltyKillPct) / 2;
    const awaySpecialTeams = (teamStats.away.powerPlayPct + teamStats.away.penaltyKillPct) / 2;
    const specialTeamsDiff = homeSpecialTeams - awaySpecialTeams;
    score += specialTeamsDiff * weights.specialTeamsImpact;
  }

  // Factor 8: Shot Differential - Real NHL data
  if (teamStats?.home && teamStats?.away) {
    // Net shots = shots for - shots against (positive = outshoot opponents)
    const homeNetShots = teamStats.home.shotsForPerGame - teamStats.home.shotsAgainstPerGame;
    const awayNetShots = teamStats.away.shotsForPerGame - teamStats.away.shotsAgainstPerGame;
    const shotDiff = homeNetShots - awayNetShots;
    // Scale by 0.5 since shot diff can be large (e.g., +6 vs -4 = 10 point swing)
    score += (shotDiff * 0.5) * weights.shotDifferentialImpact;
  }

  // Normalize to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Extract numeric value from streak code with diminishing returns scaling
 * W5 = +3.6, L3 = -2.4, null/undefined = 0
 * Uses power scaling (0.8 exponent) so longer streaks have impact but don't dominate
 * Capped at 10 games to prevent outlier streaks from overweighting
 */
function getStreakValue(streakCode?: string): number {
  if (!streakCode) return 0;

  const isWin = streakCode.startsWith('W');
  const isLoss = streakCode.startsWith('L');
  const streakNum = parseInt(streakCode.substring(1)) || 0;

  // Cap streak at 10 games to prevent outliers from dominating
  const cappedStreak = Math.min(streakNum, 10);

  // Apply diminishing returns scaling (0.8 exponent)
  // W1 = 1.0, W2 = 1.7, W3 = 2.4, W5 = 3.6, W10 = 6.3
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
 * Win probability result with additional context
 */
export interface WinProbabilityResult {
  homeWinProb: number;
  awayWinProb: number;
  confidence: 'high' | 'medium' | 'low';
  homePoints?: number;
  awayPoints?: number;
  homeRecord?: string;
  awayRecord?: string;
  homeStreak?: string;
  awayStreak?: string;
}

/**
 * Calculate win probability for both teams using enhanced multi-factor algorithm
 * Uses standings, home ice advantage, streaks, and goal differential
 * Results are clamped to 15-85% to avoid overconfident predictions
 */
export function calculateWinProbability(
  homeAbbrev: string,
  awayAbbrev: string,
  standings: StandingsData | null
): WinProbabilityResult {
  if (!standings?.standings) {
    return { homeWinProb: 50, awayWinProb: 50, confidence: 'medium' };
  }

  const standingsMap = createStandingsMap(standings);
  const home = standingsMap.get(homeAbbrev);
  const away = standingsMap.get(awayAbbrev);

  if (!home || !away) {
    return { homeWinProb: 50, awayWinProb: 50, confidence: 'medium' };
  }

  // Base values from standings
  const homeWinPct = home.pointPctg || 0.5;
  const awayWinPct = away.pointPctg || 0.5;

  // Use CONFIDENCE_WEIGHTS for consistent factors across the app
  const HOME_ICE_BOOST = CONFIDENCE_WEIGHTS.homeIceAdvantage;
  const STANDINGS_MULTIPLIER = CONFIDENCE_WEIGHTS.standingsDifferential;
  const STREAK_MULTIPLIER = CONFIDENCE_WEIGHTS.streakImpact;
  const GOAL_DIFF_MULTIPLIER = CONFIDENCE_WEIGHTS.goalDifferentialImpact;

  // Start at 50-50
  let homeProb = 50;

  // Factor 1: Standings differential (biggest factor)
  const standingsDiff = homeWinPct - awayWinPct;
  homeProb += standingsDiff * STANDINGS_MULTIPLIER;

  // Factor 2: Home ice advantage
  homeProb += HOME_ICE_BOOST;

  // Factor 3: Streak impact (using shared getStreakValue logic)
  const homeStreakVal = getStreakValueForProb(home.streakCode);
  const awayStreakVal = getStreakValueForProb(away.streakCode);
  homeProb += (homeStreakVal - awayStreakVal) * STREAK_MULTIPLIER;

  // Factor 4: Goal differential per game
  const homeGamesPlayed = home.gamesPlayed || 1;
  const awayGamesPlayed = away.gamesPlayed || 1;
  const homeGD = ((home.goalFor || 0) - (home.goalAgainst || 0)) / homeGamesPlayed;
  const awayGD = ((away.goalFor || 0) - (away.goalAgainst || 0)) / awayGamesPlayed;
  homeProb += (homeGD - awayGD) * GOAL_DIFF_MULTIPLIER;

  // Clamp to valid range (15-85% to avoid overconfident predictions)
  homeProb = Math.max(15, Math.min(85, homeProb));
  const awayProb = 100 - homeProb;

  // Calculate confidence level based on probability spread
  const diff = Math.abs(homeProb - awayProb);
  const confidence: 'high' | 'medium' | 'low' = diff > 25 ? 'high' : diff < 10 ? 'low' : 'medium';

  return {
    homeWinProb: Math.round(homeProb),
    awayWinProb: Math.round(awayProb),
    confidence,
    homePoints: home.points,
    awayPoints: away.points,
    homeRecord: `${home.wins}-${home.losses}-${home.otLosses || 0}`,
    awayRecord: `${away.wins}-${away.losses}-${away.otLosses || 0}`,
    homeStreak: home.streakCode || '',
    awayStreak: away.streakCode || '',
  };
}

/**
 * Helper for win probability streak calculation
 * Uses diminishing returns scaling to prevent streaks from dominating
 */
function getStreakValueForProb(streakCode?: string): number {
  if (!streakCode) return 0;
  const isWin = streakCode.startsWith('W');
  const isLoss = streakCode.startsWith('L');
  const num = parseInt(streakCode.substring(1)) || 0;
  const cappedNum = Math.min(num, 10);
  const scaled = Math.pow(cappedNum, 0.8);
  return isWin ? scaled : isLoss ? -scaled : 0;
}

/**
 * Find Lock of the Day - game with highest confidence score
 */
export function getLockOfTheDay(
  games: GameData[],
  standings: StandingsData | null
): EnrichedGame | null {
  if (!games || games.length === 0 || !standings?.standings) {
    return null;
  }

  const standingsMap = createStandingsMap(standings);
  let bestGame: EnrichedGame | null = null;
  let highestScore = 0;

  for (const game of games) {
    const homeAbbrev = game.homeTeam?.abbrev || '';
    const awayAbbrev = game.awayTeam?.abbrev || '';

    const homeTeam = standingsMap.get(homeAbbrev);
    const awayTeam = standingsMap.get(awayAbbrev);

    if (homeTeam && awayTeam) {
      const confidenceScore = calculateConfidenceScore(game, homeTeam, awayTeam);

      if (confidenceScore > highestScore) {
        highestScore = confidenceScore;
        bestGame = {
          ...game,
          confidenceScore,
          homeTeam: { ...homeTeam, abbrev: homeAbbrev },
          awayTeam: { ...awayTeam, abbrev: awayAbbrev },
        };
      }
    }
  }

  return bestGame;
}

/**
 * Get top smart picks (excluding lock of the day)
 * Legacy synchronous version (without recent form)
 */
export function getSmartPicks(
  games: GameData[],
  lockGameId: string | number | null,
  standings: StandingsData | null,
  count: number = 4
): EnrichedGame[] {
  if (!games || games.length === 0 || !standings?.standings) {
    return [];
  }

  const standingsMap = createStandingsMap(standings);
  const scoredGames: EnrichedGame[] = [];

  for (const game of games) {
    // Skip the lock of the day
    if (lockGameId && String(game.id) === String(lockGameId)) {
      continue;
    }

    const homeAbbrev = game.homeTeam?.abbrev || '';
    const awayAbbrev = game.awayTeam?.abbrev || '';

    const homeTeam = standingsMap.get(homeAbbrev);
    const awayTeam = standingsMap.get(awayAbbrev);

    if (homeTeam && awayTeam) {
      const confidenceScore = calculateConfidenceScore(game, homeTeam, awayTeam);
      scoredGames.push({
        ...game,
        confidenceScore,
        homeTeam: { ...homeTeam, abbrev: homeAbbrev },
        awayTeam: { ...awayTeam, abbrev: awayAbbrev },
      });
    }
  }

  // Sort by confidence score and take top N
  return scoredGames
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, count);
}

/**
 * Get Lock of the Day with enhanced factors - ASYNC VERSION
 * Fetches recent form, situational data, and team stats for better predictions
 */
export async function getLockOfTheDayEnhanced(
  games: GameData[],
  standings: StandingsData | null
): Promise<EnrichedGame | null> {
  if (!games || games.length === 0 || !standings?.standings) {
    return null;
  }

  const standingsMap = createStandingsMap(standings);
  let bestGame: EnrichedGame | null = null;
  let highestScore = 0;

  // Fetch team stats once for all games (cached for 1 hour)
  const allTeamStats = await fetchAllTeamStats();

  for (const game of games) {
    const homeAbbrev = game.homeTeam?.abbrev || '';
    const awayAbbrev = game.awayTeam?.abbrev || '';
    const gameDate = game.startTimeUTC?.split('T')[0] || '';

    const homeTeam = standingsMap.get(homeAbbrev);
    const awayTeam = standingsMap.get(awayAbbrev);

    if (homeTeam && awayTeam && gameDate) {
      try {
        // Fetch recent form and situational factors
        const recentFormData = await getMatchupRecentForm(homeAbbrev, awayAbbrev, 10);
        const situationalData = calculateSituationalFactors(
          gameDate,
          recentFormData.homeGames,
          recentFormData.awayGames
        );

        // Get team stats for this matchup (real NHL data)
        const teamStats = {
          home: allTeamStats.get(homeAbbrev) || null,
          away: allTeamStats.get(awayAbbrev) || null,
        };

        // Calculate enhanced confidence score with all factors
        const confidenceScore = calculateConfidenceScore(
          game,
          homeTeam,
          awayTeam,
          CONFIDENCE_WEIGHTS,
          recentFormData,
          situationalData,
          teamStats
        );

        if (confidenceScore > highestScore) {
          highestScore = confidenceScore;
          bestGame = {
            ...game,
            confidenceScore,
            homeTeam: { ...homeTeam, abbrev: homeAbbrev },
            awayTeam: { ...awayTeam, abbrev: awayAbbrev },
          };
        }
      } catch (error) {
        console.error(`[Enhanced Prediction] Error processing game ${game.id}:`, error);
        // Fall back to basic calculation without enhanced factors
        const confidenceScore = calculateConfidenceScore(game, homeTeam, awayTeam);
        if (confidenceScore > highestScore) {
          highestScore = confidenceScore;
          bestGame = {
            ...game,
            confidenceScore,
            homeTeam: { ...homeTeam, abbrev: homeAbbrev },
            awayTeam: { ...awayTeam, abbrev: awayAbbrev },
          };
        }
      }
    }
  }

  return bestGame;
}

/**
 * Get top smart picks with enhanced factors - ASYNC VERSION
 * Fetches recent form, situational data, and team stats for better predictions
 */
export async function getSmartPicksEnhanced(
  games: GameData[],
  lockGameId: string | number | null,
  standings: StandingsData | null,
  count: number = 4
): Promise<EnrichedGame[]> {
  if (!games || games.length === 0 || !standings?.standings) {
    return [];
  }

  const standingsMap = createStandingsMap(standings);
  const scoredGames: EnrichedGame[] = [];

  // Fetch team stats once for all games (cached for 1 hour)
  const allTeamStats = await fetchAllTeamStats();

  for (const game of games) {
    // Skip the lock of the day
    if (lockGameId && String(game.id) === String(lockGameId)) {
      continue;
    }

    const homeAbbrev = game.homeTeam?.abbrev || '';
    const awayAbbrev = game.awayTeam?.abbrev || '';
    const gameDate = game.startTimeUTC?.split('T')[0] || '';

    const homeTeam = standingsMap.get(homeAbbrev);
    const awayTeam = standingsMap.get(awayAbbrev);

    if (homeTeam && awayTeam && gameDate) {
      try {
        // Fetch recent form and situational factors
        const recentFormData = await getMatchupRecentForm(homeAbbrev, awayAbbrev, 10);
        const situationalData = calculateSituationalFactors(
          gameDate,
          recentFormData.homeGames,
          recentFormData.awayGames
        );

        // Get team stats for this matchup (real NHL data)
        const teamStats = {
          home: allTeamStats.get(homeAbbrev) || null,
          away: allTeamStats.get(awayAbbrev) || null,
        };

        // Calculate enhanced confidence score with all factors
        const confidenceScore = calculateConfidenceScore(
          game,
          homeTeam,
          awayTeam,
          CONFIDENCE_WEIGHTS,
          recentFormData,
          situationalData,
          teamStats
        );

        scoredGames.push({
          ...game,
          confidenceScore,
          homeTeam: { ...homeTeam, abbrev: homeAbbrev },
          awayTeam: { ...awayTeam, abbrev: awayAbbrev },
        });
      } catch (error) {
        console.error(`[Enhanced Prediction] Error processing game ${game.id}:`, error);
        // Fall back to basic calculation
        const confidenceScore = calculateConfidenceScore(game, homeTeam, awayTeam);
        scoredGames.push({
          ...game,
          confidenceScore,
          homeTeam: { ...homeTeam, abbrev: homeAbbrev },
          awayTeam: { ...awayTeam, abbrev: awayAbbrev },
        });
      }
    }
  }

  // Sort by confidence score and take top N
  return scoredGames
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, count);
}
