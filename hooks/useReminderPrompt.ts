/**
 * Tonight's game-night reminder sheet: whether to show it, and what its two buttons do.
 * It waits a moment after the lineup call (or recap) is on screen, so the ask follows something
 * useful, and only counts time while Tonight is focused and the app is in front.
 * Turning it on also adds the "your night is live" notification.
 * When a visit ends without the sheet, `reminder_prompt_skipped` says which rule kept it away.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useReminders } from '../components/RemindersProvider';
import {
  parseReminderPrompt,
  recordDismissal,
  reminderOfferBlock,
  type ReminderMoment,
  type ReminderPromptState,
  type ReminderSkipReason,
} from '../services/engagement/reminderPrompt';
import { track } from '../services/analytics/track';
import { useOnScreen, useSettled, useSkipLog } from './usePromptVisit';

export const REMINDER_PROMPT_KEY = 'puckiq_reminder_prompt';
/**
 * Long enough for the call's headline to land first. Was 4 s, but almost half of Tonight visits
 * ended inside 5 s (PostHog, Oct 2026), so most people left before the sheet could appear.
 */
export const REMINDER_SHEET_DELAY_MS = 1000;

/** Eligible, but the visit ended before the delay ran out. */
export type ReminderSkip = ReminderSkipReason | 'left_early';

export interface ReminderPrompt {
  visible: boolean;
  /** Which offer the sheet makes; null when there is none. */
  moment: ReminderMoment | null;
  /** Minutes before puck drop the reminder comes (the user's setting). */
  minutesBefore: number;
  /** Asks for notification permission; true when reminders ended up on. */
  accept: () => Promise<boolean>;
  dismiss: () => void;
}

export function useReminderPrompt({ moment, callShown }: { moment: ReminderMoment | null; callShown: boolean }): ReminderPrompt {
  const reminders = useReminders();
  const [state, setState] = useState<ReminderPromptState | null>(null);
  const onScreen = useOnScreen();
  const viewed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(REMINDER_PROMPT_KEY)
      .then((raw) => {
        if (!cancelled) setState(parseReminderPrompt(raw));
      })
      .catch(() => {
        if (!cancelled) setState(parseReminderPrompt(null));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const block = state ? reminderOfferBlock({
    state,
    remindersOn: reminders.settings.enabled && reminders.permission === 'granted',
    permission: reminders.permission,
    moment,
    callShown,
    now: new Date(),
  }) : null;
  const eligible = !!state && block === null;
  const settled = useSettled(eligible, onScreen, REMINDER_SHEET_DELAY_MS);
  const visible = eligible && onScreen && settled;

  useEffect(() => {
    if (!visible || viewed.current) return;
    viewed.current = true;
    track('reminder_prompt_view', { moment });
  }, [visible, moment]);

  useSkipLog({ event: 'reminder_prompt_skipped', onScreen, ready: !!state, skip: block ?? (eligible && !settled ? 'left_early' : null), moment, visible });

  const { enable } = reminders;
  const accept = useCallback(async () => {
    track('reminder_prompt_answer', { answer: 'on', moment });
    return enable({ source: moment === 'recap' ? 'recap_prompt' : 'tonight_prompt', liveStart: true });
  }, [enable, moment]);

  const dismiss = useCallback(() => {
    if (!state) return;
    track('reminder_prompt_answer', { answer: 'not_now', moment });
    const next = recordDismissal(state, new Date());
    setState(next);
    AsyncStorage.setItem(REMINDER_PROMPT_KEY, JSON.stringify(next)).catch(() => undefined);
  }, [state, moment]);

  return { visible, moment: eligible ? moment : null, minutesBefore: reminders.settings.minutesBefore, accept, dismiss };
}
