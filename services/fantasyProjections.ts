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
import { getCurrentSeason } from '../utils/season';

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_PROJECTION_AGE = 24 * 60 * 60 * 1000;
const projectionCache = new Map<string, CacheEntry<PlayerProjection[]>>();

const PLAYER_SELECT = 'id,first_name,last_name,full_name,position';
const GAME_SELECT = 'id,season,game_type,game_date,start_time_utc,game_state,home_team_abbrev,away_team_abbrev';
const NUMERIC_FIELDS = [
  'fantasy_points',
  'floor',
  'ceiling',
  'pred_goals',
  'pred_assists',
  'pred_sog',
  'pred_hits',
  'pred_blocks',
] as const;

function getCached<T>(key: string): T | null {
  const entry = projectionCache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data.map(projection => ({ ...projection })) as T;
  }
  if (entry) projectionCache.delete(key);
  return null;
}

function setCache(key: string, data: PlayerProjection[], expiresAt: number): void {
  projectionCache.set(key, {
    data: data.map(projection => ({ ...projection })),
    expiresAt: Math.min(Date.now() + CACHE_TTL, expiresAt),
  });
}

/** Clear all caches (useful for testing). */
export function clearProjectionsCache(): void {
  projectionCache.clear();
}

// ---------------------------------------------------------------------------
// Row → PlayerProjection mapping
// ---------------------------------------------------------------------------

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function validPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function validPredictionTimestamp(value: unknown, now = Date.now()): boolean {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    && timestamp <= now
    && now - timestamp <= MAX_PROJECTION_AGE;
}

function seasonForGameDate(gameDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(gameDate);
  if (!match) return null;
  const date = new Date(`${gameDate}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== gameDate) return null;
  return getCurrentSeason(date);
}

function easternDateForTimestamp(timestamp: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function mapRowToProjection(row: any, player: any, game: any, requestedGameDate?: string): PlayerProjection | null {
  if (!validPositiveInteger(row.player_id) || !validPositiveInteger(row.game_id)) return null;
  const gameDate = requestedGameDate ?? nonEmptyString(row.game_date);
  if (!gameDate || row.game_date !== gameDate || row.data_quality !== 'fresh') return null;
  if (!nonEmptyString(row.model_version)) return null;
  if (!validPredictionTimestamp(row.predicted_at)) return null;

  const values = NUMERIC_FIELDS.map(field => finiteNumber(row[field]));
  if (values.some(value => value === null)) return null;
  const predPoints = finiteNumber(row.pred_points);
  if (predPoints === null) return null;
  const [fantasyPoints, floor, ceiling, predGoals, predAssists, predSog, predHits, predBlocks] = values as number[];
  if (
    floor > ceiling
    || fantasyPoints < floor
    || fantasyPoints > ceiling
    || Math.abs(predPoints - (predGoals + predAssists)) > 0.01
    || [fantasyPoints, floor, ceiling, predGoals, predAssists, predSog, predHits, predBlocks]
      .some(value => value < 0)
  ) return null;

  const teamAbbrev = nonEmptyString(row.team_abbrev);
  const homeTeam = nonEmptyString(game?.home_team_abbrev);
  const awayTeam = nonEmptyString(game?.away_team_abbrev);
  if (!teamAbbrev || !homeTeam || !awayTeam || homeTeam === awayTeam) return null;
  if (teamAbbrev !== homeTeam && teamAbbrev !== awayTeam) return null;
  const gameStart = typeof game?.start_time_utc === 'string' ? Date.parse(game.start_time_utc) : NaN;
  const predictedAt = Date.parse(row.predicted_at);
  const expectedSeason = seasonForGameDate(gameDate);
  if (
    game?.id !== row.game_id
    || !Number.isInteger(game?.season)
    || expectedSeason === null
    || game.season !== expectedSeason
    || ![2, 3].includes(game?.game_type)
    || game?.game_date !== gameDate
    || game?.game_state !== 'FUT'
    || !Number.isFinite(gameStart)
    || easternDateForTimestamp(gameStart) !== gameDate
    || gameStart <= Date.now()
    || predictedAt > gameStart
  ) return null;
  if (!player || player.id !== row.player_id) return null;

  const firstLastName = [nonEmptyString(player?.first_name), nonEmptyString(player?.last_name)]
    .filter(Boolean)
    .join(' ');
  const playerName = nonEmptyString(row.player_name)
    ?? nonEmptyString(player?.full_name)
    ?? nonEmptyString(firstLastName);
  const position = nonEmptyString(row.position) ?? nonEmptyString(player?.position);
  if (!playerName || !position) return null;

  const isHome = teamAbbrev === homeTeam;
  return {
    playerId: row.player_id,
    playerName,
    teamAbbrev,
    position,
    fantasyPoints,
    floor,
    ceiling,
    predGoals,
    predAssists,
    predSog,
    predHits,
    predBlocks,
    recommendation: null,
    confidence: null,
    reason: null,
    gameId: row.game_id,
    opponentAbbrev: isHome ? awayTeam : homeTeam,
    isHome,
  };
}

async function hydrateProjections(
  rows: any[],
  gameDate?: string,
  excludedPlayerIds: Set<number> = new Set(),
  expectedGameId?: number,
  allowedPlayerIds?: Set<number>,
): Promise<{ projections: PlayerProjection[]; expiresAt: number }> {
  const candidateRows = rows.filter(row =>
    validPositiveInteger(row?.player_id)
    && validPositiveInteger(row?.game_id)
    && !excludedPlayerIds.has(row.player_id)
    && (!allowedPlayerIds || allowedPlayerIds.has(row.player_id))
    && (expectedGameId === undefined || row.game_id === expectedGameId),
  );
  if (candidateRows.length === 0) return { projections: [], expiresAt: Date.now() };

  const playerIds = [...new Set(candidateRows.map(row => row.player_id))];
  const gameIds = [...new Set(candidateRows.map(row => row.game_id))];
  let gameQuery = supabase.from('games').select(GAME_SELECT).in('id', gameIds).eq('game_state', 'FUT');
  if (gameDate) gameQuery = gameQuery.eq('game_date', gameDate);
  const [playersResponse, gamesResponse] = await Promise.all([
    supabase.from('players').select(PLAYER_SELECT).in('id', playerIds),
    gameQuery,
  ]);
  if (playersResponse.error) throw new Error(playersResponse.error.message);
  if (gamesResponse.error) throw new Error(gamesResponse.error.message);

  const players = new Map((playersResponse.data ?? []).map((player: any) => [player.id, player]));
  const games = new Map((gamesResponse.data ?? []).map((game: any) => [game.id, game]));
  const seen = new Set<string>();
  const projections: PlayerProjection[] = [];
  let expiresAt = Number.POSITIVE_INFINITY;
  for (const row of candidateRows) {
    const projection = mapRowToProjection(row, players.get(row.player_id), games.get(row.game_id), gameDate);
    if (!projection) continue;
    const key = `${projection.gameId}:${projection.playerId}:${row.format}`;
    if (seen.has(key)) continue;
    seen.add(key);
    projections.push(projection);
    const gameStart = Date.parse(games.get(row.game_id).start_time_utc);
    const predictionExpiry = Date.parse(row.predicted_at) + MAX_PROJECTION_AGE;
    expiresAt = Math.min(expiresAt, gameStart, predictionExpiry);
  }
  return { projections, expiresAt };
}

// ---------------------------------------------------------------------------
// Select columns used by all queries
// ---------------------------------------------------------------------------

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
  'model_version',
  'data_quality',
  'predicted_at',
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
  const requestedIds = [...new Set(playerIds.filter(validPositiveInteger))];
  if (requestedIds.length === 0) return [];

  const cacheKey = `roster:${format}:${gameDate}:${[...requestedIds].sort((a, b) => a - b).join(',')}`;
  const cached = getCached<PlayerProjection[]>(cacheKey);
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from('ml_player_projections')
      .select(SELECT_COLS)
      .eq('format', format)
      .eq('game_date', gameDate)
      .eq('data_quality', 'fresh')
      .in('player_id', requestedIds);

    if (error) {
      console.warn('[Fantasy Projections] Roster query failed:', error.message);
      return [];
    }

    const hydrated = await hydrateProjections(data ?? [], gameDate, new Set(), undefined, new Set(requestedIds));
    if (hydrated.projections.length > 0) setCache(cacheKey, hydrated.projections, hydrated.expiresAt);
    return hydrated.projections;
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
  if (!Number.isInteger(limit) || limit <= 0) return [];
  const excludedIds = [...new Set(excludePlayerIds.filter(validPositiveInteger))];
  const cacheKey = `waiver:${format}:${gameDate}:${[...excludedIds].sort((a, b) => a - b).join(',')}:${limit}`;
  const cached = getCached<PlayerProjection[]>(cacheKey);
  if (cached) return cached;

  try {
    let query = supabase
      .from('ml_player_projections')
      .select(SELECT_COLS)
      .eq('format', format)
      .eq('game_date', gameDate)
      .eq('data_quality', 'fresh');

    if (excludedIds.length > 0) {
      query = query.not('player_id', 'in', `(${excludedIds.join(',')})`);
    }

    const { data, error } = await query
      .order('fantasy_points', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[Fantasy Projections] Waiver query failed:', error.message);
      return [];
    }

    const hydrated = await hydrateProjections(data ?? [], gameDate, new Set(excludedIds));
    if (hydrated.projections.length > 0) setCache(cacheKey, hydrated.projections, hydrated.expiresAt);
    return hydrated.projections;
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
      .eq('game_id', gameId)
      .eq('data_quality', 'fresh');

    if (error) {
      console.warn('[Fantasy Projections] Game query failed:', error.message);
      return [];
    }

    const hydrated = await hydrateProjections(data ?? [], undefined, new Set(), gameId);
    if (hydrated.projections.length > 0) setCache(cacheKey, hydrated.projections, hydrated.expiresAt);
    return hydrated.projections;
  } catch (err) {
    console.warn('[Fantasy Projections] Game fetch error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

export { CACHE_TTL };
