/**
 * Recent form calculations for NHL teams
 * Analyzes last N games to determine current team performance
 * Uses recency weighting so recent games matter more than older games
 */

import type { RecentGame, RecentFormStats } from '../types/predictions';

/**
 * Decay factor for recency weighting
 * Each game back is worth 85% of the previous game
 * Game weights (most recent first): 1.0, 0.85, 0.72, 0.61, 0.52, 0.44, 0.38, 0.32, 0.27, 0.23
 */
const RECENCY_DECAY_FACTOR = 0.85;

/**
 * Get current NHL season in format YYYYyyyy (e.g., 20242025)
 */
export function getCurrentSeason(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();

  // NHL season runs from October (9) to June (5)
  // Off-season (July-September): return last season
  // October-December: return current season
  // January-June: return season that started last year
  if (month >= 6 && month <= 8) {
    // Off-season: return last season
    return `${year - 1}${year}`;
  } else if (month >= 0 && month <= 5) {
    // Jan-June: season started last year
    return `${year - 1}${year}`;
  } else {
    // Oct-Dec: season started this year
    return `${year}${year + 1}`;
  }
}

/**
 * Fetch recent games for a team from NHL API
 * Returns up to N most recent completed games
 */
export async function fetchTeamRecentGames(
  teamAbbrev: string,
  count: number = 10
): Promise<RecentGame[]> {
  try {
    const season = getCurrentSeason();
    const url = `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbrev}/${season}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[Recent Form] Failed to fetch schedule for ${teamAbbrev}`);
      return [];
    }

    const data = await response.json();
    const games = data.games || [];

    // Filter for completed games only and convert to RecentGame format
    const completedGames: RecentGame[] = games
      .filter((game: any) => {
        // Only include games that are final (OFF or FINAL state)
        return game.gameState === 'FINAL' || game.gameState === 'OFF';
      })
      .map((game: any) => {
        const isHomeGame = game.homeTeam?.abbrev === teamAbbrev;
        const opponent = isHomeGame ? game.awayTeam?.abbrev : game.homeTeam?.abbrev;
        const goalsFor = isHomeGame ? (game.homeTeam?.score || 0) : (game.awayTeam?.score || 0);
        const goalsAgainst = isHomeGame ? (game.awayTeam?.score || 0) : (game.homeTeam?.score || 0);

        return {
          id: game.id,
          gameDate: game.gameDate,
          isHomeGame,
          opponent: opponent || '',
          goalsFor,
          goalsAgainst,
          won: goalsFor > goalsAgainst,
        };
      })
      .sort((a: RecentGame, b: RecentGame) => {
        // Sort by date descending (most recent first)
        return b.gameDate.localeCompare(a.gameDate);
      })
      .slice(0, count); // Limit to requested count

    return completedGames;
  } catch (error) {
    console.error(`[Recent Form] Error fetching games for ${teamAbbrev}:`, error);
    return [];
  }
}

/**
 * Calculate the recency weight for a game based on its position
 * Most recent game (index 0) = 1.0, each subsequent game decays by RECENCY_DECAY_FACTOR
 */
function getRecencyWeight(gameIndex: number): number {
  return Math.pow(RECENCY_DECAY_FACTOR, gameIndex);
}

/**
 * Calculate recent form statistics from a list of games
 * Uses recency weighting so recent games have more impact than older games
 * Games should be sorted by date descending (most recent first)
 */
export function calculateRecentForm(games: RecentGame[]): RecentFormStats {
  if (games.length === 0) {
    return {
      wins: 0,
      losses: 0,
      pointPctg: 0.5, // Neutral
      goalDifferential: 0,
      gamesPlayed: 0,
    };
  }

  // Calculate raw counts for display purposes
  const wins = games.filter(g => g.won).length;
  const losses = games.length - wins;

  // Calculate weighted point percentage using recency weighting
  // Recent games matter more than older games
  let weightedWins = 0;
  let totalWeight = 0;
  let weightedGoalDiff = 0;

  games.forEach((game, index) => {
    const weight = getRecencyWeight(index);
    totalWeight += weight;

    if (game.won) {
      weightedWins += weight;
    }

    // Also weight goal differential by recency
    weightedGoalDiff += (game.goalsFor - game.goalsAgainst) * weight;
  });

  // Calculate weighted point percentage (this is what's used in predictions)
  const pointPctg = totalWeight > 0
    ? Math.round((weightedWins / totalWeight) * 1000) / 1000
    : 0.5;

  // Goal differential is the weighted sum (more recent games count more)
  const goalDifferential = Math.round(weightedGoalDiff * 10) / 10;

  return {
    wins,
    losses,
    pointPctg,  // Now uses recency weighting
    goalDifferential,  // Now uses recency weighting
    gamesPlayed: games.length,
  };
}

/**
 * Get recent form for both teams in a matchup
 * Returns form stats for both home and away teams
 */
export async function getMatchupRecentForm(
  homeAbbrev: string,
  awayAbbrev: string,
  gameCount: number = 10
): Promise<{
  home: RecentFormStats;
  away: RecentFormStats;
  homeGames: RecentGame[];
  awayGames: RecentGame[];
}> {
  // Fetch both teams' schedules in parallel
  const [homeGames, awayGames] = await Promise.all([
    fetchTeamRecentGames(homeAbbrev, gameCount),
    fetchTeamRecentGames(awayAbbrev, gameCount),
  ]);

  return {
    home: calculateRecentForm(homeGames),
    away: calculateRecentForm(awayGames),
    homeGames,
    awayGames,
  };
}
