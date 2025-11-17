/**
 * Consolidated prediction utilities with TypeScript types
 * Replaces duplicate logic from predictionHelpers.ts and index.tsx
 */

import type {
  TeamStandings,
  StandingsData,
  GameData,
  ConfidenceWeights,
  PredictionResult,
  EnrichedGame,
} from '../types/predictions';

/**
 * Confidence scoring weights - extracted as constants for easy tuning
 * These values can be adjusted based on historical accuracy data
 */
export const CONFIDENCE_WEIGHTS: ConfidenceWeights = {
  standingsDifferential: 30,    // Impact of point% difference
  homeIceAdvantage: 5,          // Fixed bonus for home team
  streakImpact: 2,              // Impact of win/loss streaks
  goalDifferentialImpact: 3,    // Impact of goal differential per game
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
 */
export function calculateConfidenceScore(
  game: GameData,
  homeTeam: TeamStandings | null,
  awayTeam: TeamStandings | null,
  weights: ConfidenceWeights = CONFIDENCE_WEIGHTS
): number {
  let score = 50; // Base score

  if (!homeTeam || !awayTeam) return score;

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

  // Normalize to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Extract numeric value from streak code
 * W5 = +5, L3 = -3, null/undefined = 0
 */
function getStreakValue(streakCode?: string): number {
  if (!streakCode) return 0;

  const isWin = streakCode.startsWith('W');
  const isLoss = streakCode.startsWith('L');
  const streakNum = parseInt(streakCode.substring(1)) || 0;

  if (isWin) return streakNum;
  if (isLoss) return -streakNum;
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
 * Calculate win probability for both teams
 */
export function calculateWinProbability(
  homeAbbrev: string,
  awayAbbrev: string,
  standings: StandingsData | null
): { homeWinProb: number; awayWinProb: number } {
  if (!standings?.standings) {
    return { homeWinProb: 50, awayWinProb: 50 };
  }

  const standingsMap = createStandingsMap(standings);
  const home = standingsMap.get(homeAbbrev);
  const away = standingsMap.get(awayAbbrev);

  if (!home || !away) {
    return { homeWinProb: 50, awayWinProb: 50 };
  }

  // Calculate with home advantage
  let homeProb = (home.pointPctg || 0.5) + HOME_ICE_ADVANTAGE;
  let awayProb = away.pointPctg || 0.5;

  // Normalize to 100%
  const total = homeProb + awayProb;
  homeProb = (homeProb / total) * 100;
  awayProb = (awayProb / total) * 100;

  return {
    homeWinProb: Math.round(homeProb),
    awayWinProb: Math.round(awayProb),
  };
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
