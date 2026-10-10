/**
 * Tonight's "game-night reminder" card: whether to show it, and what its two buttons do.
 * Turning it on also adds the "your night is live" notification, which the card promises.
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

export interface ReminderPrompt {
  visible: boolean;
  /** Asks for notification permission; true when reminders ended up on. */
  accept: () => Promise<boolean>;
  dismiss: () => void;
}

export function useReminderPrompt({ gameDay, guideActive }: { gameDay: boolean; guideActive: boolean }): ReminderPrompt {
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

  const visible = !!state && shouldOfferReminders({
    state,
    remindersOn: reminders.settings.enabled && reminders.permission === 'granted',
    permission: reminders.permission,
    gameDay,
    guideActive,
    now: new Date(),
  });

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

  return { visible, accept, dismiss };
}
