/**
 * Fetches real team statistics from Supabase for use in predictions
 * Uses the team_stat_categories table (stat_category = 'summary') which contains
 * official NHL stats synced via the sync pipeline.
 *
 * Data source: Supabase `team_stat_categories` table (synced from NHL API via GitHub Actions)
 */

import type { TeamPredictionStats } from '../types/predictions';
import { supabase } from '../lib/supabase';

// Cache for team stats (refreshed once per session)
let cachedTeamStats: Map<string, TeamPredictionStats> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour cache

/**
 * Fetch all team stats from Supabase (team_stat_categories, summary category)
 * Returns a Map of team abbreviation -> stats
 */
export async function fetchAllTeamStats(): Promise<Map<string, TeamPredictionStats>> {
  // Check cache first
  const now = Date.now();
  if (cachedTeamStats && (now - cacheTimestamp) < CACHE_DURATION_MS) {
    return cachedTeamStats;
  }

  try {
    const { data, error } = await supabase
      .from('team_stat_categories')
      .select('team_abbrev, data')
      .eq('stat_category', 'summary');

    if (error || !data) {
      console.error('[Team Stats] Supabase query failed:', error?.message);
      return cachedTeamStats || new Map();
    }

    const statsMap = new Map<string, TeamPredictionStats>();

    for (const row of data) {
      const abbrev = row.team_abbrev;
      const stats = row.data as any;

      if (!abbrev || !stats) continue;

      statsMap.set(abbrev, {
        powerPlayPct: stats.powerPlayPct || 0,
        penaltyKillPct: stats.penaltyKillPct || 0,
        shotsForPerGame: stats.shotsForPerGame || 0,
        shotsAgainstPerGame: stats.shotsAgainstPerGame || 0,
      });
    }

    // Update cache
    cachedTeamStats = statsMap;
    cacheTimestamp = now;

    console.log(`[Team Stats] Loaded stats for ${statsMap.size} teams from Supabase`);
    return statsMap;
  } catch (error) {
    console.error('[Team Stats] Error fetching team stats:', error);
    return cachedTeamStats || new Map();
  }
}

/**
 * Get stats for a specific team
 */
export async function getTeamStats(teamAbbrev: string): Promise<TeamPredictionStats | null> {
  const allStats = await fetchAllTeamStats();
  return allStats.get(teamAbbrev) || null;
}

/**
 * Get stats for both teams in a matchup
 */
export async function getMatchupTeamStats(
  homeAbbrev: string,
  awayAbbrev: string
): Promise<{ home: TeamPredictionStats | null; away: TeamPredictionStats | null }> {
  const allStats = await fetchAllTeamStats();
  return {
    home: allStats.get(homeAbbrev) || null,
    away: allStats.get(awayAbbrev) || null,
  };
}

/**
 * Clear the cache (useful for testing or forcing refresh)
 */
export function clearTeamStatsCache(): void {
  cachedTeamStats = null;
  cacheTimestamp = 0;
}
