/**
 * Game Results Service
 * Supabase-backed service for NHL game results, seeding, syncing, and H2H records.
 */

import { supabase } from '../lib/supabase';
import { GameResult, H2HRecord, NHLScheduleGame } from '../types/gameResults';

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

// All 32 NHL team abbreviations
const ALL_TEAMS: string[] = [
  'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL',
  'DAL', 'DET', 'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD',
  'NSH', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'SEA', 'SJS',
  'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK', 'WPG', 'WSH',
];

/**
 * Returns the current NHL season string (e.g., '20252026').
 * If month >= October, season is currentYear + (currentYear+1).
 * Otherwise, season is (currentYear-1) + currentYear.
 */
function getCurrentSeason(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed

  if (month >= 10) {
    return `${year}${year + 1}`;
  }
  return `${year - 1}${year}`;
}

/**
 * Seeds the current season's completed game results into Supabase.
 * Fetches each team's schedule from the NHL API and upserts finished games.
 *
 * @param onProgress - Optional callback fired after each team is processed.
 * @returns The total number of unique games inserted/updated.
 */
export async function seedCurrentSeason(
  onProgress?: (team: string, index: number, total: number) => void,
): Promise<number> {
  try {
    const season = getCurrentSeason();
    const gameMap = new Map<number, {
      game_id: number;
      season: string;
      game_date: string;
      home_team: string;
      away_team: string;
      home_score: number;
      away_score: number;
      game_state: string;
    }>();

    for (let i = 0; i < ALL_TEAMS.length; i++) {
      const team = ALL_TEAMS[i];
      try {
        const url = `https://api-web.nhle.com/v1/club-schedule-season/${team}/${season}`;
        const response = await fetch(url);
        const data = await response.json();
        const games: NHLScheduleGame[] = data.games ?? [];

        for (const game of games) {
          if (game.gameState === 'FINAL' || game.gameState === 'OFF') {
            gameMap.set(game.id, {
              game_id: game.id,
              season,
              game_date: game.gameDate,
              home_team: game.homeTeam.abbrev,
              away_team: game.awayTeam.abbrev,
              home_score: game.homeTeam.score ?? 0,
              away_score: game.awayTeam.score ?? 0,
              game_state: game.gameState,
            });
          }
        }
      } catch (err) {
        console.warn(`[GAME RESULTS] Failed to fetch schedule for ${team}:`, err);
      }

      if (onProgress) {
        onProgress(team, i, ALL_TEAMS.length);
      }

      // 100ms delay between team fetches to avoid rate limiting
      if (i < ALL_TEAMS.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const allGames = Array.from(gameMap.values());

    if (allGames.length === 0) {
      return 0;
    }

    // Batch upsert into Supabase
    const { error } = await supabase
      .from('game_results')
      .upsert(allGames, { onConflict: 'game_id' });

    if (error) {
      console.warn('[GAME RESULTS] Supabase upsert error:', error);
      return 0;
    }

    return allGames.length;
  } catch (err) {
    console.warn('[GAME RESULTS] seedCurrentSeason failed:', err);
    return 0;
  }
}

/**
 * Syncs recent game results (yesterday and today) into Supabase.
 * Designed to be called on app launch as a lightweight daily sync.
 */
export async function syncRecentResults(): Promise<void> {
  if (!isSupabaseAvailable()) return;
  try {
    // Check if the table has any data for this season.
    // If empty, trigger a full season seed instead of just syncing recent days.
    const season = getCurrentSeason();
    const { count, error: countError } = await supabase
      .from('game_results')
      .select('game_id', { count: 'exact', head: true })
      .eq('season', season);

    if (countError) {
      recordSupabaseFailure();
      console.debug('[GAME RESULTS] syncRecentResults count check failed:', countError.message ?? countError);
      return;
    }

    if ((count ?? 0) === 0) {
      console.debug('[GAME RESULTS] Table empty — running full season seed');
      await seedCurrentSeason();
      return;
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const formatDate = (d: Date): string => d.toISOString().split('T')[0];
    const dates = [formatDate(yesterday), formatDate(today)];

    const allGames: Array<{
      game_id: number;
      season: string;
      game_date: string;
      home_team: string;
      away_team: string;
      home_score: number;
      away_score: number;
      game_state: string;
    }> = [];

    for (const date of dates) {
      try {
        const url = `https://api-web.nhle.com/v1/score/${date}`;
        const response = await fetch(url);
        const data = await response.json();
        const games: NHLScheduleGame[] = data.games ?? [];

        for (const game of games) {
          if (game.gameState === 'FINAL' || game.gameState === 'OFF') {
            allGames.push({
              game_id: game.id,
              season,
              game_date: game.gameDate,
              home_team: game.homeTeam.abbrev,
              away_team: game.awayTeam.abbrev,
              home_score: game.homeTeam.score ?? 0,
              away_score: game.awayTeam.score ?? 0,
              game_state: game.gameState,
            });
          }
        }
      } catch (err) {
        console.warn(`[GAME RESULTS] Failed to fetch scores for ${date}:`, err);
      }
    }

    if (allGames.length > 0) {
      const { error } = await supabase
        .from('game_results')
        .upsert(allGames, { onConflict: 'game_id' });

      if (error) {
        recordSupabaseFailure();
        console.debug('[GAME RESULTS] syncRecentResults upsert error:', error.message ?? error);
      } else {
        recordSupabaseSuccess();
      }
    }
  } catch (err) {
    recordSupabaseFailure();
    console.debug('[GAME RESULTS] syncRecentResults failed:', err);
  }
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
  season?: string,
): Promise<H2HRecord | null> {
  if (!isSupabaseAvailable()) return null;
  try {
    const targetSeason = season ?? getCurrentSeason();

    const { data, error } = await supabase
      .from('game_results')
      .select('*')
      .eq('season', targetSeason)
      .in('game_state', ['FINAL', 'OFF'])
      .or(
        `and(home_team.eq.${teamA},away_team.eq.${teamB}),and(home_team.eq.${teamB},away_team.eq.${teamA})`,
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
      if (game.home_team === teamA && game.home_score > game.away_score) {
        teamAWins++;
      } else if (game.away_team === teamA && game.away_score > game.home_score) {
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
          `and(home_team.eq.${g.homeTeam.abbrev},away_team.eq.${g.awayTeam.abbrev}),and(home_team.eq.${g.awayTeam.abbrev},away_team.eq.${g.homeTeam.abbrev})`,
      )
      .join(',');

    const { data, error } = await supabase
      .from('game_results')
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
          (r.home_team === home && r.away_team === away) ||
          (r.home_team === away && r.away_team === home),
      );

      let teamAWins = 0; // away team wins
      let teamBWins = 0; // home team wins

      for (const result of matchupGames) {
        if (result.home_team === away && result.home_score > result.away_score) {
          teamAWins++;
        } else if (result.away_team === away && result.away_score > result.home_score) {
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
      .from('game_results')
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
