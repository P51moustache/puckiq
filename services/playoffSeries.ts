import { supabase } from '../lib/supabase';
import type { ArenaGame } from '../types/arena';
import { isValidSeason } from '../utils/season';

export interface PlayoffSeries {
  games: ArenaGame[];
  awayWins: number;
  homeWins: number;
}

const GAME_COLUMNS = 'id,season,game_date,start_time_utc,game_type,game_state,home_team_abbrev,away_team_abbrev,home_score,away_score,venue,updated_at';
const FINAL_STATES = new Set(['FINAL', 'OFF']);

function validTeam(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
}

function validAnchor(game: ArenaGame): boolean {
  return game.game_type === 3 &&
    isValidSeason(game.season) &&
    validTeam(game.away_team_abbrev) &&
    validTeam(game.home_team_abbrev) &&
    game.away_team_abbrev !== game.home_team_abbrev;
}

function exactSeriesGame(game: ArenaGame, anchor: ArenaGame): boolean {
  if (!Number.isSafeInteger(game.id) || game.id <= 0 || game.season !== anchor.season || game.game_type !== 3) return false;
  const teams = new Set([game.away_team_abbrev, game.home_team_abbrev]);
  return teams.size === 2 && teams.has(anchor.away_team_abbrev) && teams.has(anchor.home_team_abbrev);
}

function knownScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function summarizePlayoffSeries(games: ArenaGame[], anchor: ArenaGame): PlayoffSeries {
  if (!validAnchor(anchor)) return { games: [], awayWins: 0, homeWins: 0 };
  const byId = new Map<number, ArenaGame>();
  const conflicts = new Set<number>();
  for (const game of games) {
    if (!exactSeriesGame(game, anchor)) continue;
    const existing = byId.get(game.id);
    if (!existing) {
      byId.set(game.id, game);
      continue;
    }
    const sameEvidence = existing.home_team_abbrev === game.home_team_abbrev &&
      existing.away_team_abbrev === game.away_team_abbrev &&
      existing.game_state === game.game_state &&
      existing.home_score === game.home_score &&
      existing.away_score === game.away_score;
    if (!sameEvidence) conflicts.add(game.id);
  }
  for (const id of conflicts) {
    const game = byId.get(id)!;
    byId.set(id, { ...game, home_score: null, away_score: null });
  }
  const exactGames = [...byId.values()]
    .map(game => FINAL_STATES.has(game.game_state) && (!knownScore(game.home_score) || !knownScore(game.away_score) || game.home_score === game.away_score)
      ? { ...game, home_score: null, away_score: null } : game)
    .sort((a, b) => a.game_date.localeCompare(b.game_date) || Date.parse(a.start_time_utc) - Date.parse(b.start_time_utc));
  let awayWins = 0;
  let homeWins = 0;

  for (const game of exactGames) {
    if (!FINAL_STATES.has(game.game_state) || !knownScore(game.away_score) || !knownScore(game.home_score) || game.away_score === game.home_score) continue;
    const winner = game.away_score > game.home_score ? game.away_team_abbrev : game.home_team_abbrev;
    if (winner === anchor.away_team_abbrev) awayWins += 1;
    if (winner === anchor.home_team_abbrev) homeWins += 1;
  }
  return { games: exactGames, awayWins, homeWins };
}

export async function fetchPlayoffSeries(game: ArenaGame): Promise<PlayoffSeries | null> {
  if (!validAnchor(game)) return null;
  const home = game.home_team_abbrev;
  const away = game.away_team_abbrev;
  const { data, error } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .eq('season', game.season)
    .eq('game_type', 3)
    .or(`and(home_team_abbrev.eq.${home},away_team_abbrev.eq.${away}),and(home_team_abbrev.eq.${away},away_team_abbrev.eq.${home})`)
    .order('game_date', { ascending: true });

  if (error) {
    console.debug('[PLAYOFF SERIES] Query failed:', error.message ?? error);
    return null;
  }
  return summarizePlayoffSeries((data ?? []).map(row => ({ ...row, forecast: null }) as ArenaGame), game);
}
