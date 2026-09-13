import type { ArenaGame } from '../types/arena';
import { formatSeasonLabel, getCurrentSeason, isValidSeason } from './season';

export type SeasonPhase = 'offseason' | 'preseason' | 'regular' | 'playoffs';

export interface SeasonContext {
  phase: SeasonPhase;
  label: string;
  season: number;
  confidence: 'schedule' | 'calendar';
  note: string;
  nextGame: ArenaGame | null;
  daysUntilNextGame: number | null;
}

const SOURCE_MAX_AGE_MS = 36 * 60 * 60 * 1000;
const SOURCE_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const PHASE_LOOKBACK_DAYS = 7;
const FINAL_STATES = new Set(['FINAL', 'OFF']);
const ACTIVE_STATES = new Set(['PRE', 'LIVE', 'CRIT']);

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function easternDate(date: Date): string {
  const parts = Object.fromEntries(
    formatter.formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function validDateParts(value: string): { year: number; month: number; day: number; ordinal: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day, ordinal: Math.floor(date.getTime() / 86_400_000) };
}

function calendarPhase(month: number, day: number): SeasonPhase {
  if (month === 7 || month === 8 || (month === 9 && day < 15)) return 'offseason';
  if ((month === 9 && day >= 15) || (month === 10 && day < 7)) return 'preseason';
  if (month === 10 || month === 11 || month === 12 || month === 1 || month === 2 || month === 3 || (month === 4 && day < 15)) {
    return 'regular';
  }
  return 'playoffs';
}

function phaseForGameType(gameType: number): SeasonPhase | null {
  if (gameType === 1) return 'preseason';
  if (gameType === 2) return 'regular';
  if (gameType === 3) return 'playoffs';
  return null;
}

function phaseLabel(phase: SeasonPhase): string {
  if (phase === 'offseason') return 'Offseason';
  if (phase === 'preseason') return 'Preseason';
  if (phase === 'regular') return 'Regular season';
  return 'Playoffs';
}

interface CredibleGame {
  game: ArenaGame;
  dayDifference: number;
  startTime: number;
}

function credibleGame(game: ArenaGame, now: Date, todayOrdinal: number, season: number): CredibleGame | null {
  if (!isValidSeason(game.season) || game.season !== season || !phaseForGameType(game.game_type)) return null;
  const gameDay = validDateParts(game.game_date);
  const startTime = Date.parse(game.start_time_utc);
  const sourceTime = game.updated_at ? Date.parse(game.updated_at) : NaN;
  if (!gameDay || !Number.isFinite(startTime) || easternDate(new Date(startTime)) !== game.game_date) return null;
  if (!Number.isFinite(sourceTime) || sourceTime > now.getTime() + SOURCE_FUTURE_TOLERANCE_MS || now.getTime() - sourceTime > SOURCE_MAX_AGE_MS) return null;
  if (game.freshness?.source.status === 'stale') return null;
  return { game, dayDifference: gameDay.ordinal - todayOrdinal, startTime };
}

function evidenceRank(candidate: CredibleGame): number {
  if (ACTIVE_STATES.has(candidate.game.game_state) && candidate.dayDifference >= -1 && candidate.dayDifference <= 0) return 0;
  if (!FINAL_STATES.has(candidate.game.game_state) && candidate.dayDifference === 0) return 1;
  if (FINAL_STATES.has(candidate.game.game_state) && candidate.dayDifference >= -PHASE_LOOKBACK_DAYS && candidate.dayDifference <= 0) return 2;
  return 3;
}

export function resolveSeasonContext(games: ArenaGame[], now: Date = new Date()): SeasonContext {
  const today = validDateParts(easternDate(now))!;
  const season = getCurrentSeason(new Date(Date.UTC(today.year, today.month - 1, today.day, 12)));
  const fallbackPhase = calendarPhase(today.month, today.day);
  const credible = games
    .map(game => credibleGame(game, now, today.ordinal, season))
    .filter((game): game is CredibleGame => game !== null);

  const next = credible
    .filter(candidate => candidate.dayDifference >= 0 && !FINAL_STATES.has(candidate.game.game_state))
    .sort((a, b) => a.startTime - b.startTime)[0] ?? null;
  const evidence = credible
    .map(candidate => ({ candidate, rank: evidenceRank(candidate) }))
    .filter(item => item.rank < 3)
    .sort((a, b) => a.rank - b.rank || Math.abs(a.candidate.dayDifference) - Math.abs(b.candidate.dayDifference) || a.candidate.startTime - b.candidate.startTime)[0];
  const scheduledPhase = evidence ? phaseForGameType(evidence.candidate.game.game_type) : null;
  const phase = scheduledPhase ?? fallbackPhase;
  const confidence = scheduledPhase ? 'schedule' : 'calendar';
  const seasonLabel = formatSeasonLabel(season);

  return {
    phase,
    label: phaseLabel(phase),
    season,
    confidence,
    note: confidence === 'schedule'
      ? `Based on recently updated ${seasonLabel} NHL schedule data.`
      : 'Estimated from the time of year. The current schedule needs a verified refresh.',
    nextGame: next?.game ?? null,
    daysUntilNextGame: next?.dayDifference ?? null,
  };
}
