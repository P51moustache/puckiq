/**
 * Player stats service - fetches and caches team player/goalie stats from the NHL API.
 * Used by prediction components to show key players for upcoming games.
 */

import {
  PlayerStatLine,
  GoalieStatLine,
  TeamPlayerStats,
  NHLRawSkater,
  NHLRawGoalie,
} from '../types/gameResults';
import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------
const statsCache: Map<string, TeamPlayerStats> = new Map();

/** Clear the in-memory player stats cache (useful for testing or forced refresh). */
export function clearPlayerStatsCache(): void {
  statsCache.clear();
}

// ---------------------------------------------------------------------------
// getTeamPlayerStats
// ---------------------------------------------------------------------------

/**
 * Fetch skater and goalie season stats for a single team.
 * Results are cached in memory so subsequent calls for the same team are instant.
 */
export async function getTeamPlayerStats(
  teamAbbrev: string,
): Promise<TeamPlayerStats> {
  // Check cache first
  const cached = statsCache.get(teamAbbrev);
  if (cached) {
    return cached;
  }

  // --- Supabase-first: try reading from skater_season_stats + goalie_season_stats ---
  try {
    const [skaterRes, goalieRes] = await Promise.all([
      supabase
        .from('skater_season_stats')
        .select('*, players!inner(first_name, last_name)')
        .eq('team_abbrev', teamAbbrev)
        .order('points', { ascending: false }),
      supabase
        .from('goalie_season_stats')
        .select('*, players!inner(first_name, last_name)')
        .eq('team_abbrev', teamAbbrev)
        .order('wins', { ascending: false }),
    ]);

    if (!skaterRes.error && !goalieRes.error && skaterRes.data && goalieRes.data && (skaterRes.data.length > 0 || goalieRes.data.length > 0)) {
      const skaters: PlayerStatLine[] = skaterRes.data.map((row: any): PlayerStatLine => ({
        playerId: row.player_id,
        firstName: row.players.first_name,
        lastName: row.players.last_name,
        positionCode: row.position || 'C',
        gamesPlayed: row.games_played || 0,
        goals: row.goals || 0,
        assists: row.assists || 0,
        points: row.points || 0,
        plusMinus: row.plus_minus || 0,
        shots: row.shots || 0,
        shootingPctg: row.shooting_pctg || 0,
      }));

      const goalies: GoalieStatLine[] = goalieRes.data.map((row: any): GoalieStatLine => ({
        playerId: row.player_id,
        firstName: row.players.first_name,
        lastName: row.players.last_name,
        gamesPlayed: row.games_played || 0,
        wins: row.wins || 0,
        losses: row.losses || 0,
        otLosses: row.ot_losses || 0,
        goalsAgainstAvg: row.goals_against_avg || 0,
        savePctg: row.save_pctg || 0,
      }));

      const result: TeamPlayerStats = { skaters, goalies };
      statsCache.set(teamAbbrev, result);
      console.log(`[PLAYER STATS] [SUPABASE] Loaded ${skaters.length} skaters + ${goalies.length} goalies for ${teamAbbrev}`);
      return result;
    }
    console.warn(`[PLAYER STATS] [SUPABASE] No data for ${teamAbbrev}, falling back to NHL API`);
  } catch (sbError) {
    console.warn(`[PLAYER STATS] [SUPABASE] Error, falling back to NHL API`, sbError);
  }

  // --- Fallback: NHL API ---
  try {
    const response = await fetch(
      `https://api-web.nhle.com/v1/club-stats/${teamAbbrev}/now`,
    );
    const data = await response.json();

    // Map raw skater data
    const skaters: PlayerStatLine[] = (
      (data.skaters as NHLRawSkater[]) ?? []
    )
      .map((raw: NHLRawSkater): PlayerStatLine => ({
        playerId: raw.playerId,
        firstName: raw.firstName.default,
        lastName: raw.lastName.default,
        positionCode: raw.positionCode,
        gamesPlayed: raw.gamesPlayed,
        goals: raw.goals,
        assists: raw.assists,
        points: raw.points,
        plusMinus: raw.plusMinus,
        shots: raw.shots,
        shootingPctg: raw.shootingPctg,
      }))
      .sort((a, b) => b.points - a.points);

    // Map raw goalie data
    const goalies: GoalieStatLine[] = (
      (data.goalies as NHLRawGoalie[]) ?? []
    )
      .map((raw: NHLRawGoalie): GoalieStatLine => ({
        playerId: raw.playerId,
        firstName: raw.firstName.default,
        lastName: raw.lastName.default,
        gamesPlayed: raw.gamesPlayed,
        wins: raw.wins,
        losses: raw.losses,
        otLosses: raw.otLosses,
        goalsAgainstAvg: raw.goalsAgainstAvg,
        savePctg: raw.savePctg,
      }))
      .sort((a, b) => b.wins - a.wins);

    const result: TeamPlayerStats = { skaters, goalies };

    // Store in cache
    statsCache.set(teamAbbrev, result);

    return result;
  } catch (error) {
    console.error(
      `[PLAYER STATS] Failed to fetch stats for ${teamAbbrev}:`,
      error,
    );
    return { skaters: [], goalies: [] };
  }
}

// ---------------------------------------------------------------------------
// getKeyPlayersForGame
// ---------------------------------------------------------------------------

/**
 * Fetch player stats for both teams in a game, in parallel.
 * Individual team failures are handled gracefully — the other team's stats
 * will still be returned.
 */
export async function getKeyPlayersForGame(
  homeTeam: string,
  awayTeam: string,
): Promise<{ home: TeamPlayerStats; away: TeamPlayerStats }> {
  const emptyStats: TeamPlayerStats = { skaters: [], goalies: [] };

  try {
    const [homeResult, awayResult] = await Promise.allSettled([
      getTeamPlayerStats(homeTeam),
      getTeamPlayerStats(awayTeam),
    ]);

    return {
      home:
        homeResult.status === 'fulfilled' ? homeResult.value : emptyStats,
      away:
        awayResult.status === 'fulfilled' ? awayResult.value : emptyStats,
    };
  } catch (error) {
    console.error(
      '[PLAYER STATS] Unexpected error fetching key players:',
      error,
    );
    return { home: emptyStats, away: emptyStats };
  }
}
