/**
 * When Tonight offers game-night reminders. Asked at the moment they matter (a night when my
 * players play, once the lineup call is on screen) instead of during setup, where most people
 * skipped them. Never once the OS has said no, and at most twice, a week apart.
 */

import type { PermissionState } from '../lineupReminders';

export const REMINDER_PROMPT_MAX_DISMISSALS = 2;
export const REMINDER_PROMPT_COOLDOWN_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

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
  /** At least one of my players has a game on the viewed night. */
  gameDay: boolean;
  /** Tonight's lineup call has loaded, so the ask follows something useful. */
  callShown: boolean;
  now: Date;
}

export function shouldOfferReminders(input: ReminderOfferInput): boolean {
  if (input.remindersOn || input.permission === 'denied' || !input.gameDay || !input.callShown) return false;
  if (input.state.dismissals >= REMINDER_PROMPT_MAX_DISMISSALS) return false;
  if (!input.state.lastDismissedAt) return true;
  const last = Date.parse(input.state.lastDismissedAt);
  return !Number.isFinite(last) || input.now.getTime() - last >= REMINDER_PROMPT_COOLDOWN_DAYS * DAY_MS;
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
