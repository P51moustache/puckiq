/**
 * Fantasy Projections Service
 *
 * Fetches player fantasy projections from the ml_player_projections Supabase table.
 * Powers roster projections, waiver wire recommendations, and per-game breakdowns.
 *
 * 5-minute in-memory cache following existing service patterns (see playerTrends.ts).
 */

import { supabase } from '../lib/supabase';
import type { PlayerProjection, ScoringFormat } from '../types/fantasy';

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const projectionCache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = projectionCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  return null;
}

function setCache(key: string, data: any): void {
  projectionCache.set(key, { data, timestamp: Date.now() });
}

/** Clear all caches (useful for testing). */
export function clearProjectionsCache(): void {
  projectionCache.clear();
}

// ---------------------------------------------------------------------------
// Row → PlayerProjection mapping
// ---------------------------------------------------------------------------

function mapRowToProjection(row: any): PlayerProjection {
  return {
    playerId: row.player_id,
    playerName: row.player_name,
    teamAbbrev: row.team_abbrev,
    position: row.position ?? '',
    fantasyPoints: row.fantasy_points ?? 0,
    floor: row.floor ?? 0,
    ceiling: row.ceiling ?? 0,
    predGoals: row.pred_goals ?? 0,
    predAssists: row.pred_assists ?? 0,
    predSog: row.pred_sog ?? 0,
    predHits: row.pred_hits ?? 0,
    predBlocks: row.pred_blocks ?? 0,
    recommendation: row.recommendation ?? 'FLEX',
    confidence: row.confidence ?? 'medium',
    reason: row.reason ?? '',
    gameId: row.game_id ?? 0,
    opponentAbbrev: row.opponent_abbrev ?? '',
    isHome: row.is_home ?? false,
  };
}

// ---------------------------------------------------------------------------
// Select columns used by all queries
// ---------------------------------------------------------------------------

// Only columns that actually exist on ml_player_projections. The table does NOT
// have recommendation/confidence/reason/opponent_abbrev/is_home — selecting them
// caused PostgREST to 400 ("column ... does not exist"), which silently emptied
// every projection query. mapRowToProjection defaults those fields. (Note: the
// table is currently unpopulated — the ML pipeline must write rows before any
// projections appear; this fix just stops the query from erroring.)
const SELECT_COLS = [
  'game_id',
  'player_id',
  'player_name',
  'team_abbrev',
  'position',
  'format',
  'fantasy_points',
  'floor',
  'ceiling',
  'pred_goals',
  'pred_assists',
  'pred_points',
  'pred_sog',
  'pred_hits',
  'pred_blocks',
  'game_date',
].join(',');

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch projections for specific players (user's roster) for a given game date.
 */
export async function getProjectionsForRoster(
  playerIds: number[],
  format: ScoringFormat,
  gameDate: string,
): Promise<PlayerProjection[]> {
  if (playerIds.length === 0) return [];

  const cacheKey = `roster:${format}:${gameDate}:${playerIds.sort().join(',')}`;
  const cached = getCached<PlayerProjection[]>(cacheKey);
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from('ml_player_projections')
      .select(SELECT_COLS)
      .eq('format', format)
      .eq('game_date', gameDate)
      .in('player_id', playerIds);

    if (error) {
      console.warn('[Fantasy Projections] Roster query failed:', error.message);
      return [];
    }

    const projections = (data ?? []).map(mapRowToProjection);
    setCache(cacheKey, projections);
    return projections;
  } catch (err) {
    console.warn('[Fantasy Projections] Roster fetch error:', err);
    return [];
  }
}

/**
 * Fetch top projected players NOT on the user's roster (waiver wire).
 */
export async function getWaiverWireRecommendations(
  excludePlayerIds: number[],
  format: ScoringFormat,
  gameDate: string,
  limit: number = 20,
): Promise<PlayerProjection[]> {
  const cacheKey = `waiver:${format}:${gameDate}:${excludePlayerIds.sort().join(',')}:${limit}`;
  const cached = getCached<PlayerProjection[]>(cacheKey);
  if (cached) return cached;

  try {
    let query = supabase
      .from('ml_player_projections')
      .select(SELECT_COLS)
      .eq('format', format)
      .eq('game_date', gameDate);

    if (excludePlayerIds.length > 0) {
      query = query.not('player_id', 'in', `(${excludePlayerIds.join(',')})`);
    }

    const { data, error } = await query
      .order('fantasy_points', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[Fantasy Projections] Waiver query failed:', error.message);
      return [];
    }

    const projections = (data ?? []).map(mapRowToProjection);
    setCache(cacheKey, projections);
    return projections;
  } catch (err) {
    console.warn('[Fantasy Projections] Waiver fetch error:', err);
    return [];
  }
}

/**
 * Fetch all projections for a specific game.
 */
export async function getGameProjections(
  gameId: number,
  format: ScoringFormat,
): Promise<PlayerProjection[]> {
  const cacheKey = `game:${format}:${gameId}`;
  const cached = getCached<PlayerProjection[]>(cacheKey);
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from('ml_player_projections')
      .select(SELECT_COLS)
      .eq('format', format)
      .eq('game_id', gameId);

    if (error) {
      console.warn('[Fantasy Projections] Game query failed:', error.message);
      return [];
    }

    const projections = (data ?? []).map(mapRowToProjection);
    setCache(cacheKey, projections);
    return projections;
  } catch (err) {
    console.warn('[Fantasy Projections] Game fetch error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

export { CACHE_TTL };
