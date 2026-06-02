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
import { computeGaa, computeSavePct } from './goalieRates';

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
  // Pace projections (from skater_trend_summary)
  projectedGoals82?: number;
  projectedPoints82?: number;
  goalsPerGame?: number;
  pointsPerGame?: number;
  // Advanced stats (from skater_trend_summary)
  corsiPct5g?: number;
  seasonCorsiPct?: number;
  pdo5g?: number;
  seasonPdo?: number;
  // Extra rolling (from skater_rolling_stats)
  avgHits5g?: number;
  avgPlusMinus5g?: number;
  totalPoints5g?: number;
  totalPoints10g?: number;
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
    const labels = direction === 'up' ? ['HOT', 'WARM'] : ['COLD', 'COOL'];

    // skater_trend_summary was dropped (timed out). Drive trends off skater_hot_cold
    // (which carries trend_label/hot_cold_score/games_played/team_abbrev) and enrich
    // via buildTrendingRows. Over-fetch (limit * 3) so the volume filter below still
    // yields up to `limit` players.
    const { data: hcRows, error } = await supabase
      .from('skater_hot_cold')
      .select('player_id, team_abbrev, games_played, trend_label, hot_cold_score, point_streak, recent_ppg, season_ppg, recent_gpg, season_gpg, recent_shooting_pct, season_shooting_pct')
      .in('trend_label', labels)
      .not('hot_cold_score', 'is', null)
      .gt('games_played', 15)
      .order('hot_cold_score', { ascending: direction !== 'up' })
      .limit(limit);

    if (error || !hcRows) {
      console.warn('[PLAYER TRENDS] Supabase error:', error?.message);
      return [];
    }

    const hcMap = new Map<number, any>();
    for (const r of hcRows) hcMap.set(r.player_id, r);

    const built = await buildTrendingRows(hcRows.map((r: any) => r.player_id), hcMap);

    // Drop low-production players whose trend is statistical noise (mirrors the
    // volume reset the old view applied), then re-confirm the expected labels.
    const players = built
      .filter(p => !(p.seasonPoints < 20 && p.seasonPpg < 0.3))
      .filter(p => labels.includes(p.trendLabel))
      .slice(0, limit);

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

    // 3. Fetch trending players on those teams — compose from skater_hot_cold
    //    (skater_trend_summary was dropped).
    const { data: hcRows, error } = await supabase
      .from('skater_hot_cold')
      .select('player_id, team_abbrev, games_played, trend_label, hot_cold_score, point_streak, recent_ppg, season_ppg, recent_gpg, season_gpg, recent_shooting_pct, season_shooting_pct')
      .in('team_abbrev', Array.from(teamsPlaying))
      .not('hot_cold_score', 'is', null)
      .gt('games_played', 10)
      .order('hot_cold_score', { ascending: false })
      .limit(limit);

    if (error || !hcRows) {
      console.warn('[PLAYER TRENDS] Error fetching tonight players:', error?.message);
      return [];
    }

    const hcMap = new Map<number, any>();
    for (const r of hcRows) hcMap.set(r.player_id, r);

    const built = await buildTrendingRows(hcRows.map((r: any) => r.player_id), hcMap);
    const players = built.map(player => {
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
        // save_pctg / goals_against_avg are NULL in goalie_season_stats — derive
        // them from raw counting stats (shots_against == saves + goals_against;
        // GAA = goals_against per 60 minutes of ice time).
        goalsAgainstAvg: season?.goals_against_avg ?? computeGaa(season) ?? 0,
        savePctg: season?.save_pctg ?? computeSavePct(season) ?? 0,
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
// getLeagueLeaders — sorted by actual stat totals
// ---------------------------------------------------------------------------

/**
 * Fetch actual stat leaders. Uses skater_season_stats (fast indexed table)
 * for ranking, then enriches with trend/rolling/pace data from smaller tables.
 * Avoids skater_trend_summary which times out on ordered/filtered queries.
 */
export async function getLeagueLeaders(
  statCategory: StatCategory,
  limit: number = 10,
): Promise<TrendingPlayer[]> {
  const cacheKey = `leaders:${statCategory}:${limit}`;
  const cached = getCached<TrendingPlayer[]>(cacheKey);
  if (cached) return cached;

  try {
    // Step 1: Get leader rankings from skater_season_stats (fast indexed table)
    const SORT_COLUMN: Record<StatCategory, string> = {
      goals: 'goals',
      assists: 'assists',
      points: 'points',
      shots: 'shots',
    };

    const { data: leaderRows, error: leaderErr } = await supabase
      .from('skater_season_stats')
      .select('player_id, games_played, points, goals, assists, team_abbrev, position, shooting_pctg, shots')
      .gt('games_played', 15)
      .order(SORT_COLUMN[statCategory], { ascending: false })
      .limit(limit);

    if (leaderErr || !leaderRows?.length) {
      console.warn('[PLAYER TRENDS] getLeagueLeaders error:', leaderErr?.message || 'no rows');
      return [];
    }

    // Step 2: Enrich with trend, rolling, pace, and player name data (all fast tables)
    const playerIds = leaderRows.map((r: any) => r.player_id);
    const [playersRes, hcRes, rollingRes, paceRes] = await Promise.all([
      supabase.from('players')
        .select('id, first_name, last_name, headshot_url')
        .in('id', playerIds),
      supabase.from('skater_hot_cold')
        .select('player_id, trend_label, hot_cold_score, point_streak, recent_ppg, season_ppg, recent_gpg, season_gpg, recent_shooting_pct, season_shooting_pct')
        .in('player_id', playerIds),
      supabase.from('skater_rolling_stats')
        .select('player_id, avg_goals_5g, avg_points_5g, avg_assists_5g, avg_shots_5g, avg_goals_10g, avg_points_10g, avg_hits_5g, avg_pm_5g, total_points_5g, total_points_10g')
        .in('player_id', playerIds),
      supabase.from('skater_pace_projections')
        .select('player_id, projected_goals_82, projected_points_82, goals_per_game, points_per_game')
        .in('player_id', playerIds),
    ]);

    // Build lookup maps
    const nameMap = new Map<number, { firstName: string; lastName: string; headshotUrl?: string }>();
    if (playersRes.data) {
      for (const p of playersRes.data) {
        nameMap.set(p.id, { firstName: p.first_name, lastName: p.last_name, headshotUrl: p.headshot_url ?? undefined });
      }
    }

    const hcMap = new Map<number, any>();
    if (hcRes.data) {
      for (const hc of hcRes.data) hcMap.set(hc.player_id, hc);
    }

    const rollingMap = new Map<number, any>();
    if (rollingRes.data) {
      for (const r of rollingRes.data) rollingMap.set(r.player_id, r);
    }

    const paceMap = new Map<number, any>();
    if (paceRes.data) {
      for (const p of paceRes.data) paceMap.set(p.player_id, p);
    }

    // Step 3: Assemble TrendingPlayer objects
    const players: TrendingPlayer[] = leaderRows.map((row: any) => {
      const info = nameMap.get(row.player_id);
      const hc = hcMap.get(row.player_id);
      const rolling = rollingMap.get(row.player_id);
      const pace = paceMap.get(row.player_id);
      const gp = row.games_played || 1;
      const playerName = info ? `${info.firstName} ${info.lastName}` : `Player ${row.player_id}`;

      return {
        playerId: row.player_id,
        playerName,
        firstName: info?.firstName ?? '',
        lastName: info?.lastName ?? '',
        headshotUrl: info?.headshotUrl,
        teamAbbrev: row.team_abbrev || '',
        position: row.position || '',
        trendLabel: hc?.trend_label ?? 'STEADY',
        hotColdScore: hc?.hot_cold_score ?? 0,
        pointStreak: hc?.point_streak ?? 0,
        recentPpg: hc?.recent_ppg ?? 0,
        seasonPpg: hc?.season_ppg ?? (row.points / gp),
        recentGpg: hc?.recent_gpg ?? 0,
        seasonGpg: hc?.season_gpg ?? (row.goals / gp),
        recentShootingPct: hc?.recent_shooting_pct ?? 0,
        seasonShootingPct: hc?.season_shooting_pct ?? (row.shooting_pctg ?? 0),
        avgGoals5g: rolling?.avg_goals_5g ?? 0,
        avgAssists5g: rolling?.avg_assists_5g ?? 0,
        avgPoints5g: rolling?.avg_points_5g ?? 0,
        avgShots5g: rolling?.avg_shots_5g ?? 0,
        avgGoals10g: rolling?.avg_goals_10g ?? 0,
        avgPoints10g: rolling?.avg_points_10g ?? 0,
        gamesPlayed: row.games_played ?? 0,
        seasonGoals: row.goals ?? 0,
        seasonAssists: row.assists ?? 0,
        seasonPoints: row.points ?? 0,
        recentShotsPerGame: rolling?.avg_shots_5g ?? 0,
        seasonShotsPerGame: row.shots ? row.shots / gp : 0,
        projectedGoals82: pace?.projected_goals_82 ?? 0,
        projectedPoints82: pace?.projected_points_82 ?? 0,
        goalsPerGame: pace?.goals_per_game ?? 0,
        pointsPerGame: pace?.points_per_game ?? 0,
        corsiPct5g: 0,
        seasonCorsiPct: 0,
        pdo5g: 0,
        seasonPdo: 0,
        avgHits5g: rolling?.avg_hits_5g ?? 0,
        avgPlusMinus5g: rolling?.avg_pm_5g ?? 0,
        totalPoints5g: rolling?.total_points_5g ?? 0,
        totalPoints10g: rolling?.total_points_10g ?? 0,
      };
    });

    setCache(cacheKey, players);
    console.log(`[PLAYER TRENDS] Loaded ${players.length} league leaders for ${statCategory}`);
    return players;
  } catch (err) {
    console.error('[PLAYER TRENDS] Error fetching league leaders:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compose TrendingPlayer rows from the surviving fast views. Replaces the dropped
 * `skater_trend_summary` view (removed in migration 20260208020000 because it
 * timed out joining 4 heavy window-function views). `hcMap` supplies hot/cold
 * trend fields keyed by player_id; season totals/position/name/rolling/pace are
 * fetched here. Returns players in the order of `playerIds`.
 */
async function buildTrendingRows(
  playerIds: number[],
  hcMap: Map<number, any>,
): Promise<TrendingPlayer[]> {
  if (playerIds.length === 0) return [];

  const [seasonRes, playersRes, rollingRes, paceRes] = await Promise.all([
    supabase
      .from('skater_season_stats')
      .select('player_id, games_played, points, goals, assists, team_abbrev, position, shooting_pctg, shots')
      .in('player_id', playerIds),
    supabase
      .from('players')
      .select('id, first_name, last_name, headshot_url')
      .in('id', playerIds),
    supabase
      .from('skater_rolling_stats')
      .select('player_id, avg_goals_5g, avg_points_5g, avg_assists_5g, avg_shots_5g, avg_goals_10g, avg_points_10g, avg_hits_5g, avg_pm_5g, total_points_5g, total_points_10g')
      .in('player_id', playerIds),
    supabase
      .from('skater_pace_projections')
      .select('player_id, projected_goals_82, projected_points_82, goals_per_game, points_per_game')
      .in('player_id', playerIds),
  ]);

  const seasonMap = new Map<number, any>();
  for (const r of seasonRes.data ?? []) seasonMap.set(r.player_id, r);
  const nameMap = new Map<number, any>();
  for (const p of playersRes.data ?? []) nameMap.set(p.id, p);
  const rollingMap = new Map<number, any>();
  for (const r of rollingRes.data ?? []) rollingMap.set(r.player_id, r);
  const paceMap = new Map<number, any>();
  for (const p of paceRes.data ?? []) paceMap.set(p.player_id, p);

  const num = (v: any) => (v == null ? undefined : Number(v));

  const players: TrendingPlayer[] = [];
  for (const pid of playerIds) {
    const hc = hcMap.get(pid) ?? {};
    const s = seasonMap.get(pid);
    const info = nameMap.get(pid);
    const rolling = rollingMap.get(pid);
    const pace = paceMap.get(pid);
    const gp = (s?.games_played ?? hc.games_played) || 1;

    // Prefer joined data; fall back to fields that may already be on the
    // hot/cold row (the live skater_hot_cold view carries some of them, and
    // tests provide enriched rows). Numeric Supabase columns can arrive as
    // strings, so coerce.
    const seasonGoals = s?.goals ?? hc.season_goals ?? 0;
    const seasonAssists = s?.assists ?? hc.season_assists ?? 0;
    const seasonPoints = s?.points ?? hc.season_points ?? 0;
    const name = info
      ? `${info.first_name} ${info.last_name}`
      : hc.player_name || '';

    players.push({
      playerId: pid,
      playerName: name,
      firstName: info?.first_name ?? (hc.player_name?.split(' ')[0] ?? ''),
      lastName: info?.last_name ?? (hc.player_name?.split(' ').slice(1).join(' ') ?? ''),
      headshotUrl: info?.headshot_url ?? hc.headshot_url ?? undefined,
      teamAbbrev: s?.team_abbrev ?? hc.team_abbrev ?? '',
      position: s?.position ?? hc.position ?? '',
      trendLabel: hc.trend_label ?? 'STEADY',
      hotColdScore: hc.hot_cold_score ?? 0,
      pointStreak: hc.point_streak ?? 0,
      recentPpg: hc.recent_ppg ?? 0,
      seasonPpg: hc.season_ppg ?? (s ? s.points / gp : 0),
      recentGpg: hc.recent_gpg ?? 0,
      seasonGpg: hc.season_gpg ?? (s ? s.goals / gp : 0),
      recentShootingPct: hc.recent_shooting_pct ?? 0,
      seasonShootingPct: hc.season_shooting_pct ?? (s?.shooting_pctg ?? 0),
      avgGoals5g: num(rolling?.avg_goals_5g) ?? num(hc.avg_goals_5g) ?? 0,
      avgAssists5g: num(rolling?.avg_assists_5g) ?? num(hc.avg_assists_5g) ?? 0,
      avgPoints5g: num(rolling?.avg_points_5g) ?? num(hc.avg_points_5g) ?? 0,
      avgShots5g: num(rolling?.avg_shots_5g) ?? num(hc.avg_shots_5g) ?? 0,
      avgGoals10g: num(rolling?.avg_goals_10g) ?? num(hc.avg_goals_10g) ?? 0,
      avgPoints10g: num(rolling?.avg_points_10g) ?? num(hc.avg_points_10g) ?? 0,
      gamesPlayed: s?.games_played ?? hc.games_played ?? 0,
      seasonGoals,
      seasonAssists,
      seasonPoints,
      recentShotsPerGame: num(rolling?.avg_shots_5g) ?? num(hc.avg_shots_5g) ?? 0,
      seasonShotsPerGame: s?.shots ? s.shots / gp : 0,
      projectedGoals82: pace?.projected_goals_82 ?? 0,
      projectedPoints82: pace?.projected_points_82 ?? 0,
      goalsPerGame: pace?.goals_per_game ?? 0,
      pointsPerGame: pace?.points_per_game ?? 0,
      corsiPct5g: 0,
      seasonCorsiPct: 0,
      pdo5g: 0,
      seasonPdo: 0,
      avgHits5g: num(rolling?.avg_hits_5g) ?? 0,
      avgPlusMinus5g: num(rolling?.avg_pm_5g) ?? 0,
      totalPoints5g: num(rolling?.total_points_5g) ?? 0,
      totalPoints10g: num(rolling?.total_points_10g) ?? 0,
    });
  }
  return players;
}

function mapTrendingPlayer(
  row: any,
  gpgMap?: Map<number, { recentGpg: number; seasonGpg: number }>,
  rollingMap?: Map<number, { avgShots5g: number; avgAssists5g: number; avgHits5g?: number; avgPlusMinus5g?: number }>,
): TrendingPlayer {
  const gpg = gpgMap?.get(row.player_id);
  const rolling = rollingMap?.get(row.player_id);

  // Determine trend label, then apply volume filter for low-production players
  let trendLabel: TrendingPlayer['trendLabel'] = row.trend_label || 'STEADY';
  const seasonPoints = row.season_points ?? 0;
  const seasonPpg = row.season_ppg ?? 0;
  const isLowVolume = seasonPoints < 20 && seasonPpg < 0.3;
  if (isLowVolume && trendLabel !== 'STEADY') {
    trendLabel = 'STEADY';
  }

  return {
    playerId: row.player_id,
    playerName: row.player_name || '',
    firstName: row.player_name?.split(' ')[0] || '',
    lastName: row.player_name?.split(' ').slice(1).join(' ') || '',
    headshotUrl: row.headshot_url ?? undefined,
    teamAbbrev: row.team_abbrev || '',
    position: row.position || '',
    trendLabel,
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
    recentShotsPerGame: rolling?.avgShots5g ?? 0,
    seasonShotsPerGame: 0,
    // Pace projections
    projectedGoals82: row.projected_goals_82 ?? 0,
    projectedPoints82: row.projected_points_82 ?? 0,
    goalsPerGame: row.goals_per_game ?? 0,
    pointsPerGame: row.points_per_game ?? 0,
    // Advanced stats
    corsiPct5g: row.avg_corsi_pct_5g ?? 0,
    seasonCorsiPct: row.season_corsi_pct ?? 0,
    pdo5g: row.avg_pdo_5g ?? 0,
    seasonPdo: row.season_pdo ?? 0,
    // Extra rolling
    avgHits5g: rolling?.avgHits5g ?? 0,
    avgPlusMinus5g: rolling?.avgPlusMinus5g ?? 0,
    totalPoints5g: row.total_points_5g ?? 0,
    totalPoints10g: row.total_points_10g ?? 0,
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
