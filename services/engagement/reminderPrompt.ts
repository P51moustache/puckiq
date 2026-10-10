/**
 * When Tonight offers game-night reminders. Asked at the moment they matter — a night when my
 * players play — instead of only during setup, where most people skip them. Never while the
 * first-night guide is showing (it has its own reminder step), never once the OS has said no,
 * and at most twice, a week apart.
 */

import type { PermissionState } from '../lineupReminders';

export const REMINDER_PROMPT_MAX_DISMISSALS = 2;
export const REMINDER_PROMPT_COOLDOWN_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

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
  guideActive: boolean;
  now: Date;
}

export function shouldOfferReminders(input: ReminderOfferInput): boolean {
  if (input.remindersOn || input.permission === 'denied' || !input.gameDay || input.guideActive) return false;
  if (input.state.dismissals >= REMINDER_PROMPT_MAX_DISMISSALS) return false;
  if (!input.state.lastDismissedAt) return true;
  const last = Date.parse(input.state.lastDismissedAt);
  return !Number.isFinite(last) || input.now.getTime() - last >= REMINDER_PROMPT_COOLDOWN_DAYS * DAY_MS;
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
