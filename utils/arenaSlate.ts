import type { ArenaGame } from '../types/arena';

const day = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const MAX_SOURCE_AGE_MS = 36 * 60 * 60 * 1000;
const SOURCE_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const VALID_GAME_TYPES = new Set([1, 2, 3]);
const SCHEDULED_STATES = new Set(['FUT', 'PRE']);

const isFinalState = (game: ArenaGame) => ['FINAL', 'OFF'].includes(game.game_state);
const isLiveState = (game: ArenaGame) => ['LIVE', 'CRIT'].includes(game.game_state);

function isValidGameDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, date] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === date;
}

function hasMatchingStartDate(game: ArenaGame): boolean {
  const start = Date.parse(game.start_time_utc);
  return Number.isFinite(start) && day(new Date(start)) === game.game_date;
}

function sourceStatus(game: ArenaGame, now: Date): 'fresh' | 'stale' | 'unknown' {
  if (game.freshness?.source.status) return game.freshness.source.status;
  if (!game.updated_at) return 'unknown';

  const age = now.getTime() - Date.parse(game.updated_at);
  if (!Number.isFinite(age) || age < -SOURCE_FUTURE_TOLERANCE_MS || age > MAX_SOURCE_AGE_MS) return 'stale';
  return 'fresh';
}

export function getSourceFreshnessStatus(game: ArenaGame, now = new Date()) {
  return sourceStatus(game, now);
}

function hasKnownScore(score: number | null): score is number {
  return score !== null && Number.isInteger(score) && score >= 0;
}

export function formatFinalScore(game: ArenaGame): string {
  return hasKnownScore(game.away_score) && hasKnownScore(game.home_score)
    ? `${game.away_score}–${game.home_score}`
    : 'SCORE UNAVAILABLE';
}

export function selectArchiveGames(games: ArenaGame[], now = new Date()): ArenaGame[] {
  const today = day(now);
  return games.filter(game => isFinalState(game)
    && hasKnownScore(game.away_score)
    && hasKnownScore(game.home_score)
    && isValidGameDate(game.game_date)
    && game.game_date <= today);
}

/** Keep a late live game across midnight without resurrecting stale live flags. */
export function selectCurrentArenaGames(games: ArenaGame[], now = new Date(), currentSeason?: number): ArenaGame[] {
  const today = day(now);
  const yesterday = day(new Date(now.getTime() - 86400000));
  const recent = day(new Date(now.getTime() - 3 * 86400000));
  return games.filter(game => {
    if (!isFinalState(game) && currentSeason !== undefined && game.season !== currentSeason) return false;
    if (isLiveState(game)) {
      const age = game.updated_at ? now.getTime() - Date.parse(game.updated_at) : NaN;
      return VALID_GAME_TYPES.has(game.game_type)
        && isValidGameDate(game.game_date)
        && hasMatchingStartDate(game)
        && game.game_date >= yesterday
        && game.game_date <= today
        && Number.isFinite(age)
        && age >= -SOURCE_FUTURE_TOLERANCE_MS
        && age <= MAX_SOURCE_AGE_MS
        && sourceStatus(game, now) === 'fresh';
    }
    if (isFinalState(game)) return isValidGameDate(game.game_date) && game.game_date >= recent && game.game_date <= today;
    if (!SCHEDULED_STATES.has(game.game_state)
      || !VALID_GAME_TYPES.has(game.game_type)
      || !isValidGameDate(game.game_date)
      || !hasMatchingStartDate(game)) return false;
    if (sourceStatus(game, now) === 'stale') return false;
    const start = Date.parse(game.start_time_utc);
    return game.game_date >= today && (game.game_date !== today || start > now.getTime());
  });
}
