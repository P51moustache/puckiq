/**
 * NHL schedule + daily slate, normalized. Calendar dates only — never /now,
 * which jumps to the next slate in the off-season.
 */

import { fetchJson, HOUR, MINUTE } from './client';
import { addDays, weekDates, weekdayAbbrev } from './dates';

export const NHL_WEB_API = 'https://api-web.nhle.com';

/** Regular season. Preseason (1) and playoffs (3) never count toward fantasy weeks. */
export const PRESEASON = 1;
export const REGULAR_SEASON = 2;

/** Fewer than half the league playing. Off-night starts rarely collide with the rest of your lineup. */
export const OFF_NIGHT_MAX_GAMES = 7;

export interface NhlGame {
  id: number;
  date: string;
  gameType: number;
  startTimeUTC: string | null;
  /** FUT, PRE, LIVE, CRIT, FINAL, OFF */
  state: string;
  /** OK, PPD (postponed), CNCL */
  scheduleState: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  period: number | null;
  clock: string | null;
  inIntermission: boolean;
}

export interface ScheduleDay {
  date: string;
  dayAbbrev: string;
  games: NhlGame[];
}

export interface WeekSchedule {
  monday: string;
  days: ScheduleDay[];
}

interface RawTeam {
  abbrev?: string;
  score?: number;
}

interface RawGame {
  id?: number;
  gameType?: number;
  gameDate?: string;
  startTimeUTC?: string;
  gameState?: string;
  gameScheduleState?: string;
  homeTeam?: RawTeam;
  awayTeam?: RawTeam;
  period?: number;
  periodDescriptor?: { number?: number };
  clock?: { timeRemaining?: string; inIntermission?: boolean };
}

export function normalizeGame(raw: RawGame, date: string): NhlGame | null {
  const id = Number(raw.id);
  const home = (raw.homeTeam?.abbrev ?? '').toUpperCase();
  const away = (raw.awayTeam?.abbrev ?? '').toUpperCase();
  if (!Number.isFinite(id) || id <= 0 || !home || !away) return null;
  return {
    id,
    date: raw.gameDate ?? date,
    gameType: Number(raw.gameType ?? REGULAR_SEASON),
    startTimeUTC: raw.startTimeUTC ?? null,
    state: (raw.gameState ?? 'FUT').toUpperCase(),
    scheduleState: (raw.gameScheduleState ?? 'OK').toUpperCase(),
    home,
    away,
    homeScore: typeof raw.homeTeam?.score === 'number' ? raw.homeTeam.score : null,
    awayScore: typeof raw.awayTeam?.score === 'number' ? raw.awayTeam.score : null,
    period: raw.periodDescriptor?.number ?? raw.period ?? null,
    clock: raw.clock?.timeRemaining ?? null,
    inIntermission: raw.clock?.inIntermission === true,
  };
}

/** Games that count for fantasy: regular season and not postponed/cancelled. */
export function isFantasyGame(game: NhlGame): boolean {
  return game.gameType === REGULAR_SEASON && game.scheduleState === 'OK';
}

export function isGameStarted(game: Pick<NhlGame, 'state'>): boolean {
  return ['LIVE', 'CRIT', 'FINAL', 'OFF', 'OVER'].includes(game.state);
}

export function isGameFinal(game: Pick<NhlGame, 'state'>): boolean {
  return ['FINAL', 'OFF', 'OVER'].includes(game.state);
}

export function gameForTeam(games: NhlGame[], team: string): NhlGame | null {
  const abbrev = team.toUpperCase();
  if (!abbrev) return null;
  return games.find((game) => game.home === abbrev || game.away === abbrev) ?? null;
}

export function opponentOf(game: NhlGame, team: string): { opponent: string; isHome: boolean } {
  const isHome = game.home === team.toUpperCase();
  return { opponent: isHome ? game.away : game.home, isHome };
}

export function mapWeekPayload(payload: { gameWeek?: Array<{ date?: string; games?: RawGame[] }> }, monday: string): WeekSchedule {
  const byDate = new Map<string, NhlGame[]>();
  for (const day of payload.gameWeek ?? []) {
    if (!day.date) continue;
    const games = (day.games ?? [])
      .map((raw) => normalizeGame(raw, day.date as string))
      .filter((game): game is NhlGame => game !== null);
    byDate.set(day.date, games);
  }
  return {
    monday,
    days: weekDates(monday).map((date) => ({
      date,
      dayAbbrev: weekdayAbbrev(date),
      games: byDate.get(date) ?? [],
    })),
  };
}

/** Monday–Sunday schedule. The NHL endpoint returns seven days starting at the requested date. */
export async function fetchWeekSchedule(monday: string, options: { force?: boolean } = {}): Promise<WeekSchedule> {
  const payload = await fetchJson<{ gameWeek?: Array<{ date?: string; games?: RawGame[] }> }>(
    `${NHL_WEB_API}/v1/schedule/${monday}`,
    { ttlMs: 3 * HOUR, persist: true, force: options.force },
  );
  return mapWeekPayload(payload, monday);
}

/** Live-ish slate for one date (scores, periods, states). */
export async function fetchDaySlate(date: string, options: { force?: boolean } = {}): Promise<NhlGame[]> {
  const payload = await fetchJson<{ games?: RawGame[] }>(
    `${NHL_WEB_API}/v1/score/${date}`,
    { ttlMs: 1 * MINUTE, persist: true, force: options.force },
  );
  return (payload.games ?? [])
    .map((raw) => normalizeGame(raw, date))
    .filter((game): game is NhlGame => game !== null);
}

/**
 * First date on/after `from` with a regular-season game, looking a few weeks ahead.
 * Used for the preseason / All-Star break "next games" line.
 */
export async function findNextFantasyDate(from: string, weeksAhead = 4): Promise<string | null> {
  for (let week = 0; week < weeksAhead; week += 1) {
    const start = addDays(from, week * 7);
    try {
      const payload = await fetchJson<{ gameWeek?: Array<{ date?: string; games?: RawGame[] }> }>(
        `${NHL_WEB_API}/v1/schedule/${start}`,
        { ttlMs: 6 * HOUR, persist: true },
      );
      for (const day of payload.gameWeek ?? []) {
        if (!day.date || day.date < from) continue;
        const hasGame = (day.games ?? [])
          .map((raw) => normalizeGame(raw, day.date as string))
          .some((game) => game !== null && isFantasyGame(game));
        if (hasGame) return day.date;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function fantasyGamesOn(day: ScheduleDay): NhlGame[] {
  return day.games.filter(isFantasyGame);
}

export function isOffNight(day: ScheduleDay): boolean {
  const count = fantasyGamesOn(day).length;
  return count > 0 && count <= OFF_NIGHT_MAX_GAMES;
}
