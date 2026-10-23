/**
 * The "Pro is on" welcome after a trial or subscription starts (concept A,
 * docs/design/trial-welcome/concept-a.png): when it is due, the first move Pro unlocked tonight,
 * how that move's players are called, and the trial line. In Oct 2026, 4 of 7 trial starters came
 * back on at most one more day, so the welcome shows what Pro adds and asks for reminders while
 * they are still in the app.
 */

import { visibleMoves, type CoachMove, type CoachMoveKind } from '../fantasy/coach';
import type { ProStatus } from '../subscription';

export interface TrialWelcomeRecord {
  /** When the purchase went through (ISO). */
  startedAt: string;
  /** "$19.99/year", as the paywall showed it; null when the price never loaded. */
  renewal: string | null;
}

/** Shown on a Tonight visit within this many days of the purchase; after that the moment has passed. */
export const TRIAL_WELCOME_WINDOW_DAYS = 3;
/** Faces on the move card: enough to read at a glance, never a scrolling list. */
export const WELCOME_MAX_PLAYERS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseTrialWelcome(raw: string | null): TrialWelcomeRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TrialWelcomeRecord>;
    if (typeof parsed.startedAt !== 'string' || !Number.isFinite(Date.parse(parsed.startedAt))) return null;
    return { startedAt: parsed.startedAt, renewal: typeof parsed.renewal === 'string' ? parsed.renewal : null };
  } catch {
    return null;
  }
}

/** A purchase is waiting for its welcome and is still recent enough to greet. */
export function welcomeDue(record: TrialWelcomeRecord | null, now: Date): boolean {
  if (!record) return false;
  const age = now.getTime() - Date.parse(record.startedAt);
  return age >= 0 && age < TRIAL_WELCOME_WINDOW_DAYS * DAY_MS;
}

/** The first of the night's moves a free user couldn't see; null when Pro adds none tonight. */
export function firstProMove(moves: readonly CoachMove[]): CoachMove | null {
  const free = new Set(visibleMoves([...moves], false));
  return moves.find((move) => move.kind !== 'clean' && !free.has(move)) ?? null;
}

export interface MoveCall {
  label: string;
  tone: 'bad' | 'warn';
}

/** The pill beside each player on the move card. Empty slots have no player to call. */
const CALLS: Partial<Record<CoachMoveKind, MoveCall>> = {
  overflow: { label: 'SIT', tone: 'bad' },
  off: { label: 'BENCH', tone: 'bad' },
  scratch: { label: 'OUT', tone: 'bad' },
  injury: { label: 'CHECK', tone: 'warn' },
  goalie: { label: 'CHECK', tone: 'warn' },
};

export function movePlayers(move: CoachMove): { playerId: number; call: MoveCall }[] {
  const call = CALLS[move.kind];
  if (!call) return [];
  return move.playerIds.slice(0, WELCOME_MAX_PLAYERS).map((playerId) => ({ playerId, call }));
}

/** "Oct 29" in the device's time zone. */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** The small print: when the free days end and what follows. Null when there's nothing honest to say. */
export function trialLine(status: ProStatus, renewal: string | null): string | null {
  if (status.periodType === 'trial' && status.expiresAt) {
    const then = renewal ? ` · then ${renewal}` : '';
    return `Free until ${shortDate(status.expiresAt)}${then}. Cancel anytime in Settings.`;
  }
  return renewal ? `${renewal}, renews automatically. Cancel anytime in Settings.` : null;
}
