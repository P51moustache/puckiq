/**
 * Game Results Service
 * Supabase-only service for NHL game results and H2H records.
 * Seeding/syncing is handled by the sync pipeline (scripts/sync/), not the app.
 */

import { supabase } from '../lib/supabase';
import { GameResult, H2HRecord } from '../types/gameResults';

// Circuit breaker: stop calling Supabase after repeated failures
let _supabaseFailCount = 0;
let _supabaseLastFailTime = 0;
const SUPABASE_MAX_FAILS = 3;
const SUPABASE_RESET_TTL_MS = 60_000; // Auto-reset after 60 seconds

function isSupabaseAvailable(): boolean {
  if (_supabaseFailCount >= SUPABASE_MAX_FAILS) {
    // Auto-reset if TTL has elapsed since last failure
    if (Date.now() - _supabaseLastFailTime >= SUPABASE_RESET_TTL_MS) {
      _supabaseFailCount = 0;
      console.debug('[GAME RESULTS] Circuit breaker auto-reset after TTL');
      return true;
    }
    return false;
  }
  return true;
}

function recordSupabaseFailure(): void {
  _supabaseFailCount++;
  _supabaseLastFailTime = Date.now();
  if (_supabaseFailCount >= SUPABASE_MAX_FAILS) {
    console.debug('[GAME RESULTS] Supabase unavailable — skipping calls until TTL reset');
  }
}

function recordSupabaseSuccess(): void {
  _supabaseFailCount = 0;
}

/** Reset circuit breaker — for testing only */
export function _resetCircuitBreaker(): void {
  _supabaseFailCount = 0;
  _supabaseLastFailTime = 0;
}

/**
 * Returns the current NHL season as a number (e.g., 20252026).
 * If month >= October, season is currentYear + (currentYear+1).
 * Otherwise, season is (currentYear-1) + currentYear.
 */
function getCurrentSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed

  if (month >= 10) {
    return parseInt(`${year}${year + 1}`);
  }
  return parseInt(`${year - 1}${year}`);
}

/**
 * Gets the head-to-head record between two teams for a given season.
 *
 * @param teamA - First team abbreviation (e.g., 'TOR')
 * @param teamB - Second team abbreviation (e.g., 'MTL')
 * @param season - Optional season string (defaults to current season)
 * @returns H2HRecord or null on error
 */
export async function getH2HRecord(
  teamA: string,
  teamB: string,
  season?: number,
): Promise<H2HRecord | null> {
  if (!isSupabaseAvailable()) return null;
  try {
    const targetSeason = season ?? getCurrentSeason();

    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('season', targetSeason)
      .in('game_state', ['FINAL', 'OFF'])
      .or(
        `and(home_team_abbrev.eq.${teamA},away_team_abbrev.eq.${teamB}),and(home_team_abbrev.eq.${teamB},away_team_abbrev.eq.${teamA})`,
      )
      .order('game_date', { ascending: true });

    if (error) {
      recordSupabaseFailure();
      console.debug('[GAME RESULTS] getH2HRecord query error:', error.message ?? error);
      return null;
    }

    recordSupabaseSuccess();
    const games: GameResult[] = data ?? [];

    let teamAWins = 0;
    let teamBWins = 0;

    for (const game of games) {
      if (game.home_team_abbrev === teamA && game.home_score > game.away_score) {
        teamAWins++;
      } else if (game.away_team_abbrev === teamA && game.away_score > game.home_score) {
        teamAWins++;
      } else {
        teamBWins++;
      }
    }

    return {
      teamA,
      teamB,
      teamAWins,
      teamBWins,
      otLosses: 0,
      games,
    };
  } catch (err) {
    console.debug('[GAME RESULTS] getH2HRecord failed:', err);
    return null;
  }
}

/**
 * Fetches H2H records for a list of tonight's games in a single batch query.
 *
 * @param games - Array of game objects with homeTeam and awayTeam abbreviations.
 * @returns Map keyed by "AWAY-HOME" (e.g., "TOR-MTL") with H2HRecord values.
 */
export async function getH2HForGames(
  games: Array<{ homeTeam: { abbrev: string }; awayTeam: { abbrev: string } }>,
): Promise<Map<string, H2HRecord>> {
  const resultMap = new Map<string, H2HRecord>();

  if (!isSupabaseAvailable()) return resultMap;

  try {
    if (games.length === 0) {
      return resultMap;
    }

    const season = getCurrentSeason();

    // Build OR conditions for all game matchups
    const orConditions = games
      .map(
        (g) =>
          `and(home_team_abbrev.eq.${g.homeTeam.abbrev},away_team_abbrev.eq.${g.awayTeam.abbrev}),and(home_team_abbrev.eq.${g.awayTeam.abbrev},away_team_abbrev.eq.${g.homeTeam.abbrev})`,
      )
      .join(',');

    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('season', season)
      .in('game_state', ['FINAL', 'OFF'])
      .or(orConditions)
      .order('game_date', { ascending: true });

    if (error) {
      recordSupabaseFailure();
      console.debug('[GAME RESULTS] getH2HForGames query error:', error.message ?? error);
      return resultMap;
    }

    recordSupabaseSuccess();
    const allResults: GameResult[] = data ?? [];

    // Group results by matchup
    for (const game of games) {
      const away = game.awayTeam.abbrev;
      const home = game.homeTeam.abbrev;
      const key = `${away}-${home}`;

      const matchupGames = allResults.filter(
        (r) =>
          (r.home_team_abbrev === home && r.away_team_abbrev === away) ||
          (r.home_team_abbrev === away && r.away_team_abbrev === home),
      );

      let teamAWins = 0; // away team wins
      let teamBWins = 0; // home team wins

      for (const result of matchupGames) {
        if (result.home_team_abbrev === away && result.home_score > result.away_score) {
          teamAWins++;
        } else if (result.away_team_abbrev === away && result.away_score > result.home_score) {
          teamAWins++;
        } else {
          teamBWins++;
        }
      }

      resultMap.set(key, {
        teamA: away,
        teamB: home,
        teamAWins,
        teamBWins,
        otLosses: 0,
        games: matchupGames,
      });
    }

    return resultMap;
  } catch (err) {
    console.debug('[GAME RESULTS] getH2HForGames failed:', err);
    return resultMap;
  }
}

/**
 * Formats a H2H record into a human-readable summary string.
 *
 * @param record - The H2HRecord to format.
 * @returns A string like "TOR leads 3-1", "Tied 2-2", or "First meeting".
 */
export function formatH2HSummary(record: H2HRecord): string {
  if (record.games.length === 0) {
    return 'First meeting';
  }

  if (record.teamAWins === record.teamBWins) {
    return `Tied ${record.teamAWins}-${record.teamBWins}`;
  }

  if (record.teamAWins > record.teamBWins) {
    return `${record.teamA} leads ${record.teamAWins}-${record.teamBWins}`;
  }

  return `${record.teamB} leads ${record.teamBWins}-${record.teamAWins}`;
}

/**
 * Fetch all game results for the current season from Supabase.
 * Used for derived stats (momentum, clutch, rest) calculations.
 */
export async function fetchGameResults(): Promise<GameResult[]> {
  if (!isSupabaseAvailable()) return [];

  try {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('season', getCurrentSeason())
      .order('game_date', { ascending: false })
      .limit(500);

    if (error) {
      recordSupabaseFailure();
      console.debug('[GAME RESULTS] Failed to fetch game results:', error.message);
      return [];
    }

    recordSupabaseSuccess();
    return (data ?? []) as GameResult[];
  } catch (error) {
    recordSupabaseFailure();
    console.debug('[GAME RESULTS] Exception fetching game results:', error);
    return [];
  }
}
