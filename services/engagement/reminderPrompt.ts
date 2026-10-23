/**
 * When Tonight offers game-night reminders, and what the offer says. Asked at moments the app
 * has just been useful (a night when my players play, once the lineup call is on screen, or
 * the morning recap) instead of during setup, where most people skipped them. Never once the
 * OS has said no, and at most twice, a week apart.
 */

import type { PermissionState } from '../lineupReminders';
import { formatPuckDrop } from '../nhl/dates';

export const REMINDER_PROMPT_MAX_DISMISSALS = 2;
export const REMINDER_PROMPT_COOLDOWN_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/**
 * Why the offer is on screen: my players play tonight and lineups haven't locked yet, they
 * already have (most visits come during or after the games), or last night's recap is showing.
 */
export type ReminderMoment = 'before_lock' | 'after_lock' | 'recap';

/** Why the offer stayed away, as logged by `reminder_prompt_skipped`. */
export type ReminderSkipReason =
  | 'reminders_on'
  | 'permission_denied'
  | 'asked_twice'
  | 'cooling_down'
  | 'no_game'
  | 'call_loading'
  | 'other_prompt';

export interface ReminderPromptState {
  dismissals: number;
  /** ISO time of the last "Not now". */
  lastDismissedAt: string | null;
}

export const NEW_REMINDER_PROMPT: ReminderPromptState = { dismissals: 0, lastDismissedAt: null };

export interface ReminderOfferInput {
  state: ReminderPromptState;
  remindersOn: boolean;
  permission: PermissionState;
  /** Null when there is nothing to hang the ask on: no game of mine tonight and no recap. */
  moment: ReminderMoment | null;
  /** Something useful (tonight's lineup call, or the recap) is on screen, so the ask follows it. */
  callShown: boolean;
  /** Another Tonight ask (the "Pro is on" welcome) is up or due this visit. */
  otherPrompt: boolean;
  now: Date;
}

/** The moment Tonight is in, or null. Before lock wins: its copy names tonight's lock time. */
export function reminderMoment({ recapShown, playingTonight, beforePuck }: {
  recapShown: boolean;
  playingTonight: boolean;
  beforePuck: boolean;
}): ReminderMoment | null {
  if (playingTonight) return beforePuck ? 'before_lock' : 'after_lock';
  return recapShown ? 'recap' : null;
}

/** The first rule that keeps the offer away, or null when it may show. */
export function reminderOfferBlock(input: ReminderOfferInput): ReminderSkipReason | null {
  if (input.remindersOn) return 'reminders_on';
  if (input.permission === 'denied') return 'permission_denied';
  if (input.state.dismissals >= REMINDER_PROMPT_MAX_DISMISSALS) return 'asked_twice';
  if (input.state.lastDismissedAt) {
    const last = Date.parse(input.state.lastDismissedAt);
    if (Number.isFinite(last) && input.now.getTime() - last < REMINDER_PROMPT_COOLDOWN_DAYS * DAY_MS) return 'cooling_down';
  }
  if (input.otherPrompt) return 'other_prompt';
  if (!input.moment) return 'no_game';
  if (!input.callShown) return 'call_loading';
  return null;
}

export function shouldOfferReminders(input: ReminderOfferInput): boolean {
  return reminderOfferBlock(input) === null;
}

/** "an hour" / "30 minutes": how far ahead of puck drop the reminder comes, for the ask's copy. */
export function reminderLeadLabel(minutesBefore: number): string {
  if (minutesBefore === 60) return 'an hour';
  return `${minutesBefore} minutes`;
}

/**
 * The ask's body. Once puck drop is closer than the reminder's lead, tonight's ping can no
 * longer come, so the offer is for the next game night instead.
 */
export function reminderOfferLine(minutesBefore: number, firstPuck: string | null, nowMs: number): string {
  const lead = reminderLeadLabel(minutesBefore);
  const puckMs = firstPuck ? Date.parse(firstPuck) : NaN;
  const tooLateTonight = Number.isFinite(puckMs) && puckMs - minutesBefore * MINUTE_MS <= nowMs;
  return tooLateTonight
    ? `Want a ping ${lead} before puck drop on your next game night?`
    : `Want a ping ${lead} before puck drop, with tonight’s call?`;
}

export interface ReminderOfferCopy {
  title: string;
  body: string;
}

/** The sheet's headline and ask for each moment. After lock, tonight's ping can no longer come. */
export function reminderOfferCopy(moment: ReminderMoment, minutesBefore: number, firstPuck: string | null, nowMs: number): ReminderOfferCopy {
  const lead = reminderLeadLabel(minutesBefore);
  if (moment === 'after_lock') {
    return { title: 'Catch the next lock', body: `Want a ping ${lead} before puck drop on your next game night?` };
  }
  if (moment === 'recap') {
    return { title: 'Get the call before lock', body: `Want a ping ${lead} before puck drop on game nights, with the call ready?` };
  }
  return {
    title: firstPuck ? `Lineup locks at ${formatPuckDrop(firstPuck)}` : 'Your players play tonight',
    body: reminderOfferLine(minutesBefore, firstPuck, nowMs),
  };
}

export function recordDismissal(state: ReminderPromptState, now: Date): ReminderPromptState {
  return { dismissals: state.dismissals + 1, lastDismissedAt: now.toISOString() };
}

export function parseReminderPrompt(raw: string | null): ReminderPromptState {
  if (!raw) return NEW_REMINDER_PROMPT;
  try {
    const value = JSON.parse(raw) as Partial<ReminderPromptState>;
    return {
      dismissals: typeof value.dismissals === 'number' && value.dismissals >= 0 ? Math.floor(value.dismissals) : 0,
      lastDismissedAt: typeof value.lastDismissedAt === 'string' ? value.lastDismissedAt : null,
    };
  } catch {
    return NEW_REMINDER_PROMPT;
  }
}
