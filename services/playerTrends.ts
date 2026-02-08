/**
 * Player Trends Service — fetches trending/streaking players from Supabase views.
 * Powers the redesigned Players tab "Edge Finder" with hot/cold detection,
 * hit rates, and L10 game-level stats for trend visualization.
 *
 * Primary data sources:
 * - skater_trend_summary (view) — rolling stats + hot/cold + pace
 * - game_skater_stats (table) — per-game boxscores for hit rates & trend bars
 * - games (table) — tonight's schedule
 * - goalie_rolling_stats (view) — goalie trends
 * - goalie_season_stats (table) — goalie season totals
 * - players (table) — headshots, names
 *
 * 5-minute in-memory cache following existing service patterns.
 */

import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StatCategory = 'goals' | 'assists' | 'points' | 'shots';

export interface TrendingPlayer {
  playerId: number;
  playerName: string;
  firstName: string;
  lastName: string;
  headshotUrl?: string;
  teamAbbrev: string;
  position: string;
  trendLabel: 'HOT' | 'WARM' | 'STEADY' | 'COOL' | 'COLD';
  hotColdScore: number;
  pointStreak: number;
  recentPpg: number;
  seasonPpg: number;
  recentGpg: number;
  seasonGpg: number;
  recentShootingPct: number;
  seasonShootingPct: number;
  // Rolling stats
  avgGoals5g: number;
  avgAssists5g: number;
  avgPoints5g: number;
  avgShots5g: number;
  avgGoals10g: number;
  avgPoints10g: number;
  // Season totals
  gamesPlayed: number;
  seasonGoals: number;
  seasonAssists: number;
  seasonPoints: number;
  // Per-game shot averages (from skater_hot_cold)
  recentShotsPerGame: number;
  seasonShotsPerGame: number;
  // Matchup (populated for tonight's players)
  matchup?: {
    opponent: string;
    gameTime: string;
    isHome: boolean;
    gameId: number;
  };
}

export interface TrendingGoalie {
  playerId: number;
  playerName: string;
  firstName: string;
  lastName: string;
  headshotUrl?: string;
  teamAbbrev: string;
  trendLabel: 'HOT' | 'WARM' | 'STEADY' | 'COOL' | 'COLD';
  // Rolling
  avgGa5g: number;
  savePct5g: number | null;
  wins5g: number;
  avgGa10g: number;
  savePct10g: number | null;
  wins10g: number;
  // Season
  starts: number;
  seasonSavePct: number | null;
  seasonAvgGa: number;
  seasonWins: number;
  seasonShutouts: number;
  // Season stats
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  goalsAgainstAvg: number;
  savePctg: number;
}

export interface HitRateResult {
  hit: number;
  total: number;
  rate: number;
  games: Array<{
    gameId: number;
    value: number;
    exceeded: boolean;
    gameDate: string;
  }>;
}

export interface L10GameStat {
  gameId: number;
  gameDate: string;
  value: number;
}

export interface LeaderTrend {
  playerId: number;
  trendLabel: 'HOT' | 'WARM' | 'STEADY' | 'COOL' | 'COLD';
  hotColdScore: number;
  pointStreak: number;
  recentPpg: number;
  seasonPpg: number;
  // Pace projections
  projectedGoals82: number;
  projectedAssists82: number;
  projectedPoints82: number;
  goalsPerGame: number;
  pointsPerGame: number;
}

// ---------------------------------------------------------------------------
// Cache (5-min TTL)
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000;
const trendCache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = trendCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  return null;
}

function setCache(key: string, data: any): void {
  trendCache.set(key, { data, timestamp: Date.now() });
}

/** Clear all caches (useful for testing). */
export function clearTrendsCache(): void {
  trendCache.clear();
}

// ---------------------------------------------------------------------------
// Stat column mapping for game_skater_stats
// ---------------------------------------------------------------------------

const STAT_COLUMN_MAP: Record<StatCategory, string> = {
  goals: 'goals',
  assists: 'assists',
  points: 'points',
  shots: 'shots_on_goal',
};

// Default thresholds for hit rate (over/under lines commonly used)
const DEFAULT_THRESHOLDS: Record<StatCategory, number> = {
  goals: 0.5,
  assists: 0.5,
  points: 0.5,
  shots: 2.5,
};

// ---------------------------------------------------------------------------
// getLeaderTrends
// ---------------------------------------------------------------------------

/**
 * Batch fetch trend data (hot/cold + pace projections) for a list of player IDs.
 * Used to annotate leader rows with trend badges and pace projection info.
 * Returns a Map keyed by playerId for O(1) lookup in rendering.
 */
export async function getLeaderTrends(
  playerIds: number[],
): Promise<Map<number, LeaderTrend>> {
  if (playerIds.length === 0) return new Map();

  // Cache key based on sorted player IDs for deterministic keys
  const sortedIds = [...playerIds].sort((a, b) => a - b);
  const cacheKey = `leader-trends:${sortedIds.join(',')}`;
  const cached = getCached<Map<number, LeaderTrend>>(cacheKey);
  if (cached) return cached;

  try {
    // Parallel fetch: hot/cold data + pace projections
    const [hcRes, paceRes] = await Promise.all([
      supabase
        .from('skater_hot_cold')
        .select('player_id, trend_label, hot_cold_score, point_streak, recent_ppg, season_ppg')
        .in('player_id', playerIds),
      supabase
        .from('skater_pace_projections')
        .select('player_id, projected_goals_82, projected_assists_82, projected_points_82, goals_per_game, points_per_game')
        .in('player_id', playerIds),
    ]);

    // Build pace map
    const paceMap = new Map<number, any>();
    if (paceRes.data) {
      for (const row of paceRes.data) {
        paceMap.set(row.player_id, row);
      }
    }

    // Build result map from hot/cold, merged with pace
    const result = new Map<number, LeaderTrend>();
    if (hcRes.data) {
      for (const row of hcRes.data) {
        const pace = paceMap.get(row.player_id);
        result.set(row.player_id, {
          playerId: row.player_id,
          trendLabel: row.trend_label ?? 'STEADY',
          hotColdScore: row.hot_cold_score ?? 0,
          pointStreak: row.point_streak ?? 0,
          recentPpg: row.recent_ppg ?? 0,
          seasonPpg: row.season_ppg ?? 0,
          projectedGoals82: pace?.projected_goals_82 ?? 0,
          projectedAssists82: pace?.projected_assists_82 ?? 0,
          projectedPoints82: pace?.projected_points_82 ?? 0,
          goalsPerGame: pace?.goals_per_game ?? 0,
          pointsPerGame: pace?.points_per_game ?? 0,
        });
      }
    }

    // Include players that have pace data but no hot/cold (< 10 GP)
    if (paceRes.data) {
      for (const row of paceRes.data) {
        if (!result.has(row.player_id)) {
          result.set(row.player_id, {
            playerId: row.player_id,
            trendLabel: 'STEADY',
            hotColdScore: 0,
            pointStreak: 0,
            recentPpg: 0,
            seasonPpg: 0,
            projectedGoals82: row.projected_goals_82 ?? 0,
            projectedAssists82: row.projected_assists_82 ?? 0,
            projectedPoints82: row.projected_points_82 ?? 0,
            goalsPerGame: row.goals_per_game ?? 0,
            pointsPerGame: row.points_per_game ?? 0,
          });
        }
      }
    }

    setCache(cacheKey, result);
    console.log(`[PLAYER TRENDS] Loaded leader trends for ${result.size}/${playerIds.length} players`);
    return result;
  } catch (err) {
    console.warn('[PLAYER TRENDS] Error fetching leader trends:', err);
    return new Map();
  }
}

// ---------------------------------------------------------------------------
// getTrendingPlayers
// ---------------------------------------------------------------------------

/**
 * Fetch trending skaters from skater_trend_summary view.
 * direction: 'up' returns HOT/WARM players, 'down' returns COLD/COOL players.
 */
export async function getTrendingPlayers(
  direction: 'up' | 'down',
  limit: number = 10,
): Promise<TrendingPlayer[]> {
  const cacheKey = `trending:${direction}:${limit}`;
  const cached = getCached<TrendingPlayer[]>(cacheKey);
  if (cached) return cached;

  try {
    let query = supabase
      .from('skater_trend_summary')
      .select('*')
      .not('hot_cold_score', 'is', null)
      .gt('games_played', 15);

    if (direction === 'up') {
      query = query
        .in('trend_label', ['HOT', 'WARM'])
        .order('hot_cold_score', { ascending: false });
    } else {
      query = query
        .in('trend_label', ['COLD', 'COOL'])
        .order('hot_cold_score', { ascending: true });
    }

    query = query.limit(limit);

    const { data: rows, error } = await query;

    if (error || !rows) {
      console.warn('[PLAYER TRENDS] Supabase error:', error?.message);
      return [];
    }

    // Batch-fetch supplementary data not in skater_trend_summary view:
    // - recent_gpg/season_gpg from skater_hot_cold
    // - avg_shots_5g/avg_assists_5g from skater_rolling_stats
    const playerIds = rows.map((r: any) => r.player_id);
    const [hcRes, rollingRes] = await Promise.all([
      supabase.from('skater_hot_cold').select('player_id, recent_gpg, season_gpg, recent_shots, season_shots').in('player_id', playerIds),
      supabase.from('skater_rolling_stats').select('player_id, avg_shots_5g, avg_assists_5g').in('player_id', playerIds),
    ]);

    const gpgMap = new Map<number, { recentGpg: number; seasonGpg: number; recentShots: number; seasonShots: number }>();
    if (hcRes.data) {
      for (const hc of hcRes.data) {
        gpgMap.set(hc.player_id, {
          recentGpg: hc.recent_gpg ?? 0,
          seasonGpg: hc.season_gpg ?? 0,
          recentShots: hc.recent_shots ?? 0,
          seasonShots: hc.season_shots ?? 0,
        });
      }
    }

    const rollingMap = new Map<number, { avgShots5g: number; avgAssists5g: number }>();
    if (rollingRes.data) {
      for (const r of rollingRes.data) {
        rollingMap.set(r.player_id, { avgShots5g: r.avg_shots_5g ?? 0, avgAssists5g: r.avg_assists_5g ?? 0 });
      }
    }

    const players = rows.map((row: any) => mapTrendingPlayer(row, gpgMap, rollingMap));
    setCache(cacheKey, players);
    console.log(`[PLAYER TRENDS] Loaded ${players.length} trending ${direction} players`);
    return players;
  } catch (err) {
    console.error('[PLAYER TRENDS] Error fetching trending players:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// getPlayerHitRate
// ---------------------------------------------------------------------------

/**
 * Calculate hit rate for a player: how many of the last N games exceeded
 * the threshold for the given stat.
 */
export async function getPlayerHitRate(
  playerId: number,
  statCategory: StatCategory,
  threshold?: number,
  lastNGames: number = 10,
): Promise<HitRateResult> {
  const effectiveThreshold = threshold ?? DEFAULT_THRESHOLDS[statCategory];
  const cacheKey = `hitrate:${playerId}:${statCategory}:${effectiveThreshold}:${lastNGames}`;
  const cached = getCached<HitRateResult>(cacheKey);
  if (cached) return cached;

  const column = STAT_COLUMN_MAP[statCategory];
  if (!column) {
    return { hit: 0, total: 0, rate: 0, games: [] };
  }

  try {
    const { data: rows, error } = await supabase
      .from('game_skater_stats')
      .select(`game_id, ${column}, games!inner(game_date)`)
      .eq('player_id', playerId)
      .order('game_id', { ascending: false })
      .limit(lastNGames);

    if (error || !rows || rows.length === 0) {
      return { hit: 0, total: 0, rate: 0, games: [] };
    }

    const games = rows.map((row: any) => {
      const value = row[column] || 0;
      return {
        gameId: row.game_id,
        value,
        exceeded: value > effectiveThreshold,
        gameDate: row.games?.game_date || '',
      };
    });

    const hit = games.filter(g => g.exceeded).length;
    const total = games.length;
    const result: HitRateResult = {
      hit,
      total,
      rate: total > 0 ? hit / total : 0,
      games,
    };

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('[PLAYER TRENDS] Error calculating hit rate:', err);
    return { hit: 0, total: 0, rate: 0, games: [] };
  }
}

// ---------------------------------------------------------------------------
// getPlayersPlayingTonight
// ---------------------------------------------------------------------------

/**
 * Get trending players who have a game today. Cross-references
 * tonight's games with the skater_trend_summary view.
 */
export async function getPlayersPlayingTonight(
  limit: number = 20,
): Promise<TrendingPlayer[]> {
  const cacheKey = `tonight:${limit}`;
  const cached = getCached<TrendingPlayer[]>(cacheKey);
  if (cached) return cached;

  try {
    // 1. Get today's games
    const today = new Date().toISOString().split('T')[0];
    const { data: todaysGames, error: gamesError } = await supabase
      .from('games')
      .select('id, home_team_abbrev, away_team_abbrev, start_time_utc, game_state')
      .eq('game_date', today)
      .in('game_state', ['FUT', 'PRE', 'LIVE', 'CRIT']);

    if (gamesError || !todaysGames || todaysGames.length === 0) {
      return [];
    }

    // 2. Collect all team abbreviations playing tonight
    const teamsPlaying = new Set<string>();
    const teamGameMap = new Map<string, { opponent: string; gameTime: string; isHome: boolean; gameId: number }>();

    for (const game of todaysGames) {
      teamsPlaying.add(game.home_team_abbrev);
      teamsPlaying.add(game.away_team_abbrev);

      teamGameMap.set(game.home_team_abbrev, {
        opponent: game.away_team_abbrev,
        gameTime: game.start_time_utc || '',
        isHome: true,
        gameId: game.id,
      });
      teamGameMap.set(game.away_team_abbrev, {
        opponent: game.home_team_abbrev,
        gameTime: game.start_time_utc || '',
        isHome: false,
        gameId: game.id,
      });
    }

    // 3. Fetch trending players on those teams
    const { data: rows, error } = await supabase
      .from('skater_trend_summary')
      .select('*')
      .in('team_abbrev', Array.from(teamsPlaying))
      .not('hot_cold_score', 'is', null)
      .gt('games_played', 10)
      .order('hot_cold_score', { ascending: false })
      .limit(limit);

    if (error || !rows) {
      console.warn('[PLAYER TRENDS] Error fetching tonight players:', error?.message);
      return [];
    }

    // Batch-fetch supplementary data
    const playerIds = rows.map((r: any) => r.player_id);
    const [hcRes, rollingRes] = await Promise.all([
      supabase.from('skater_hot_cold').select('player_id, recent_gpg, season_gpg, recent_shots, season_shots').in('player_id', playerIds),
      supabase.from('skater_rolling_stats').select('player_id, avg_shots_5g, avg_assists_5g').in('player_id', playerIds),
    ]);

    const gpgMap = new Map<number, { recentGpg: number; seasonGpg: number; recentShots: number; seasonShots: number }>();
    if (hcRes.data) {
      for (const hc of hcRes.data) {
        gpgMap.set(hc.player_id, {
          recentGpg: hc.recent_gpg ?? 0,
          seasonGpg: hc.season_gpg ?? 0,
          recentShots: hc.recent_shots ?? 0,
          seasonShots: hc.season_shots ?? 0,
        });
      }
    }

    const rollingMap = new Map<number, { avgShots5g: number; avgAssists5g: number }>();
    if (rollingRes.data) {
      for (const r of rollingRes.data) {
        rollingMap.set(r.player_id, { avgShots5g: r.avg_shots_5g ?? 0, avgAssists5g: r.avg_assists_5g ?? 0 });
      }
    }

    const players = rows.map((row: any) => {
      const player = mapTrendingPlayer(row, gpgMap, rollingMap);
      player.matchup = teamGameMap.get(player.teamAbbrev);
      return player;
    });

    setCache(cacheKey, players);
    console.log(`[PLAYER TRENDS] Loaded ${players.length} players for tonight's games`);
    return players;
  } catch (err) {
    console.error('[PLAYER TRENDS] Error fetching tonight players:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// getTrendingGoalies
// ---------------------------------------------------------------------------

/**
 * Fetch trending goalies from goalie_rolling_stats view.
 */
export async function getTrendingGoalies(
  direction: 'up' | 'down',
  limit: number = 5,
): Promise<TrendingGoalie[]> {
  const cacheKey = `goalie_trend:${direction}:${limit}`;
  const cached = getCached<TrendingGoalie[]>(cacheKey);
  if (cached) return cached;

  try {
    // Fetch goalie rolling stats
    const { data: rollingRows, error: rollingErr } = await supabase
      .from('goalie_rolling_stats')
      .select('*')
      .gt('starts', 5);

    if (rollingErr || !rollingRows || rollingRows.length === 0) {
      return [];
    }

    // Fetch goalie season stats for additional context
    const playerIds = rollingRows.map((r: any) => r.player_id);
    const [seasonRes, playerRes] = await Promise.all([
      supabase
        .from('goalie_season_stats')
        .select('*')
        .in('player_id', playerIds),
      supabase
        .from('players')
        .select('id, first_name, last_name, headshot_url')
        .in('id', playerIds),
    ]);

    const seasonMap = new Map<number, any>();
    if (seasonRes.data) {
      for (const s of seasonRes.data) {
        seasonMap.set(s.player_id, s);
      }
    }

    const playerMap = new Map<number, { firstName: string; lastName: string; headshotUrl?: string }>();
    if (playerRes.data) {
      for (const p of playerRes.data) {
        playerMap.set(p.id, {
          firstName: p.first_name,
          lastName: p.last_name,
          headshotUrl: p.headshot_url ?? undefined,
        });
      }
    }

    // Calculate trend for goalies: compare recent SV% to season SV%
    const goalies: TrendingGoalie[] = rollingRows.map((row: any) => {
      const season = seasonMap.get(row.player_id);
      const info = playerMap.get(row.player_id);
      const savePct5g = row.save_pct_5g ?? null;
      const seasonSavePct = row.season_save_pct ?? null;

      let trendLabel: TrendingGoalie['trendLabel'] = 'STEADY';
      if (savePct5g != null && seasonSavePct != null) {
        const diff = savePct5g - seasonSavePct;
        if (diff >= 0.015) trendLabel = 'HOT';
        else if (diff >= 0.005) trendLabel = 'WARM';
        else if (diff <= -0.015) trendLabel = 'COLD';
        else if (diff <= -0.005) trendLabel = 'COOL';
      }

      return {
        playerId: row.player_id,
        playerName: info ? `${info.firstName} ${info.lastName}` : `Player ${row.player_id}`,
        firstName: info?.firstName ?? '',
        lastName: info?.lastName ?? '',
        headshotUrl: info?.headshotUrl,
        teamAbbrev: row.team_abbrev || '',
        trendLabel,
        avgGa5g: row.avg_ga_5g ?? 0,
        savePct5g: savePct5g,
        wins5g: row.wins_5g ?? 0,
        avgGa10g: row.avg_ga_10g ?? 0,
        savePct10g: row.save_pct_10g ?? null,
        wins10g: row.wins_10g ?? 0,
        starts: row.starts ?? 0,
        seasonSavePct: seasonSavePct,
        seasonAvgGa: row.season_avg_ga ?? 0,
        seasonWins: row.season_wins ?? 0,
        seasonShutouts: row.season_shutouts ?? 0,
        gamesPlayed: season?.games_played ?? 0,
        wins: season?.wins ?? 0,
        losses: season?.losses ?? 0,
        otLosses: season?.ot_losses ?? 0,
        goalsAgainstAvg: season?.goals_against_avg ?? 0,
        savePctg: season?.save_pctg ?? 0,
      };
    });

    // Sort and filter by direction
    const filtered = goalies.filter(g => {
      if (direction === 'up') return g.trendLabel === 'HOT' || g.trendLabel === 'WARM';
      return g.trendLabel === 'COLD' || g.trendLabel === 'COOL';
    });

    // Sort: up = best first, down = worst first
    filtered.sort((a, b) => {
      const aScore = (a.savePct5g ?? 0) - (a.seasonSavePct ?? 0);
      const bScore = (b.savePct5g ?? 0) - (b.seasonSavePct ?? 0);
      return direction === 'up' ? bScore - aScore : aScore - bScore;
    });

    const result = filtered.slice(0, limit);
    setCache(cacheKey, result);
    console.log(`[PLAYER TRENDS] Loaded ${result.length} trending ${direction} goalies`);
    return result;
  } catch (err) {
    console.error('[PLAYER TRENDS] Error fetching trending goalies:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// getPlayerL10GameStats
// ---------------------------------------------------------------------------

/**
 * Get last 10 game-level values for a specific stat.
 * Used for L10 trend bar visualization.
 */
export async function getPlayerL10GameStats(
  playerId: number,
  statCategory: StatCategory,
): Promise<L10GameStat[]> {
  const cacheKey = `l10:${playerId}:${statCategory}`;
  const cached = getCached<L10GameStat[]>(cacheKey);
  if (cached) return cached;

  const column = STAT_COLUMN_MAP[statCategory];
  if (!column) return [];

  try {
    const { data: rows, error } = await supabase
      .from('game_skater_stats')
      .select(`game_id, ${column}, games!inner(game_date)`)
      .eq('player_id', playerId)
      .order('game_id', { ascending: false })
      .limit(10);

    if (error || !rows || rows.length === 0) {
      return [];
    }

    // Reverse to chronological order (oldest first) for bar chart
    const stats: L10GameStat[] = rows
      .map((row: any) => ({
        gameId: row.game_id,
        gameDate: row.games?.game_date || '',
        value: row[column] || 0,
      }))
      .reverse();

    setCache(cacheKey, stats);
    return stats;
  } catch (err) {
    console.warn('[PLAYER TRENDS] Error fetching L10 stats:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Batch hit rates
// ---------------------------------------------------------------------------

/**
 * Fetch hit rates for multiple players in parallel.
 * Used to populate cards efficiently.
 */
export async function batchGetHitRates(
  playerIds: number[],
  statCategory: StatCategory,
  threshold?: number,
): Promise<Map<number, HitRateResult>> {
  const results = new Map<number, HitRateResult>();
  const promises = playerIds.map(async (id) => {
    const result = await getPlayerHitRate(id, statCategory, threshold);
    results.set(id, result);
  });
  await Promise.all(promises);
  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapTrendingPlayer(
  row: any,
  gpgMap?: Map<number, { recentGpg: number; seasonGpg: number; recentShots: number; seasonShots: number }>,
  rollingMap?: Map<number, { avgShots5g: number; avgAssists5g: number }>,
): TrendingPlayer {
  const gpg = gpgMap?.get(row.player_id);
  const rolling = rollingMap?.get(row.player_id);
  return {
    playerId: row.player_id,
    playerName: row.player_name || '',
    firstName: row.player_name?.split(' ')[0] || '',
    lastName: row.player_name?.split(' ').slice(1).join(' ') || '',
    headshotUrl: row.headshot_url ?? undefined,
    teamAbbrev: row.team_abbrev || '',
    position: row.position || '',
    trendLabel: row.trend_label || 'STEADY',
    hotColdScore: row.hot_cold_score ?? 0,
    pointStreak: row.point_streak ?? 0,
    recentPpg: row.recent_ppg ?? 0,
    seasonPpg: row.season_ppg ?? 0,
    recentGpg: gpg?.recentGpg ?? 0,
    seasonGpg: gpg?.seasonGpg ?? 0,
    recentShootingPct: row.recent_shooting_pct ?? 0,
    seasonShootingPct: row.season_shooting_pct ?? 0,
    avgGoals5g: row.avg_goals_5g ?? 0,
    avgAssists5g: rolling?.avgAssists5g ?? 0,
    avgPoints5g: row.avg_points_5g ?? 0,
    avgShots5g: rolling?.avgShots5g ?? 0,
    avgGoals10g: row.avg_goals_10g ?? 0,
    avgPoints10g: row.avg_points_10g ?? 0,
    gamesPlayed: row.games_played ?? 0,
    seasonGoals: row.season_goals ?? 0,
    seasonAssists: row.season_assists ?? 0,
    seasonPoints: row.season_points ?? 0,
    recentShotsPerGame: gpg?.recentShots ?? 0,
    seasonShotsPerGame: gpg?.seasonShots ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Player Projections (Tonight's Edge — Phase 2)
// ---------------------------------------------------------------------------

export type ProjectionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type ProjectionDirection = 'OVER' | 'UNDER';

export interface StatProjection {
  stat: StatCategory;
  projected: number;
  seasonAvg: number;
  direction: ProjectionDirection;
  /** Difference between projected and season avg, as a percentage */
  diffPct: number;
}

export interface PlayerProjection {
  playerId: number;
  playerName: string;
  firstName: string;
  lastName: string;
  headshotUrl?: string;
  teamAbbrev: string;
  position: string;
  trendLabel: TrendingPlayer['trendLabel'];
  confidence: ProjectionConfidence;
  matchup: {
    opponent: string;
    gameTime: string;
    isHome: boolean;
    gameId: number;
  };
  projections: StatProjection[];
  pointStreak: number;
  hotColdScore: number;
}

/**
 * Get player projections for tonight's games.
 * Calculates simple projections: base = season per-game avg,
 * adjustment = recent form weight (L5 rolling avg vs season).
 * Confidence = based on L5 consistency (low variance = HIGH).
 */
export async function getPlayerProjections(
  limit: number = 15,
): Promise<PlayerProjection[]> {
  const cacheKey = `projections:${limit}`;
  const cached = getCached<PlayerProjection[]>(cacheKey);
  if (cached) return cached;

  try {
    // 1. Get tonight's trending players (already has matchup info)
    const tonightPlayers = await getPlayersPlayingTonight(limit * 2);
    if (tonightPlayers.length === 0) return [];

    // 2. For each player, calculate projections across all stat categories
    const projections: PlayerProjection[] = [];

    for (const player of tonightPlayers.slice(0, limit)) {
      if (!player.matchup) continue;

      const statProjections: StatProjection[] = [];

      // Calculate projections for goals, assists, points, shots
      const categories: StatCategory[] = ['goals', 'assists', 'points', 'shots'];
      for (const stat of categories) {
        const { recent, season } = getPlayerStatAverages(player, stat);
        if (season === 0) continue;

        // Projected = weighted average: 60% recent form, 40% season
        const projected = recent * 0.6 + season * 0.4;
        const direction: ProjectionDirection = projected >= season ? 'OVER' : 'UNDER';
        const diffPct = season > 0 ? ((projected - season) / season) * 100 : 0;

        statProjections.push({
          stat,
          projected: Math.round(projected * 100) / 100,
          seasonAvg: Math.round(season * 100) / 100,
          direction,
          diffPct: Math.round(diffPct),
        });
      }

      // Calculate confidence based on form consistency
      const confidence = calculateConfidence(player);

      projections.push({
        playerId: player.playerId,
        playerName: player.playerName,
        firstName: player.firstName,
        lastName: player.lastName,
        headshotUrl: player.headshotUrl,
        teamAbbrev: player.teamAbbrev,
        position: player.position,
        trendLabel: player.trendLabel,
        confidence,
        matchup: player.matchup,
        projections: statProjections,
        pointStreak: player.pointStreak,
        hotColdScore: player.hotColdScore,
      });
    }

    // Sort by confidence (HIGH first), then by hotColdScore
    const CONFIDENCE_ORDER: Record<ProjectionConfidence, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    projections.sort((a, b) => {
      const confDiff = CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence];
      if (confDiff !== 0) return confDiff;
      return b.hotColdScore - a.hotColdScore;
    });

    setCache(cacheKey, projections);
    console.log(`[PLAYER TRENDS] Generated ${projections.length} projections for tonight`);
    return projections;
  } catch (err) {
    console.error('[PLAYER TRENDS] Error generating projections:', err);
    return [];
  }
}

function getPlayerStatAverages(player: TrendingPlayer, stat: StatCategory): { recent: number; season: number } {
  const gp = player.gamesPlayed || 1;
  switch (stat) {
    case 'goals':
      return { recent: player.avgGoals5g, season: player.seasonGoals / gp };
    case 'assists':
      return { recent: player.avgAssists5g, season: player.seasonAssists / gp };
    case 'points':
      return { recent: player.avgPoints5g, season: player.seasonPoints / gp };
    case 'shots':
      return { recent: player.recentShotsPerGame || player.avgShots5g, season: player.seasonShotsPerGame || player.avgShots5g };
    default:
      return { recent: 0, season: 0 };
  }
}

function calculateConfidence(player: TrendingPlayer): ProjectionConfidence {
  // High confidence: consistent recent performance aligned with season
  // Use ratio of recent PPG to season PPG as a consistency proxy
  const recentPpg = player.recentPpg;
  const seasonPpg = player.seasonPpg;

  if (seasonPpg === 0) return 'LOW';

  const ratio = recentPpg / seasonPpg;
  const hasStreak = player.pointStreak >= 3;
  const isHot = player.trendLabel === 'HOT' || player.trendLabel === 'WARM';

  // HIGH: performing near or above season average with streak
  if (ratio >= 0.85 && ratio <= 1.5 && hasStreak && isHot) return 'HIGH';
  // MEDIUM: performing near season average
  if (ratio >= 0.7 && ratio <= 1.8) return 'MEDIUM';
  // LOW: volatile or cold
  return 'LOW';
}

/** Visible for testing */
export const _internals = {
  trendCache,
  CACHE_TTL,
  STAT_COLUMN_MAP,
  DEFAULT_THRESHOLDS,
  mapTrendingPlayer,
  getPlayerStatAverages,
  calculateConfidence,
};
