/**
 * Recent form calculations for NHL teams
 * Analyzes last N games to determine current team performance
 */

import type { RecentGame, RecentFormStats } from '../types/predictions';

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
 * Calculate recent form statistics from a list of games
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

  const wins = games.filter(g => g.won).length;
  const losses = games.length - wins;
  const pointPctg = Math.round((wins / games.length) * 1000) / 1000; // Round to 3 decimals

  const goalDifferential = games.reduce((sum, game) => {
    return sum + (game.goalsFor - game.goalsAgainst);
  }, 0);

  return {
    wins,
    losses,
    pointPctg,
    goalDifferential,
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
