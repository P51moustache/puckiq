/**
 * Team Form Service
 * Fetches recent game results for a team and computes W/L/OTL form data.
 * Uses a 30-minute in-memory cache. Returns null on error — form data is optional.
 */

import type { TeamFormData } from '../types/teamForm';
import { supabase } from '../lib/supabase';
import logger from '../utils/logger';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry {
  data: TeamFormData;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(key: string): TeamFormData | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: TeamFormData): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Determine game result for the given team from a schedule game object.
 * Expects game.homeTeam / game.awayTeam with abbrev, score, and the game-level
 * `gameOutcome.lastPeriodType` field.
 */
function determineResult(
  game: any,
  teamAbbrev: string,
): 'W' | 'L' | 'OTL' | null {
  const home = game.homeTeam;
  const away = game.awayTeam;

  if (!home || !away) return null;

  const isHome = home.abbrev === teamAbbrev;
  const teamScore = isHome ? home.score : away.score;
  const oppScore = isHome ? away.score : home.score;

  if (teamScore == null || oppScore == null) return null;

  if (teamScore > oppScore) return 'W';

  // Check for OT/SO loss
  const lastPeriod = game.gameOutcome?.lastPeriodType;
  if (lastPeriod === 'OT' || lastPeriod === 'SO') return 'OTL';

  return 'L';
}

/**
 * Compute the current streak from an array of results (most recent first).
 */
function computeStreak(results: ('W' | 'L' | 'OTL')[]): string {
  if (results.length === 0) return '';

  const first = results[0];
  let count = 1;
  for (let i = 1; i < results.length; i++) {
    if (results[i] !== first) break;
    count++;
  }
  return `${first}${count}`;
}

/**
 * Fetch recent form (last 10 completed games) for a team.
 * Uses the club-schedule-season endpoint which returns the full season schedule.
 */
export async function fetchTeamForm(
  teamAbbrev: string,
): Promise<TeamFormData | null> {
  const cached = getCached(teamAbbrev);
  if (cached) return cached;

  try {
    // --- Supabase-first: last 10 completed games for this team ---
    let recentGames: any[] = [];
    let supabaseOk = false;

    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .or(`home_team_abbrev.eq.${teamAbbrev},away_team_abbrev.eq.${teamAbbrev}`)
        .in('game_state', ['FINAL', 'OFF'])
        .order('game_date', { ascending: false })
        .limit(10);

      if (!error && data && data.length > 0) {
        // Transform Supabase rows to the shape determineResult() expects
        recentGames = data.map((row: any) => ({
          gameDate: row.game_date,
          gameState: row.game_state,
          homeTeam: {
            abbrev: row.home_team_abbrev,
            score: row.home_score,
          },
          awayTeam: {
            abbrev: row.away_team_abbrev,
            score: row.away_score,
          },
          gameOutcome: {
            lastPeriodType: row.period_type,
          },
        }));
        supabaseOk = true;
        logger.info('[SUPABASE] Loaded', data.length, 'recent games for', teamAbbrev);
      } else {
        logger.warn('[SUPABASE] No completed games for', teamAbbrev, '— falling back to NHL API');
      }
    } catch (supabaseErr) {
      logger.warn('[SUPABASE] Error querying team form, falling back to NHL API', supabaseErr);
    }

    // --- NHL API fallback ---
    if (!supabaseOk) {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

      const [currentRes, prevRes] = await Promise.allSettled([
        fetch(`https://api-web.nhle.com/v1/club-schedule/${teamAbbrev}/month/${currentMonth}`),
        fetch(`https://api-web.nhle.com/v1/club-schedule/${teamAbbrev}/month/${prevMonth}`),
      ]);

      const games: any[] = [];

      for (const res of [prevRes, currentRes]) {
        if (res.status === 'fulfilled' && res.value.ok) {
          const data = await res.value.json();
          if (Array.isArray(data.games)) {
            games.push(...data.games);
          }
        }
      }

      // Filter to completed games only
      const completedGames = games.filter(
        (g) => g.gameState === 'OFF' || g.gameState === 'FINAL',
      );

      // Sort by game date descending (most recent first)
      completedGames.sort(
        (a, b) =>
          new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime(),
      );

      recentGames = completedGames.slice(0, 10);
    }

    // Determine results from whichever source provided games
    const results: ('W' | 'L' | 'OTL')[] = [];

    for (const game of recentGames) {
      const result = determineResult(game, teamAbbrev);
      if (result) results.push(result);
    }

    const wins = results.filter((r) => r === 'W').length;
    const losses = results.filter((r) => r === 'L').length;
    const otLosses = results.filter((r) => r === 'OTL').length;

    const formData: TeamFormData = {
      teamAbbrev,
      results,
      wins,
      losses,
      otLosses,
      streak: computeStreak(results),
    };

    setCache(teamAbbrev, formData);
    return formData;
  } catch (error) {
    console.error('[TeamForm] Failed to fetch:', error);
    return null;
  }
}

export function clearTeamFormCache(): void {
  cache.clear();
}

/** Visible for testing */
export const _internals = {
  cache,
  CACHE_TTL_MS,
  getCached,
  setCache,
  determineResult,
  computeStreak,
};
