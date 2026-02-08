/**
 * Recent form calculations for NHL teams
 * Analyzes last N games to determine current team performance
 * Uses recency weighting so recent games matter more than older games
 *
 * Data source: Supabase `games` table (synced from NHL API via GitHub Actions)
 */

import type { RecentGame, RecentFormStats } from '../types/predictions';
import { supabase } from '../lib/supabase';

/**
 * Decay factor for recency weighting
 * Each game back is worth 85% of the previous game
 * Game weights (most recent first): 1.0, 0.85, 0.72, 0.61, 0.52, 0.44, 0.38, 0.32, 0.27, 0.23
 */
const RECENCY_DECAY_FACTOR = 0.85;

/**
 * Fetch recent completed games for a team from Supabase
 * Returns up to N most recent completed games
 */
export async function fetchTeamRecentGames(
  teamAbbrev: string,
  count: number = 10
): Promise<RecentGame[]> {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('id, game_date, home_team_abbrev, away_team_abbrev, home_score, away_score, game_state')
      .or(`home_team_abbrev.eq.${teamAbbrev},away_team_abbrev.eq.${teamAbbrev}`)
      .in('game_state', ['FINAL', 'OFF'])
      .order('game_date', { ascending: false })
      .limit(count);

    if (error || !data) {
      console.error(`[Recent Form] Supabase query failed for ${teamAbbrev}:`, error?.message);
      return [];
    }

    const completedGames: RecentGame[] = data.map((row: any) => {
      const isHomeGame = row.home_team_abbrev === teamAbbrev;
      const opponent = isHomeGame ? row.away_team_abbrev : row.home_team_abbrev;
      const goalsFor = isHomeGame ? (row.home_score || 0) : (row.away_score || 0);
      const goalsAgainst = isHomeGame ? (row.away_score || 0) : (row.home_score || 0);

      return {
        id: row.id,
        gameDate: row.game_date,
        isHomeGame,
        opponent: opponent || '',
        goalsFor,
        goalsAgainst,
        won: goalsFor > goalsAgainst,
      };
    });

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
