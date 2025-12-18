/**
 * Fetches real team statistics from NHL API for use in predictions
 * Only uses verified real data from the team summary endpoint
 */

import type { TeamPredictionStats } from '../types/predictions';

// Map team abbreviation to team ID (NHL API uses IDs)
const TEAM_ID_MAP: Record<string, number> = {
  'ANA': 24, 'BOS': 6, 'BUF': 7, 'CAR': 12, 'CBJ': 29, 'CGY': 20,
  'CHI': 16, 'COL': 21, 'DAL': 25, 'DET': 17, 'EDM': 22, 'FLA': 13,
  'LAK': 26, 'MIN': 30, 'MTL': 8, 'NJD': 1, 'NSH': 18, 'NYI': 2,
  'NYR': 3, 'OTT': 9, 'PHI': 4, 'PIT': 5, 'SEA': 55, 'SJS': 28,
  'STL': 19, 'TBL': 14, 'TOR': 10, 'VAN': 23, 'VGK': 54, 'WPG': 52,
  'WSH': 15, 'UTA': 53,
};

// Reverse map: ID to abbreviation
const TEAM_ABBREV_MAP: Record<number, string> = Object.entries(TEAM_ID_MAP).reduce(
  (acc, [abbrev, id]) => ({ ...acc, [id]: abbrev }),
  {} as Record<number, string>
);

// Cache for team stats (refreshed once per session)
let cachedTeamStats: Map<string, TeamPredictionStats> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour cache

/**
 * Get current NHL season ID in format YYYYYYYY (e.g., 20242025)
 */
function getCurrentSeasonId(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();

  // NHL season runs October to June
  // Oct-Dec: current season (e.g., 2024 -> 20242025)
  // Jan-June: season started last year (e.g., 2025 -> 20242025)
  // July-Sept: previous season
  if (month >= 6 && month <= 8) {
    return `${year - 1}${year}`;
  } else if (month >= 0 && month <= 5) {
    return `${year - 1}${year}`;
  } else {
    return `${year}${year + 1}`;
  }
}

/**
 * Fetch all team stats from NHL API
 * Returns a Map of team abbreviation -> stats
 */
export async function fetchAllTeamStats(): Promise<Map<string, TeamPredictionStats>> {
  // Check cache first
  const now = Date.now();
  if (cachedTeamStats && (now - cacheTimestamp) < CACHE_DURATION_MS) {
    return cachedTeamStats;
  }

  try {
    const seasonId = getCurrentSeasonId();
    const url = `https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=seasonId=${seasonId}%20and%20gameTypeId=2`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error('[Team Stats] Failed to fetch team summary:', response.status);
      return cachedTeamStats || new Map();
    }

    const data = await response.json();
    const teams = data.data || [];

    const statsMap = new Map<string, TeamPredictionStats>();

    for (const team of teams) {
      const teamId = team.teamId;
      const abbrev = TEAM_ABBREV_MAP[teamId];

      if (!abbrev) {
        console.warn(`[Team Stats] Unknown team ID: ${teamId}`);
        continue;
      }

      // Extract REAL stats from NHL API (these are official stats)
      statsMap.set(abbrev, {
        powerPlayPct: team.powerPlayPct || 0,        // Real PP%
        penaltyKillPct: team.penaltyKillPct || 0,    // Real PK%
        shotsForPerGame: team.shotsForPerGame || 0,  // Real shots/game
        shotsAgainstPerGame: team.shotsAgainstPerGame || 0, // Real shots against/game
      });
    }

    // Update cache
    cachedTeamStats = statsMap;
    cacheTimestamp = now;

    console.log(`[Team Stats] Fetched stats for ${statsMap.size} teams`);
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
