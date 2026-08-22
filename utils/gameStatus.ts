/**
 * Honest live-game status for hub / Today UI.
 *
 * DATA_GAPS P1: Supabase has game_state / period but no live clock column,
 * and the daily sync does not refresh during a typical evening slate.
 * We show a clean LIVE mark — never a fabricated "P0" clock — and treat a
 * game as in-progress when the NHL state says so, or when puck drop has
 * passed inside a typical NHL game window (so FUT/PRE rows are not shown
 * as still upcoming while the game is actually on).
 */

export const TYPICAL_GAME_MS = 4 * 60 * 60 * 1000;

export type GameStatusLike = {
  gameState?: string | null;
  startTimeUTC?: string | null;
  period?: number | null;
  clock?: { timeRemaining?: string; inIntermission?: boolean } | null;
  awayTeam?: { score?: number | null } | null;
  homeTeam?: { score?: number | null } | null;
};

export type GameLiveStatus = {
  isLive: boolean;
  isFinal: boolean;
  /** Period / clock fragment. Never "P0". Null when we have no real clock. */
  periodClock: string | null;
  /** "2-1" when we have a real score signal; null for unknown 0-0. */
  score: string | null;
  /** Score + period/clock, for cards that prefix "LIVE" themselves. */
  detail: string;
};

const LIVE_STATES = new Set(['LIVE', 'CRIT']);
const FINAL_STATES = new Set(['FINAL', 'OFF']);

function parseStartMs(startTimeUTC?: string | null): number | null {
  if (!startTimeUTC) return null;
  const start = Date.parse(startTimeUTC);
  return Number.isNaN(start) ? null : start;
}

/** Official NHL in-progress states only (not PRE). */
export function isOfficialLiveState(gameState?: string | null): boolean {
  return LIVE_STATES.has(gameState ?? '');
}

export function isFinalState(gameState?: string | null): boolean {
  return FINAL_STATES.has(gameState ?? '');
}

/**
 * True when the game should be marked LIVE in the UI.
 * PRE is not live unless puck drop has already passed.
 */
export function isLiveGame(game: GameStatusLike, now = Date.now()): boolean {
  const state = game.gameState ?? '';
  if (LIVE_STATES.has(state)) return true;
  if (FINAL_STATES.has(state)) return false;
  const start = parseStartMs(game.startTimeUTC);
  if (start == null) return false;
  const elapsed = now - start;
  return elapsed >= 0 && elapsed < TYPICAL_GAME_MS;
}

function periodClockText(game: GameStatusLike): string | null {
  const period = typeof game.period === 'number' ? game.period : 0;
  const hasPeriod = period >= 1;
  const periodLabel = hasPeriod ? (period <= 3 ? `P${period}` : 'OT') : null;
  const clock = game.clock?.timeRemaining?.trim() || '';
  const inIntermission = !!game.clock?.inIntermission;

  if (inIntermission) {
    return periodLabel ? `INT ${periodLabel}` : 'INT';
  }
  if (periodLabel && clock) return `${periodLabel} ${clock}`;
  if (periodLabel) return periodLabel;
  if (clock) return clock;
  return null;
}

function scoreText(game: GameStatusLike, hasPeriod: boolean): string | null {
  const away = game.awayTeam?.score ?? 0;
  const home = game.homeTeam?.score ?? 0;
  if (hasPeriod || away > 0 || home > 0) {
    return `${away}-${home}`;
  }
  return null;
}

export function getGameLiveStatus(game: GameStatusLike, now = Date.now()): GameLiveStatus {
  const state = game.gameState ?? '';
  const period = typeof game.period === 'number' ? game.period : 0;
  const hasPeriod = period >= 1;

  if (FINAL_STATES.has(state)) {
    const score = `${game.awayTeam?.score ?? 0}-${game.homeTeam?.score ?? 0}`;
    return {
      isLive: false,
      isFinal: true,
      periodClock: null,
      score,
      detail: `FINAL ${score}`,
    };
  }

  if (isLiveGame(game, now)) {
    const periodClock = periodClockText(game);
    const score = scoreText(game, hasPeriod);
    const detail = [score, periodClock].filter(Boolean).join('  ');
    return { isLive: true, isFinal: false, periodClock, score, detail };
  }

  return { isLive: false, isFinal: false, periodClock: null, score: null, detail: '' };
}

/** Drop-in replacement for the old per-component formatGameTime helpers. */
export function formatGameTime(
  game: GameStatusLike,
  now = Date.now(),
): { text: string; isLive: boolean; isFinal: boolean } {
  const status = getGameLiveStatus(game, now);
  if (status.isFinal) {
    return { text: status.detail, isLive: false, isFinal: true };
  }
  if (status.isLive) {
    return { text: status.detail, isLive: true, isFinal: false };
  }
  if (game.startTimeUTC) {
    const time = new Date(game.startTimeUTC).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return { text: time, isLive: false, isFinal: false };
  }
  return { text: 'TBD', isLive: false, isFinal: false };
}

export function livePrefixLabel(detail: string): string {
  return detail ? `LIVE  ${detail}` : 'LIVE';
}
