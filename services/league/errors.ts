/**
 * League Room failures as one typed error. The backend raises bare codes (`raise exception
 * 'room_full'`); PostgREST wraps them in its own message, so codes are matched by substring.
 */

import { ROOM_NAME_MAX } from '../../types/league';
import { formatAmount, MAX_DUES_AMOUNT } from './dues';
import { ROOM_ROSTER_MAX } from './roster';

export const LEAGUE_ERROR_CODES = [
  'not_signed_in',
  'invalid_code',
  'room_not_found',
  'room_full',
  'not_member',
  'not_owner',
  'invalid_name',
  'invalid_roster',
  'invalid_opponent',
  'rate_limited',
  'invalid_dues',
  'cannot_remove_self',
  'invalid_input',
  'not_configured',
  'network',
  'unavailable',
] as const;

export type LeagueErrorCode = (typeof LEAGUE_ERROR_CODES)[number];

/** Codes only this app produces; everything else comes from the backend's RPCs. */
const CLIENT_ONLY: readonly LeagueErrorCode[] = ['not_configured', 'network', 'unavailable'];
const BACKEND_CODES = LEAGUE_ERROR_CODES.filter((code) => !CLIENT_ONLY.includes(code));

/** An expired or rejected session token, as PostgREST / GoTrue word it. */
const SESSION_PATTERN = /\bjwt\b|invalid claim|refresh token/i;

/**
 * "That function or table doesn't exist": the League Room schema isn't deployed yet (the app can
 * ship before the migrations). PGRST202 / PGRST205 = not in PostgREST's schema cache; 42883 /
 * 42P01 = undefined function / table in Postgres.
 */
const MISSING_SCHEMA_CODES = ['PGRST202', 'PGRST205', '42883', '42P01'];
const MISSING_SCHEMA_PATTERN =
  /could not find the (?:function|table|relation)\b|relation "?[\w.]+"? does not exist|function [\w.]+\(.*\) does not exist/i;
/** PostgREST answers 404 for an RPC or table it doesn't know. */
const HTTP_NOT_FOUND = 404;

/**
 * SQLSTATEs that mean "the request itself was malformed": bad uuid / enum text, a check or
 * not-null constraint, an invalid parameter value.
 */
const INVALID_INPUT_SQLSTATES = ['22P02', '22023', '23502', '23514'];

const MESSAGES: Record<LeagueErrorCode, string> = {
  not_signed_in: 'Sign in with Apple to use League Rooms — a room needs to know which team is yours.',
  invalid_code: 'That code doesn’t look right. Room codes are 6 letters and numbers, like ABC234.',
  room_not_found: 'No room matches that code. Ask your commissioner for a fresh invite.',
  room_full: 'That room is full — every team in the league has joined.',
  not_member: 'You’re not in this room anymore. It may have closed, or the owner removed your team.',
  not_owner: 'Only the room’s owner can do that.',
  invalid_name: `That name won’t work. Use up to ${ROOM_NAME_MAX} characters and keep it friendly.`,
  invalid_roster: `Your roster couldn’t sync to the room. Check it has ${ROOM_ROSTER_MAX} players or fewer.`,
  invalid_opponent: 'That team isn’t in this room.',
  rate_limited: 'Easy there — give it a few minutes and try again.',
  invalid_dues: `Check the dues: a whole amount up to ${formatAmount(MAX_DUES_AMOUNT)}, payouts that fit the pot, and an https:// link.`,
  cannot_remove_self: 'You can’t remove yourself. Leave the room instead.',
  invalid_input: 'Something in that request wasn’t valid. Try again.',
  not_configured: 'League Rooms aren’t available in this build.',
  network: 'Couldn’t reach the League Room. Check your connection and try again.',
  unavailable: 'League Rooms aren’t switched on yet. Check back soon.',
};

/** User-facing copy for a failure. */
export function leagueErrorMessage(code: LeagueErrorCode): string {
  return MESSAGES[code];
}

export class LeagueError extends Error {
  readonly code: LeagueErrorCode;

  constructor(code: LeagueErrorCode, cause?: unknown) {
    super(leagueErrorMessage(code));
    // Transpiled `extends Error` can lose the prototype; keep `instanceof LeagueError` honest.
    Object.setPrototypeOf(this, LeagueError.prototype);
    this.name = 'LeagueError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

/** True for a LeagueError (optionally with a given code). */
export function isLeagueError(error: unknown, code?: LeagueErrorCode): error is LeagueError {
  return error instanceof LeagueError && (code === undefined || error.code === code);
}

function describe(error: unknown): { text: string; sqlState: string | null } {
  if (typeof error === 'string') return { text: error, sqlState: null };
  if (!error || typeof error !== 'object') return { text: '', sqlState: null };
  const fields = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
  const text = [fields.message, fields.details, fields.hint].filter((part) => typeof part === 'string').join(' ');
  return { text, sqlState: typeof fields.code === 'string' ? fields.code : null };
}

function isMissingSchema(text: string, sqlState: string | null, status?: number): boolean {
  return (
    status === HTTP_NOT_FOUND ||
    (sqlState !== null && MISSING_SCHEMA_CODES.includes(sqlState)) ||
    MISSING_SCHEMA_PATTERN.test(text)
  );
}

/**
 * Any thrown value or PostgREST error → LeagueError, in this order: a backend code anywhere in the
 * message; a missing function or table (or HTTP `status` 404) → `unavailable`; an expired session
 * → `not_signed_in`; malformed-input SQLSTATEs → `invalid_input`. Anything unrecognised is
 * `network`: from the member's side the room couldn't be reached. The original error stays on
 * `cause` for logs.
 */
export function toLeagueError(error: unknown, status?: number): LeagueError {
  if (error instanceof LeagueError) return error;
  const { text, sqlState } = describe(error);
  const backendCode = BACKEND_CODES.find((code) => text.includes(code));
  if (backendCode) return new LeagueError(backendCode, error);
  if (isMissingSchema(text, sqlState, status)) return new LeagueError('unavailable', error);
  if (SESSION_PATTERN.test(text)) return new LeagueError('not_signed_in', error);
  if (sqlState && INVALID_INPUT_SQLSTATES.includes(sqlState)) return new LeagueError('invalid_input', error);
  return new LeagueError('network', error);
}

/**
 * Whether a failure means League Rooms aren't deployed on the backend yet — show a calm "coming
 * soon" state rather than an error. Accepts a LeagueError or any raw error.
 */
export function isLeagueUnavailable(error: unknown): boolean {
  return toLeagueError(error).code === 'unavailable';
}
