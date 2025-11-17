/**
 * Situational factors for NHL predictions
 * Analyzes back-to-back games, rest days, and travel impact
 */

import type { RecentGame, SituationalFactors } from '../types/predictions';

/**
 * Check if a team is playing back-to-back (game yesterday)
 */
export function isBackToBack(teamGames: RecentGame[], gameDate: string): boolean {
  if (teamGames.length === 0) return false;

  // Get the most recent game (games are sorted by date descending)
  const lastGame = teamGames[0];
  const lastGameDate = new Date(lastGame.gameDate);
  const currentGameDate = new Date(gameDate);

  // Calculate difference in days
  const diffTime = currentGameDate.getTime() - lastGameDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  // Back-to-back means game was played yesterday (1 day difference)
  return diffDays === 1;
}

/**
 * Calculate number of rest days since last game
 */
export function calculateRestDays(teamGames: RecentGame[], gameDate: string): number {
  if (teamGames.length === 0) return 0;

  const lastGame = teamGames[0];
  const lastGameDate = new Date(lastGame.gameDate);
  const currentGameDate = new Date(gameDate);

  // Calculate difference in days
  const diffTime = currentGameDate.getTime() - lastGameDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Rest days = days between games - 1
  // E.g., game on Nov 10, game on Nov 15 = 5 days diff = 4 rest days (11, 12, 13, 14)
  const restDays = diffDays - 1;

  // Return 0 if negative (shouldn't happen with proper data)
  return Math.max(0, restDays);
}

/**
 * Calculate all situational factors for a matchup
 */
export function calculateSituationalFactors(
  gameDate: string,
  homeGames: RecentGame[],
  awayGames: RecentGame[]
): SituationalFactors {
  const homeBackToBack = isBackToBack(homeGames, gameDate);
  const awayBackToBack = isBackToBack(awayGames, gameDate);

  const homeRestDays = calculateRestDays(homeGames, gameDate);
  const awayRestDays = calculateRestDays(awayGames, gameDate);

  // Determine rest advantage
  let restAdvantage: 'home' | 'away' | 'neutral' = 'neutral';
  if (homeRestDays > awayRestDays) {
    restAdvantage = 'home';
  } else if (awayRestDays > homeRestDays) {
    restAdvantage = 'away';
  }

  return {
    homeBackToBack,
    awayBackToBack,
    homeRestDays,
    awayRestDays,
    restAdvantage,
  };
}
