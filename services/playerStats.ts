/**
 * Player stats service - fetches and caches team player/goalie stats from Supabase.
 * Used by prediction components to show key players for upcoming games.
 */

import {
  PlayerStatLine,
  GoalieStatLine,
  TeamPlayerStats,
} from '../types/gameResults';
import { supabase } from '../lib/supabase';
import { computeSavePct } from './goalieRates';

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

  // --- Supabase: read from skater_season_stats + goalie_season_stats ---
  // Note: no FK between these tables and `players`, so we query stats first
  // then batch-fetch player names separately.
  try {
    const [skaterRes, goalieRes] = await Promise.all([
      supabase
        .from('skater_season_stats')
        .select('*')
        .eq('team_abbrev', teamAbbrev)
        .order('points', { ascending: false }),
      supabase
        .from('goalie_season_stats')
        .select('*')
        .eq('team_abbrev', teamAbbrev)
        .order('wins', { ascending: false }),
    ]);

    if (!skaterRes.error && !goalieRes.error && skaterRes.data && goalieRes.data && (skaterRes.data.length > 0 || goalieRes.data.length > 0)) {
      // Batch-fetch player names
      const allPlayerIds = [
        ...skaterRes.data.map((r: any) => r.player_id),
        ...goalieRes.data.map((r: any) => r.player_id),
      ];
      const playerInfo = new Map<number, { first: string; last: string; headshotUrl?: string }>();
      if (allPlayerIds.length > 0) {
        const { data: players } = await supabase
          .from('players')
          .select('id, first_name, last_name, headshot_url')
          .in('id', allPlayerIds);
        if (players) {
          for (const p of players) {
            playerInfo.set(p.id, { first: p.first_name, last: p.last_name, headshotUrl: p.headshot_url ?? undefined });
          }
        }
      }

      const skaters: PlayerStatLine[] = skaterRes.data.map((row: any): PlayerStatLine => {
        const info = playerInfo.get(row.player_id);
        return {
          playerId: row.player_id,
          firstName: info?.first ?? 'Unknown',
          lastName: info?.last ?? `#${row.player_id}`,
          positionCode: row.position || 'C',
          gamesPlayed: row.games_played || 0,
          goals: row.goals || 0,
          assists: row.assists || 0,
          points: row.points || 0,
          plusMinus: row.plus_minus || 0,
          shots: row.shots || 0,
          shootingPctg: row.shooting_pctg || 0,
          headshotUrl: info?.headshotUrl,
        };
      });

      const goalies: GoalieStatLine[] = goalieRes.data.map((row: any): GoalieStatLine => {
        const info = playerInfo.get(row.player_id);
        return {
          playerId: row.player_id,
          firstName: info?.first ?? 'Unknown',
          lastName: info?.last ?? `#${row.player_id}`,
          gamesPlayed: row.games_played || 0,
          wins: row.wins || 0,
          losses: row.losses || 0,
          otLosses: row.ot_losses || 0,
          goalsAgainstAvg: row.goals_against_avg || 0,
          savePctg: computeSavePct(row) ?? 0,
          headshotUrl: info?.headshotUrl,
        };
      });

      const result: TeamPlayerStats = { skaters, goalies };
      statsCache.set(teamAbbrev, result);
      console.log(`[PLAYER STATS] [SUPABASE] Loaded ${skaters.length} skaters + ${goalies.length} goalies for ${teamAbbrev}`);
      return result;
    }
    console.warn(`[PLAYER STATS] [SUPABASE] No data for ${teamAbbrev}`);
  } catch (sbError) {
    console.warn(`[PLAYER STATS] [SUPABASE] Error fetching stats for ${teamAbbrev}:`, sbError);
  }

  // No data available — return empty
  return { skaters: [], goalies: [] };
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
