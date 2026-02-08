/**
 * Player Prediction Service
 * Fetches and analyzes player data to enhance game predictions
 *
 * Key factors:
 * - Goalie matchup comparison
 * - Hot/cold player identification
 * - Recent form analysis
 */

import type {
  PlayerInfo,
  GoalieStats,
  PlayerRecentForm,
  GoalieMatchup,
  TeamHotPlayers,
  PlayerPredictionFactors,
} from '../types/predictions';
import { supabase } from '../lib/supabase';

// Cache for player data (expires after 30 minutes)
const CACHE_DURATION = 30 * 60 * 1000;
const playerCache = new Map<string, { data: any; timestamp: number }>();

/**
 * Get cached data or fetch new
 */
function getCachedData<T>(key: string): T | null {
  const cached = playerCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T;
  }
  return null;
}

/**
 * Set cache data
 */
function setCachedData(key: string, data: any): void {
  playerCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Fetch team roster with player details
 */
export async function fetchTeamRoster(teamAbbrev: string): Promise<PlayerInfo[]> {
  const cacheKey = `roster_${teamAbbrev}`;
  const cached = getCachedData<PlayerInfo[]>(cacheKey);
  if (cached) return cached;

  // --- Supabase-first: try reading from players table ---
  try {
    const { data: sbPlayers, error: sbError } = await supabase
      .from('players')
      .select('*')
      .eq('current_team_abbrev', teamAbbrev)
      .eq('is_active', true);

    if (!sbError && sbPlayers && sbPlayers.length > 0) {
      const players: PlayerInfo[] = sbPlayers.map((p: any): PlayerInfo => {
        const position = p.position || 'C';
        const positionType: 'F' | 'D' | 'G' = position === 'G' ? 'G' : (position === 'D' ? 'D' : 'F');
        return {
          id: p.id,
          firstName: p.first_name || '',
          lastName: p.last_name || '',
          fullName: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          teamAbbrev,
          position: position as PlayerInfo['position'],
          positionType,
          sweaterNumber: p.sweater_number,
        };
      });
      setCachedData(cacheKey, players);
      return players;
    }
  } catch {
    // Silently handle — roster data may not be fully seeded yet
  }

  // No data available — return empty
  return [];
}

/**
 * Fetch player's season stats
 *
 * NOTE: Player career data queries are temporarily disabled (2026-02-07).
 * The player_career_data table is still being seeded (~22% complete).
 * Re-enable once seeding is complete by removing the early return below.
 */
export async function fetchPlayerStats(playerId: number): Promise<{
  skaterStats?: any;
  goalieStats?: GoalieStats;
  last5Games?: any[];
} | null> {
  // TEMPORARILY DISABLED: player_career_data seeding incomplete.
  // Queries for unseeded players spam console with warnings.
  // Re-enable when seed-player-career.mjs has finished running.
  return null;
}

/**
 * Calculate player's recent form from last 5 games
 */
function calculateRecentForm(
  playerId: number,
  playerName: string,
  position: string,
  last5Games: any[],
  seasonStats: any
): PlayerRecentForm {
  const isGoalie = position === 'G';
  const gamesPlayed = last5Games.length;

  if (gamesPlayed === 0) {
    return {
      playerId,
      playerName,
      position,
      gamesPlayed: 0,
      isHot: false,
      isCold: false,
    };
  }

  if (isGoalie) {
    // Goalie form
    const wins = last5Games.filter(g => g.decision === 'W').length;
    const totalSaves = last5Games.reduce((sum, g) => sum + (g.saves || 0), 0);
    const totalShots = last5Games.reduce((sum, g) => sum + (g.shotsAgainst || 0), 0);
    const savePct = totalShots > 0 ? totalSaves / totalShots : 0;
    const totalGA = last5Games.reduce((sum, g) => sum + (g.goalsAgainst || 0), 0);
    const gaa = gamesPlayed > 0 ? totalGA / gamesPlayed : 0;

    // Compare to season average
    const seasonSavePct = seasonStats?.savePctg || seasonStats?.savePercentage || 0.9;
    const seasonGAA = seasonStats?.goalsAgainstAvg || seasonStats?.gaa || 3.0;

    const isHot = savePct > seasonSavePct + 0.01 || wins >= 3;
    const isCold = savePct < seasonSavePct - 0.02 || wins <= 1;

    return {
      playerId,
      playerName,
      position,
      gamesPlayed,
      wins,
      savePercentage: savePct,
      goalsAgainstAverage: gaa,
      isHot,
      isCold,
      hotStreak: countGoalieStreak(last5Games),
    };
  } else {
    // Skater form
    const goals = last5Games.reduce((sum, g) => sum + (g.goals || 0), 0);
    const assists = last5Games.reduce((sum, g) => sum + (g.assists || 0), 0);
    const points = goals + assists;
    const plusMinus = last5Games.reduce((sum, g) => sum + (g.plusMinus || 0), 0);

    // Calculate per-game averages
    const ppg = points / gamesPlayed;
    const seasonPPG = seasonStats?.points && seasonStats?.gamesPlayed
      ? seasonStats.points / seasonStats.gamesPlayed
      : 0.5;

    const isHot = ppg > seasonPPG * 1.2 || points >= 5;
    const isCold = ppg < seasonPPG * 0.5 && points <= 1;

    return {
      playerId,
      playerName,
      position,
      gamesPlayed,
      goals,
      assists,
      points,
      plusMinus,
      isHot,
      isCold,
      hotStreak: countSkaterStreak(last5Games),
    };
  }
}

/**
 * Count consecutive games with points for skaters
 */
function countSkaterStreak(games: any[]): number {
  let streak = 0;
  for (const game of games) {
    if ((game.goals || 0) + (game.assists || 0) > 0) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Count consecutive wins for goalies
 */
function countGoalieStreak(games: any[]): number {
  let streak = 0;
  for (const game of games) {
    if (game.decision === 'W') {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Get team's hot players analysis
 */
export async function getTeamHotPlayers(teamAbbrev: string): Promise<TeamHotPlayers> {
  const cacheKey = `hot_${teamAbbrev}`;
  const cached = getCachedData<TeamHotPlayers>(cacheKey);
  if (cached) return cached;

  try {
    const roster = await fetchTeamRoster(teamAbbrev);
    const hotPlayers: PlayerRecentForm[] = [];
    const coldPlayers: PlayerRecentForm[] = [];

    // Get top players (by jersey number proxy, or first 12 skaters + 2 goalies)
    const topSkaters = roster.filter(p => p.positionType !== 'G').slice(0, 12);
    const goalies = roster.filter(p => p.positionType === 'G').slice(0, 2);
    const playersToCheck = [...topSkaters, ...goalies];

    for (const player of playersToCheck) {
      const stats = await fetchPlayerStats(player.id);
      if (stats && stats.last5Games && stats.last5Games.length > 0) {
        const form = calculateRecentForm(
          player.id,
          player.fullName,
          player.positionType,
          stats.last5Games,
          stats.skaterStats || stats.goalieStats
        );

        if (form.isHot) {
          hotPlayers.push(form);
        } else if (form.isCold) {
          coldPlayers.push(form);
        }
      }
    }

    // Calculate heat index: +1 per hot player, -1 per cold player, capped at ±10
    const heatIndex = Math.max(-10, Math.min(10, hotPlayers.length - coldPlayers.length));

    const result: TeamHotPlayers = {
      teamAbbrev,
      hotPlayers,
      coldPlayers,
      injuredStars: [], // Would need injury API for this
      overallHeatIndex: heatIndex,
    };

    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    console.error(`[Player Prediction] Error getting hot players for ${teamAbbrev}:`, error);
    return {
      teamAbbrev,
      hotPlayers: [],
      coldPlayers: [],
      injuredStars: [],
      overallHeatIndex: 0,
    };
  }
}

/**
 * Get goalie matchup analysis for a game
 */
export async function getGoalieMatchup(
  homeTeamAbbrev: string,
  awayTeamAbbrev: string
): Promise<GoalieMatchup> {
  try {
    // Fetch rosters to get goalies
    const [homeRoster, awayRoster] = await Promise.all([
      fetchTeamRoster(homeTeamAbbrev),
      fetchTeamRoster(awayTeamAbbrev),
    ]);

    const homeGoalies = homeRoster.filter(p => p.positionType === 'G');
    const awayGoalies = awayRoster.filter(p => p.positionType === 'G');

    // Get stats for primary goalies (first in list, usually starter)
    const homeGoalie = homeGoalies[0];
    const awayGoalie = awayGoalies[0];

    let homeGoalieData = null;
    let awayGoalieData = null;

    if (homeGoalie) {
      const stats = await fetchPlayerStats(homeGoalie.id);
      if (stats) {
        homeGoalieData = {
          id: homeGoalie.id,
          name: homeGoalie.fullName,
          seasonStats: stats.goalieStats || null,
          recentForm: stats.last5Games
            ? calculateRecentForm(homeGoalie.id, homeGoalie.fullName, 'G', stats.last5Games, stats.goalieStats)
            : null,
          isConfirmed: false, // Would need game preview API for confirmed starters
        };
      }
    }

    if (awayGoalie) {
      const stats = await fetchPlayerStats(awayGoalie.id);
      if (stats) {
        awayGoalieData = {
          id: awayGoalie.id,
          name: awayGoalie.fullName,
          seasonStats: stats.goalieStats || null,
          recentForm: stats.last5Games
            ? calculateRecentForm(awayGoalie.id, awayGoalie.fullName, 'G', stats.last5Games, stats.goalieStats)
            : null,
          isConfirmed: false,
        };
      }
    }

    // Calculate advantage based on save percentage and GAA
    const { advantage, impact } = calculateGoalieAdvantage(
      homeGoalieData?.seasonStats,
      awayGoalieData?.seasonStats,
      homeGoalieData?.recentForm,
      awayGoalieData?.recentForm
    );

    return {
      homeGoalie: homeGoalieData,
      awayGoalie: awayGoalieData,
      advantage,
      confidenceImpact: impact,
    };
  } catch (error) {
    console.error(`[Player Prediction] Error getting goalie matchup:`, error);
    return {
      homeGoalie: null,
      awayGoalie: null,
      advantage: 'neutral',
      confidenceImpact: 0,
    };
  }
}

/**
 * Calculate goalie advantage between two goalies
 */
function calculateGoalieAdvantage(
  homeStats: GoalieStats | null | undefined,
  awayStats: GoalieStats | null | undefined,
  homeForm: PlayerRecentForm | null | undefined,
  awayForm: PlayerRecentForm | null | undefined
): { advantage: 'home' | 'away' | 'neutral'; impact: number } {
  if (!homeStats && !awayStats) {
    return { advantage: 'neutral', impact: 0 };
  }

  let homeScore = 0;
  let awayScore = 0;

  // Season save percentage (weight: 40%)
  if (homeStats?.savePercentage && awayStats?.savePercentage) {
    const svPctDiff = (homeStats.savePercentage - awayStats.savePercentage) * 100;
    homeScore += svPctDiff * 4; // 1% SV% diff = 4 points
  }

  // Season GAA (weight: 30%) - lower is better
  if (homeStats?.goalsAgainstAverage && awayStats?.goalsAgainstAverage) {
    const gaaDiff = awayStats.goalsAgainstAverage - homeStats.goalsAgainstAverage;
    homeScore += gaaDiff * 3; // 1.0 GAA diff = 3 points
  }

  // Recent form (weight: 30%)
  if (homeForm && awayForm) {
    // Hot/cold bonus
    if (homeForm.isHot) homeScore += 3;
    if (homeForm.isCold) homeScore -= 3;
    if (awayForm.isHot) awayScore += 3;
    if (awayForm.isCold) awayScore -= 3;
  }

  const netScore = homeScore - awayScore;

  // Cap impact at ±15
  const impact = Math.max(-15, Math.min(15, Math.round(netScore)));

  let advantage: 'home' | 'away' | 'neutral' = 'neutral';
  if (impact >= 3) advantage = 'home';
  else if (impact <= -3) advantage = 'away';

  return { advantage, impact };
}

/**
 * Get all player prediction factors for a game
 */
export async function getPlayerPredictionFactors(
  homeTeamAbbrev: string,
  awayTeamAbbrev: string
): Promise<PlayerPredictionFactors> {
  try {
    const [goalieMatchup, homeHotPlayers, awayHotPlayers] = await Promise.all([
      getGoalieMatchup(homeTeamAbbrev, awayTeamAbbrev),
      getTeamHotPlayers(homeTeamAbbrev),
      getTeamHotPlayers(awayTeamAbbrev),
    ]);

    // Calculate total impact
    let totalImpact = 0;

    // Goalie matchup impact (±15)
    totalImpact += goalieMatchup.confidenceImpact;

    // Hot players differential (±10)
    const hotPlayersDiff = homeHotPlayers.overallHeatIndex - awayHotPlayers.overallHeatIndex;
    totalImpact += hotPlayersDiff;

    // Cap total at ±25
    totalImpact = Math.max(-25, Math.min(25, totalImpact));

    return {
      goalieMatchup,
      homeHotPlayers,
      awayHotPlayers,
      totalImpact,
    };
  } catch (error) {
    console.error(`[Player Prediction] Error getting prediction factors:`, error);
    return {
      goalieMatchup: null,
      homeHotPlayers: null,
      awayHotPlayers: null,
      totalImpact: 0,
    };
  }
}

/**
 * Clear the player cache (useful for testing or manual refresh)
 */
export function clearPlayerCache(): void {
  playerCache.clear();
}
