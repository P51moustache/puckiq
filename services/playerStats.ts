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
