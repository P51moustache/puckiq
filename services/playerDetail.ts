/**
 * Player detail service — fetches comprehensive player data from multiple
 * Supabase tables and views: players, skater/goalie season stats,
 * player_career_data, edge_skater_stats, game_skater_stats (last 5 games),
 * and trend views (hot/cold, pace projections, rolling stats, advanced trends,
 * goalie rolling stats, three star counts).
 *
 * Gracefully handles missing data (career, edge, recent games, trends) by
 * returning null for those sections. Only returns null for the entire result
 * if the player itself does not exist in the players table.
 *
 * 5-minute in-memory cache per player.
 */

import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlayerBio {
  playerId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string;
  teamAbbrev: string;
  sweaterNumber?: number;
  headshotUrl?: string;
  shootsCatches?: string;
  heightInches?: number;
  weightPounds?: number;
  birthDate?: string;
  birthCity?: string;
  birthCountry?: string;
  draftYear?: number;
  draftRound?: number;
  draftPick?: number;
  draftOverall?: number;
}

export interface SkaterSeasonStats {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  powerPlayGoals: number;
  shorthandedGoals: number;
  gameWinningGoals: number;
  shots: number;
  shootingPctg: number;
  avgToi: number;
  faceoffWinPctg: number;
}

export interface GoalieSeasonStats {
  gamesPlayed: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  otLosses: number;
  goalsAgainstAvg: number;
  savePctg: number;
  shotsAgainst: number;
  saves: number;
  shutouts: number;
}

export interface PlayerCareer {
  seasonTotals: any[];
  careerTotals: any;
  awards: any[];
}

export interface PlayerEdgeStats {
  topSpeed?: number;
  topSpeedRank?: number;
  topSpeedPercentile?: number;
  topShotSpeed?: number;
  topShotSpeedRank?: number;
  topShotSpeedPercentile?: number;
  totalDistance?: number;
  burstsOver20?: number;
  offensiveZonePctg?: number;
  neutralZonePctg?: number;
  defensiveZonePctg?: number;
}

export interface RecentGame {
  gameId: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  toi?: string;
  shots?: number;
  hits?: number;
  blockedShots?: number;
  // Goalie-specific
  saves?: number;
  goalsAgainst?: number;
  decision?: string;
}

export interface HotColdData {
  gamesPlayed: number;
  seasonPpg: number;
  recentPpg: number;
  seasonGpg: number;
  recentGpg: number;
  pointStreak: number;
  hotColdScore: number;
  trendLabel: 'HOT' | 'WARM' | 'STEADY' | 'COOL' | 'COLD';
  recentShootingPct: number;
  seasonShootingPct: number;
}

export interface PaceProjections {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  projectedGoals82: number;
  projectedAssists82: number;
  projectedPoints82: number;
  projectedShots82: number;
  projectedPpg82: number;
  goalsPerGame: number;
  pointsPerGame: number;
  shootingPctg: number;
}

export interface RollingStats {
  avgGoals5g: number;
  avgAssists5g: number;
  avgPoints5g: number;
  avgShots5g: number;
  avgHits5g: number;
  avgPm5g: number;
  totalGoals5g: number;
  totalPoints5g: number;
  avgGoals10g: number;
  avgAssists10g: number;
  avgPoints10g: number;
  avgShots10g: number;
  avgGoals20g: number;
  avgPoints20g: number;
  seasonAvgGoals: number;
  seasonAvgPoints: number;
  lastGameDate?: string;
}

export interface AdvancedTrends {
  avgCorsiPct5g?: number;
  avgFenwickPct5g?: number;
  avgOzStart5g?: number;
  avgPdo5g?: number;
  avgCorsiPct10g?: number;
  avgFenwickPct10g?: number;
  avgPdo10g?: number;
  seasonCorsiPct?: number;
  seasonFenwickPct?: number;
  seasonPdo?: number;
  gamesWithAdvanced: number;
}

export interface GoalieTrends {
  avgGa5g: number;
  savePct5g?: number;
  wins5g: number;
  avgGa10g: number;
  savePct10g?: number;
  wins10g: number;
  starts: number;
  seasonSavePct?: number;
  seasonAvgGa: number;
  seasonWins: number;
  seasonShutouts: number;
  lastStartDate?: string;
}

export interface SkaterTrends {
  hotCold: HotColdData | null;
  pace: PaceProjections | null;
  rolling: RollingStats | null;
  advanced: AdvancedTrends | null;
  threeStarCount: number;
}

export interface PlayerDetail {
  bio: PlayerBio;
  seasonStats: any; // SkaterSeasonStats | GoalieSeasonStats depending on position
  career: PlayerCareer | null;
  edgeStats: PlayerEdgeStats | null;
  recentGames: RecentGame[];
  trends: SkaterTrends | GoalieTrends | null;
}

// ---------------------------------------------------------------------------
// Cache (5-min TTL)
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000;
const detailCache = new Map<number, CacheEntry<PlayerDetail>>();

function isCacheValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.timestamp < CACHE_TTL;
}

/** Clear cache (useful for testing). */
export function clearDetailCache(): void {
  detailCache.clear();
}

// ---------------------------------------------------------------------------
// getPlayerDetail
// ---------------------------------------------------------------------------

export async function getPlayerDetail(playerId: number): Promise<PlayerDetail | null> {
  const cached = detailCache.get(playerId);
  if (isCacheValid(cached)) return cached.data;

  try {
    // 1. Fetch player bio (required — null if not found)
    const { data: playerRow, error: playerErr } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (playerErr || !playerRow) {
      console.warn(`[PLAYER DETAIL] Player ${playerId} not found:`, playerErr?.message);
      return null;
    }

    const bio = mapBio(playerRow);
    const isGoalie = bio.position === 'G';

    // 2. Fetch all supplementary data in parallel
    const [seasonStats, career, edgeStats, recentGames, trends] = await Promise.all([
      fetchSeasonStats(playerId, isGoalie),
      fetchCareerData(playerId),
      isGoalie ? Promise.resolve(null) : fetchEdgeStats(playerId),
      fetchRecentGames(playerId, isGoalie),
      isGoalie ? fetchGoalieTrends(playerId) : fetchSkaterTrends(playerId),
    ]);

    const detail: PlayerDetail = {
      bio,
      seasonStats: seasonStats ?? (isGoalie ? defaultGoalieStats() : defaultSkaterStats()),
      career,
      edgeStats,
      recentGames,
      trends,
    };

    detailCache.set(playerId, { data: detail, timestamp: Date.now() });
    console.log(`[PLAYER DETAIL] Loaded detail for ${bio.fullName} (${bio.position})`);
    return detail;
  } catch (err) {
    console.error(`[PLAYER DETAIL] Error fetching detail for ${playerId}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sub-fetchers
// ---------------------------------------------------------------------------

async function fetchSeasonStats(
  playerId: number,
  isGoalie: boolean,
): Promise<SkaterSeasonStats | GoalieSeasonStats | null> {
  try {
    if (isGoalie) {
      const { data: rows, error } = await supabase
        .from('goalie_season_stats')
        .select('*')
        .eq('player_id', playerId)
        .order('season', { ascending: false })
        .limit(1);

      if (error || !rows || rows.length === 0) return null;
      const row = rows[0];
      return {
        gamesPlayed: row.games_played || 0,
        gamesStarted: row.games_started || 0,
        wins: row.wins || 0,
        losses: row.losses || 0,
        otLosses: row.ot_losses || 0,
        goalsAgainstAvg: row.goals_against_avg || 0,
        savePctg: row.save_pctg || 0,
        shotsAgainst: row.shots_against || 0,
        saves: row.saves || 0,
        shutouts: row.shutouts || 0,
      } as GoalieSeasonStats;
    }

    const { data: rows, error } = await supabase
      .from('skater_season_stats')
      .select('*')
      .eq('player_id', playerId)
      .order('season', { ascending: false })
      .limit(1);

    if (error || !rows || rows.length === 0) return null;
    const row = rows[0];
    return {
      gamesPlayed: row.games_played || 0,
      goals: row.goals || 0,
      assists: row.assists || 0,
      points: row.points || 0,
      plusMinus: row.plus_minus || 0,
      pim: row.pim || 0,
      powerPlayGoals: row.power_play_goals || 0,
      shorthandedGoals: row.shorthanded_goals || 0,
      gameWinningGoals: row.game_winning_goals || 0,
      shots: row.shots || 0,
      shootingPctg: row.shooting_pctg || 0,
      avgToi: row.avg_toi_per_game || 0,
      faceoffWinPctg: row.faceoff_win_pctg || 0,
    } as SkaterSeasonStats;
  } catch (err) {
    console.warn(`[PLAYER DETAIL] Season stats error for ${playerId}:`, err);
    return null;
  }
}

async function fetchCareerData(playerId: number): Promise<PlayerCareer | null> {
  try {
    const { data: row, error } = await supabase
      .from('player_career_data')
      .select('*')
      .eq('player_id', playerId)
      .single();

    if (error || !row) return null;

    return {
      seasonTotals: row.season_totals || [],
      careerTotals: row.career_totals || {},
      awards: row.awards || [],
    };
  } catch {
    return null;
  }
}

async function fetchEdgeStats(playerId: number): Promise<PlayerEdgeStats | null> {
  try {
    const { data: rows, error } = await supabase
      .from('edge_skater_stats')
      .select('*')
      .eq('player_id', playerId)
      .limit(1);

    if (error || !rows || rows.length === 0) return null;
    const row = rows[0];

    return {
      topSpeed: row.max_skating_speed_mph ?? undefined,
      topSpeedRank: row.max_skating_speed_rank ?? undefined,
      topSpeedPercentile: row.max_skating_speed_percentile ?? undefined,
      topShotSpeed: row.top_shot_speed_mph ?? undefined,
      topShotSpeedRank: row.top_shot_speed_rank ?? undefined,
      topShotSpeedPercentile: row.top_shot_speed_percentile ?? undefined,
      totalDistance: row.total_distance_miles ?? undefined,
      burstsOver20: row.bursts_over_20 ?? undefined,
      offensiveZonePctg: row.offensive_zone_pctg ?? undefined,
      neutralZonePctg: row.neutral_zone_pctg ?? undefined,
      defensiveZonePctg: row.defensive_zone_pctg ?? undefined,
    };
  } catch {
    return null;
  }
}

async function fetchRecentGames(
  playerId: number,
  isGoalie: boolean,
): Promise<RecentGame[]> {
  try {
    if (isGoalie) {
      const { data: rows, error } = await supabase
        .from('game_goalie_stats')
        .select('*')
        .eq('player_id', playerId)
        .order('game_id', { ascending: false })
        .limit(5);

      if (error || !rows) return [];
      return rows.map((row: any) => ({
        gameId: row.game_id,
        goals: 0,
        assists: 0,
        points: 0,
        plusMinus: 0,
        saves: row.saves || 0,
        goalsAgainst: row.goals_against || 0,
        decision: row.decision ?? undefined,
        toi: row.toi ?? undefined,
      }));
    }

    const { data: rows, error } = await supabase
      .from('game_skater_stats')
      .select('*')
      .eq('player_id', playerId)
      .order('game_id', { ascending: false })
      .limit(5);

    if (error || !rows) return [];
    return rows.map((row: any) => ({
      gameId: row.game_id,
      goals: row.goals || 0,
      assists: row.assists || 0,
      points: row.points || 0,
      plusMinus: row.plus_minus || 0,
      toi: row.toi ?? undefined,
      shots: row.shots_on_goal ?? undefined,
      hits: row.hits ?? undefined,
      blockedShots: row.blocked_shots ?? undefined,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Trend fetchers (SQL views)
// ---------------------------------------------------------------------------

async function fetchSkaterTrends(playerId: number): Promise<SkaterTrends | null> {
  try {
    const [hotCold, pace, rolling, advanced, threeStarCount] = await Promise.all([
      fetchHotCold(playerId),
      fetchPaceProjections(playerId),
      fetchRollingStats(playerId),
      fetchAdvancedTrends(playerId),
      fetchThreeStarCount(playerId),
    ]);

    // Return null only if all sub-sections are empty
    if (!hotCold && !pace && !rolling && !advanced && threeStarCount === 0) {
      return null;
    }

    return { hotCold, pace, rolling, advanced, threeStarCount };
  } catch {
    return null;
  }
}

async function fetchGoalieTrends(playerId: number): Promise<GoalieTrends | null> {
  try {
    const { data: rows, error } = await supabase
      .from('goalie_rolling_stats')
      .select('*')
      .eq('player_id', playerId)
      .limit(1);

    if (error || !rows || rows.length === 0) return null;
    const row = rows[0];

    return {
      avgGa5g: row.avg_ga_5g ?? 0,
      savePct5g: row.save_pct_5g ?? undefined,
      wins5g: row.wins_5g ?? 0,
      avgGa10g: row.avg_ga_10g ?? 0,
      savePct10g: row.save_pct_10g ?? undefined,
      wins10g: row.wins_10g ?? 0,
      starts: row.starts ?? 0,
      seasonSavePct: row.season_save_pct ?? undefined,
      seasonAvgGa: row.season_avg_ga ?? 0,
      seasonWins: row.season_wins ?? 0,
      seasonShutouts: row.season_shutouts ?? 0,
      lastStartDate: row.last_start_date ?? undefined,
    };
  } catch {
    return null;
  }
}

async function fetchHotCold(playerId: number): Promise<HotColdData | null> {
  try {
    const { data: rows, error } = await supabase
      .from('skater_hot_cold')
      .select('*')
      .eq('player_id', playerId)
      .limit(1);

    if (error || !rows || rows.length === 0) return null;
    const row = rows[0];

    return {
      gamesPlayed: row.games_played ?? 0,
      seasonPpg: row.season_ppg ?? 0,
      recentPpg: row.recent_ppg ?? 0,
      seasonGpg: row.season_gpg ?? 0,
      recentGpg: row.recent_gpg ?? 0,
      pointStreak: row.point_streak ?? 0,
      hotColdScore: row.hot_cold_score ?? 0,
      trendLabel: row.trend_label ?? 'STEADY',
      recentShootingPct: row.recent_shooting_pct ?? 0,
      seasonShootingPct: row.season_shooting_pct ?? 0,
    };
  } catch {
    return null;
  }
}

async function fetchPaceProjections(playerId: number): Promise<PaceProjections | null> {
  try {
    const { data: rows, error } = await supabase
      .from('skater_pace_projections')
      .select('*')
      .eq('player_id', playerId)
      .limit(1);

    if (error || !rows || rows.length === 0) return null;
    const row = rows[0];

    return {
      gamesPlayed: row.games_played ?? 0,
      goals: row.goals ?? 0,
      assists: row.assists ?? 0,
      points: row.points ?? 0,
      projectedGoals82: row.projected_goals_82 ?? 0,
      projectedAssists82: row.projected_assists_82 ?? 0,
      projectedPoints82: row.projected_points_82 ?? 0,
      projectedShots82: row.projected_shots_82 ?? 0,
      projectedPpg82: row.projected_ppg_82 ?? 0,
      goalsPerGame: row.goals_per_game ?? 0,
      pointsPerGame: row.points_per_game ?? 0,
      shootingPctg: row.shooting_pctg ?? 0,
    };
  } catch {
    return null;
  }
}

async function fetchRollingStats(playerId: number): Promise<RollingStats | null> {
  try {
    const { data: rows, error } = await supabase
      .from('skater_rolling_stats')
      .select('*')
      .eq('player_id', playerId)
      .limit(1);

    if (error || !rows || rows.length === 0) return null;
    const row = rows[0];

    return {
      avgGoals5g: row.avg_goals_5g ?? 0,
      avgAssists5g: row.avg_assists_5g ?? 0,
      avgPoints5g: row.avg_points_5g ?? 0,
      avgShots5g: row.avg_shots_5g ?? 0,
      avgHits5g: row.avg_hits_5g ?? 0,
      avgPm5g: row.avg_pm_5g ?? 0,
      totalGoals5g: row.total_goals_5g ?? 0,
      totalPoints5g: row.total_points_5g ?? 0,
      avgGoals10g: row.avg_goals_10g ?? 0,
      avgAssists10g: row.avg_assists_10g ?? 0,
      avgPoints10g: row.avg_points_10g ?? 0,
      avgShots10g: row.avg_shots_10g ?? 0,
      avgGoals20g: row.avg_goals_20g ?? 0,
      avgPoints20g: row.avg_points_20g ?? 0,
      seasonAvgGoals: row.season_avg_goals ?? 0,
      seasonAvgPoints: row.season_avg_points ?? 0,
      lastGameDate: row.last_game_date ?? undefined,
    };
  } catch {
    return null;
  }
}

async function fetchAdvancedTrends(playerId: number): Promise<AdvancedTrends | null> {
  try {
    const { data: rows, error } = await supabase
      .from('skater_advanced_trends')
      .select('*')
      .eq('player_id', playerId)
      .limit(1);

    if (error || !rows || rows.length === 0) return null;
    const row = rows[0];

    return {
      avgCorsiPct5g: row.avg_corsi_pct_5g ?? undefined,
      avgFenwickPct5g: row.avg_fenwick_pct_5g ?? undefined,
      avgOzStart5g: row.avg_oz_start_5g ?? undefined,
      avgPdo5g: row.avg_pdo_5g ?? undefined,
      avgCorsiPct10g: row.avg_corsi_pct_10g ?? undefined,
      avgFenwickPct10g: row.avg_fenwick_pct_10g ?? undefined,
      avgPdo10g: row.avg_pdo_10g ?? undefined,
      seasonCorsiPct: row.season_corsi_pct ?? undefined,
      seasonFenwickPct: row.season_fenwick_pct ?? undefined,
      seasonPdo: row.season_pdo ?? undefined,
      gamesWithAdvanced: row.games_with_advanced ?? 0,
    };
  } catch {
    return null;
  }
}

async function fetchThreeStarCount(playerId: number): Promise<number> {
  try {
    const { data: rows, error } = await supabase
      .from('game_three_stars')
      .select('star_number')
      .eq('player_id', playerId);

    if (error || !rows) return 0;
    return rows.length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapBio(row: any): PlayerBio {
  return {
    playerId: row.id,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    fullName: row.full_name || `${row.first_name} ${row.last_name}`,
    position: row.position || '',
    teamAbbrev: row.current_team_abbrev || '',
    sweaterNumber: row.sweater_number ?? undefined,
    headshotUrl: row.headshot_url ?? undefined,
    shootsCatches: row.shoots_catches ?? undefined,
    heightInches: row.height_inches ?? undefined,
    weightPounds: row.weight_pounds ?? undefined,
    birthDate: row.birth_date ?? undefined,
    birthCity: row.birth_city ?? undefined,
    birthCountry: row.birth_country ?? undefined,
    draftYear: row.draft_year ?? undefined,
    draftRound: row.draft_round ?? undefined,
    draftPick: row.draft_pick ?? undefined,
    draftOverall: row.draft_overall ?? undefined,
  };
}

function defaultSkaterStats(): SkaterSeasonStats {
  return {
    gamesPlayed: 0, goals: 0, assists: 0, points: 0, plusMinus: 0,
    pim: 0, powerPlayGoals: 0, shorthandedGoals: 0, gameWinningGoals: 0,
    shots: 0, shootingPctg: 0, avgToi: 0, faceoffWinPctg: 0,
  };
}

function defaultGoalieStats(): GoalieSeasonStats {
  return {
    gamesPlayed: 0, gamesStarted: 0, wins: 0, losses: 0, otLosses: 0,
    goalsAgainstAvg: 0, savePctg: 0, shotsAgainst: 0, saves: 0, shutouts: 0,
  };
}

/** Visible for testing */
export const _internals = {
  detailCache,
  CACHE_TTL,
  mapBio,
  fetchSeasonStats,
  fetchCareerData,
  fetchEdgeStats,
  fetchRecentGames,
  fetchSkaterTrends,
  fetchGoalieTrends,
  fetchHotCold,
  fetchPaceProjections,
  fetchRollingStats,
  fetchAdvancedTrends,
  fetchThreeStarCount,
};
