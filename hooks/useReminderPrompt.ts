/**
 * Tonight's game-night reminder sheet: whether to show it, and what its two buttons do.
 * It waits a few seconds after the lineup call loads, so the call is read before the ask.
 * Turning it on also adds the "your night is live" notification.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useReminders } from '../components/RemindersProvider';
import {
  parseReminderPrompt,
  recordDismissal,
  shouldOfferReminders,
  type ReminderPromptState,
} from '../services/engagement/reminderPrompt';
import { track } from '../services/analytics/track';

export const REMINDER_PROMPT_KEY = 'puckiq_reminder_prompt';
/** Long enough to read the call's headline, short enough to catch people before they leave Tonight. */
export const REMINDER_SHEET_DELAY_MS = 4000;

export interface ReminderPrompt {
  visible: boolean;
  /** Minutes before puck drop the reminder comes (the user's setting). */
  minutesBefore: number;
  /** Asks for notification permission; true when reminders ended up on. */
  accept: () => Promise<boolean>;
  dismiss: () => void;
}

export function useReminderPrompt({ gameDay, callShown }: { gameDay: boolean; callShown: boolean }): ReminderPrompt {
  const reminders = useReminders();
  const [state, setState] = useState<ReminderPromptState | null>(null);
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

  const eligible = !!state && shouldOfferReminders({
    state,
    remindersOn: reminders.settings.enabled && reminders.permission === 'granted',
    permission: reminders.permission,
    gameDay,
    callShown,
    now: new Date(),
  });
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!eligible) {
      setSettled(false);
      return;
    }
    const timer = setTimeout(() => setSettled(true), REMINDER_SHEET_DELAY_MS);
    return () => clearTimeout(timer);
  }, [eligible]);
  const visible = eligible && settled;

  useEffect(() => {
    if (!visible || viewed.current) return;
    viewed.current = true;
    track('reminder_prompt_view', {});
  }, [visible]);

  const { enable } = reminders;
  const accept = useCallback(async () => {
    track('reminder_prompt_answer', { answer: 'on' });
    return enable({ source: 'tonight_prompt', liveStart: true });
  }, [enable]);

  const dismiss = useCallback(() => {
    if (!state) return;
    track('reminder_prompt_answer', { answer: 'not_now' });
    const next = recordDismissal(state, new Date());
    setState(next);
    AsyncStorage.setItem(REMINDER_PROMPT_KEY, JSON.stringify(next)).catch(() => undefined);
  }, [state]);

  return { visible, minutesBefore: reminders.settings.minutesBefore, accept, dismiss };
}
