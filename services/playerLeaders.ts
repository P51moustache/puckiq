/**
 * Player leaders service — fetches league-wide leaderboards from Supabase.
 * Queries skater_season_stats and goalie_season_stats, joined with players
 * table for names and headshots. 5-minute in-memory cache.
 */

import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkaterCategory =
  | 'points'
  | 'goals'
  | 'assists'
  | 'plusMinus'
  | 'shots'
  | 'powerPlayGoals'
  | 'gameWinningGoals'
  | 'shootingPctg'
  | 'avgToi'
  | 'faceoffWinPctg';

export type GoalieCategory =
  | 'wins'
  | 'savePctg'
  | 'goalsAgainstAvg'
  | 'shutouts'
  | 'gamesPlayed';

export type SkaterPosition = 'C' | 'L' | 'R' | 'D';

export interface SkaterLeader {
  playerId: number;
  firstName: string;
  lastName: string;
  headshotUrl?: string;
  teamAbbrev: string;
  position: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  shots: number;
  shootingPctg: number;
  powerPlayGoals: number;
  gameWinningGoals: number;
  avgToi: number;
  faceoffWinPctg: number;
}

export interface GoalieLeader {
  playerId: number;
  firstName: string;
  lastName: string;
  headshotUrl?: string;
  teamAbbrev: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  goalsAgainstAvg: number;
  savePctg: number;
  shutouts: number;
}

// ---------------------------------------------------------------------------
// Cache (5-min TTL, follows edgeStats.ts pattern)
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const skaterCache = new Map<string, CacheEntry<SkaterLeader[]>>();
const goalieCache = new Map<string, CacheEntry<GoalieLeader[]>>();

function getCacheKey(
  category: string,
  position?: string | null,
  teamAbbrev?: string | null,
): string {
  return `${category}:${position || 'all'}:${teamAbbrev || 'all'}`;
}

function isCacheValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.timestamp < CACHE_TTL;
}

/** Clear all caches (useful for testing). */
export function clearLeadersCache(): void {
  skaterCache.clear();
  goalieCache.clear();
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

/** Maps category to Supabase column + sort direction */
const SKATER_COLUMN_MAP: Record<SkaterCategory, { column: string; ascending: boolean }> = {
  points:           { column: 'points',             ascending: false },
  goals:            { column: 'goals',              ascending: false },
  assists:          { column: 'assists',            ascending: false },
  plusMinus:         { column: 'plus_minus',          ascending: false },
  shots:            { column: 'shots',              ascending: false },
  powerPlayGoals:   { column: 'power_play_goals',    ascending: false },
  gameWinningGoals: { column: 'game_winning_goals',   ascending: false },
  shootingPctg:     { column: 'shooting_pctg',       ascending: false },
  avgToi:           { column: 'avg_toi_per_game',     ascending: false },
  faceoffWinPctg:   { column: 'faceoff_win_pctg',    ascending: false },
};

const GOALIE_COLUMN_MAP: Record<GoalieCategory, { column: string; ascending: boolean }> = {
  wins:             { column: 'wins',                ascending: false },
  savePctg:         { column: 'save_pctg',            ascending: false },
  goalsAgainstAvg:  { column: 'goals_against_avg',    ascending: true  }, // lower is better
  shutouts:         { column: 'shutouts',             ascending: false },
  gamesPlayed:      { column: 'games_played',         ascending: false },
};

/** Minimum games played for rate-based stat categories */
const SKATER_MIN_GP: Partial<Record<SkaterCategory, number>> = {
  shootingPctg:   20,
  faceoffWinPctg: 20,
};

const GOALIE_MIN_GP: Partial<Record<GoalieCategory, number>> = {
  savePctg:        15,
  goalsAgainstAvg: 15,
};

// ---------------------------------------------------------------------------
// getLeagueLeaders
// ---------------------------------------------------------------------------

export async function getLeagueLeaders(
  category: SkaterCategory,
  position?: SkaterPosition | null,
  teamAbbrev?: string | null,
  limit: number = 20,
): Promise<SkaterLeader[]> {
  const key = getCacheKey(category, position, teamAbbrev);
  const cached = skaterCache.get(key);
  if (isCacheValid(cached)) return cached.data;

  const mapping = SKATER_COLUMN_MAP[category];
  if (!mapping) {
    console.warn(`[PLAYER LEADERS] Unknown skater category: ${category}`);
    return [];
  }

  try {
    let query = supabase
      .from('skater_season_stats')
      .select('*')
      .gt('games_played', 0)
      .order(mapping.column, { ascending: mapping.ascending })
      .limit(limit);

    // Apply minimum GP filter for rate stats
    const minGP = SKATER_MIN_GP[category];
    if (minGP) {
      query = query.gte('games_played', minGP);
    }

    if (position) {
      query = query.eq('position', position);
    }

    if (teamAbbrev) {
      query = query.eq('team_abbrev', teamAbbrev);
    }

    const { data: rows, error } = await query;

    if (error || !rows) {
      console.warn('[PLAYER LEADERS] Supabase error:', error?.message);
      return [];
    }

    // Batch-fetch player info
    const playerIds = rows.map((r: any) => r.player_id);
    const playerInfo = await fetchPlayerInfo(playerIds);

    const leaders: SkaterLeader[] = rows.map((row: any) => {
      const info = playerInfo.get(row.player_id);
      return {
        playerId: row.player_id,
        firstName: info?.firstName ?? 'Unknown',
        lastName: info?.lastName ?? `#${row.player_id}`,
        headshotUrl: info?.headshotUrl,
        teamAbbrev: row.team_abbrev || '',
        position: row.position || 'C',
        gamesPlayed: row.games_played || 0,
        goals: row.goals || 0,
        assists: row.assists || 0,
        points: row.points || 0,
        plusMinus: row.plus_minus || 0,
        shots: row.shots || 0,
        shootingPctg: row.shooting_pctg || 0,
        powerPlayGoals: row.power_play_goals || 0,
        gameWinningGoals: row.game_winning_goals || 0,
        avgToi: row.avg_toi_per_game || 0,
        faceoffWinPctg: row.faceoff_win_pctg || 0,
      };
    });

    skaterCache.set(key, { data: leaders, timestamp: Date.now() });
    console.log(`[PLAYER LEADERS] Loaded ${leaders.length} skater leaders for ${category}`);
    return leaders;
  } catch (err) {
    console.error('[PLAYER LEADERS] Error fetching skater leaders:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// getGoalieLeaders
// ---------------------------------------------------------------------------

export async function getGoalieLeaders(
  category: GoalieCategory,
  teamAbbrev?: string | null,
  limit: number = 10,
): Promise<GoalieLeader[]> {
  const key = getCacheKey(`goalie:${category}`, null, teamAbbrev);
  const cached = goalieCache.get(key);
  if (isCacheValid(cached)) return cached.data;

  const mapping = GOALIE_COLUMN_MAP[category];
  if (!mapping) {
    console.warn(`[PLAYER LEADERS] Unknown goalie category: ${category}`);
    return [];
  }

  try {
    let query = supabase
      .from('goalie_season_stats')
      .select('*')
      .gt('games_played', 0)
      .order(mapping.column, { ascending: mapping.ascending })
      .limit(limit);

    // Apply minimum GP filter for rate stats
    const minGP = GOALIE_MIN_GP[category];
    if (minGP) {
      query = query.gte('games_played', minGP);
    }

    if (teamAbbrev) {
      query = query.eq('team_abbrev', teamAbbrev);
    }

    const { data: rows, error } = await query;

    if (error || !rows) {
      console.warn('[PLAYER LEADERS] Supabase goalie error:', error?.message);
      return [];
    }

    const playerIds = rows.map((r: any) => r.player_id);
    const playerInfo = await fetchPlayerInfo(playerIds);

    const leaders: GoalieLeader[] = rows.map((row: any) => {
      const info = playerInfo.get(row.player_id);
      return {
        playerId: row.player_id,
        firstName: info?.firstName ?? 'Unknown',
        lastName: info?.lastName ?? `#${row.player_id}`,
        headshotUrl: info?.headshotUrl,
        teamAbbrev: row.team_abbrev || '',
        gamesPlayed: row.games_played || 0,
        wins: row.wins || 0,
        losses: row.losses || 0,
        otLosses: row.ot_losses || 0,
        goalsAgainstAvg: row.goals_against_avg || 0,
        savePctg: row.save_pctg || 0,
        shutouts: row.shutouts || 0,
      };
    });

    goalieCache.set(key, { data: leaders, timestamp: Date.now() });
    console.log(`[PLAYER LEADERS] Loaded ${leaders.length} goalie leaders for ${category}`);
    return leaders;
  } catch (err) {
    console.error('[PLAYER LEADERS] Error fetching goalie leaders:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PlayerInfoEntry {
  firstName: string;
  lastName: string;
  headshotUrl?: string;
}

async function fetchPlayerInfo(
  playerIds: number[],
): Promise<Map<number, PlayerInfoEntry>> {
  const map = new Map<number, PlayerInfoEntry>();
  if (playerIds.length === 0) return map;

  try {
    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name, headshot_url')
      .in('id', playerIds);

    if (players) {
      for (const p of players) {
        map.set(p.id, {
          firstName: p.first_name,
          lastName: p.last_name,
          headshotUrl: p.headshot_url ?? undefined,
        });
      }
    }
  } catch (err) {
    console.warn('[PLAYER LEADERS] Error fetching player info:', err);
  }

  return map;
}

// ---------------------------------------------------------------------------
// searchPlayers
// ---------------------------------------------------------------------------

export interface PlayerSearchResult {
  playerId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string;
  teamAbbrev: string;
  headshotUrl?: string;
  sweaterNumber?: number;
}

/**
 * Search active players by name (ILIKE). No caching — search is dynamic.
 */
export async function searchPlayers(
  query: string,
  limit: number = 20,
): Promise<PlayerSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const { data, error } = await supabase
      .from('players')
      .select('id, first_name, last_name, full_name, position, current_team_abbrev, headshot_url, sweater_number')
      .ilike('full_name', `%${trimmed}%`)
      .eq('is_active', true)
      .limit(limit);

    if (error || !data) {
      console.warn('[PLAYER SEARCH] Supabase error:', error?.message);
      return [];
    }

    return data.map((row: any): PlayerSearchResult => ({
      playerId: row.id,
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      fullName: row.full_name || `${row.first_name} ${row.last_name}`.trim(),
      position: row.position || '',
      teamAbbrev: row.current_team_abbrev || '',
      headshotUrl: row.headshot_url ?? undefined,
      sweaterNumber: row.sweater_number ?? undefined,
    }));
  } catch (err) {
    console.error('[PLAYER SEARCH] Error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// getTeamRoster
// ---------------------------------------------------------------------------

export interface RosterPlayer {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  teamAbbrev: string;
  headshotUrl?: string;
  sweaterNumber?: number;
  gamesPlayed?: number;
  goals?: number;
  assists?: number;
  points?: number;
}

/**
 * Get all active players on a team, grouped by position.
 */
export async function getTeamRoster(
  teamAbbrev: string,
): Promise<{ forwards: RosterPlayer[]; defense: RosterPlayer[]; goalies: RosterPlayer[] }> {
  const empty = { forwards: [], defense: [], goalies: [] };
  if (!teamAbbrev) return empty;

  try {
    // Parallel fetch: players and their season stats by team_abbrev
    const [playersRes, statsRes] = await Promise.all([
      supabase
        .from('players')
        .select('id, first_name, last_name, position, current_team_abbrev, headshot_url, sweater_number')
        .eq('current_team_abbrev', teamAbbrev)
        .eq('is_active', true)
        .order('last_name', { ascending: true }),
      supabase
        .from('skater_season_stats')
        .select('player_id, games_played, goals, assists, points')
        .eq('team_abbrev', teamAbbrev),
    ]);

    if (playersRes.error || !playersRes.data) {
      console.warn('[TEAM ROSTER] Supabase error:', playersRes.error?.message);
      return empty;
    }

    const players = playersRes.data;
    const statsMap = new Map<number, { gamesPlayed: number; goals: number; assists: number; points: number }>();

    if (statsRes.data) {
      for (const s of statsRes.data) {
        statsMap.set(s.player_id, {
          gamesPlayed: s.games_played || 0,
          goals: s.goals || 0,
          assists: s.assists || 0,
          points: s.points || 0,
        });
      }
    }

    const mapPlayer = (p: any): RosterPlayer => {
      const stat = statsMap.get(p.id);
      return {
        playerId: p.id,
        firstName: p.first_name || '',
        lastName: p.last_name || '',
        position: p.position || '',
        teamAbbrev: p.current_team_abbrev || teamAbbrev,
        headshotUrl: p.headshot_url ?? undefined,
        sweaterNumber: p.sweater_number ?? undefined,
        gamesPlayed: stat?.gamesPlayed,
        goals: stat?.goals,
        assists: stat?.assists,
        points: stat?.points,
      };
    };

    const forwards = players.filter(p => ['C', 'L', 'R'].includes(p.position)).map(mapPlayer);
    const defense = players.filter(p => p.position === 'D').map(mapPlayer);
    const goalies = players.filter(p => p.position === 'G').map(mapPlayer);

    return { forwards, defense, goalies };
  } catch (err) {
    console.error('[TEAM ROSTER] Error:', err);
    return empty;
  }
}

/** Visible for testing */
export const _internals = {
  skaterCache,
  goalieCache,
  CACHE_TTL,
  SKATER_COLUMN_MAP,
  GOALIE_COLUMN_MAP,
  fetchPlayerInfo,
};
