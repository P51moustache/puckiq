/**
 * Tonight's game-night reminder sheet: whether to show it, and what its two buttons do.
 * It waits a moment after the lineup call (or recap) is on screen, so the ask follows something
 * useful, and only counts time while Tonight is focused and the app is in front.
 * Turning it on also adds the "your night is live" notification.
 * When a visit ends without the sheet, `reminder_prompt_skipped` says which rule kept it away.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
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
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!eligible || !onScreen) {
      setSettled(false);
      return;
    }
    const timer = setTimeout(() => setSettled(true), REMINDER_SHEET_DELAY_MS);
    return () => clearTimeout(timer);
  }, [eligible, onScreen]);
  const visible = eligible && onScreen && settled;

  useEffect(() => {
    if (!visible || viewed.current) return;
    viewed.current = true;
    track('reminder_prompt_view', { moment });
  }, [visible, moment]);

  useSkipLog({ onScreen, ready: !!state, skip: block ?? (eligible && !settled ? 'left_early' : null), moment, visible });

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

/** Tonight is the focused tab and the app is in the foreground. */
function useOnScreen(): boolean {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const listener = AppState.addEventListener('change', (next) => setActive(next === 'active'));
    return () => listener.remove();
  }, []);
  return focused && active;
}

/**
 * One `reminder_prompt_skipped` per visit that ends (blur, background or unmount) without the
 * sheet, carrying the rule in force at that moment. Each reason is logged at most once a day,
 * so people who already have reminders on don't send it on every visit.
 */
function useSkipLog({ onScreen, ready, skip, moment, visible }: {
  onScreen: boolean;
  ready: boolean;
  skip: ReminderSkip | null;
  moment: ReminderMoment | null;
  visible: boolean;
}): void {
  const latest = useRef({ ready, skip, moment });
  latest.current = { ready, skip, moment };
  const logged = useRef(new Set<string>());
  const visiting = useRef(false);
  const shown = useRef(false);
  if (visible) shown.current = true;

  const endVisit = useCallback(() => {
    if (!visiting.current) return;
    visiting.current = false;
    const { ready: loaded, skip: reason, moment: at } = latest.current;
    const wasShown = shown.current;
    shown.current = false;
    if (!loaded || !reason || wasShown) return;
    const key = `${new Date().toISOString().slice(0, 10)}:${reason}`;
    if (logged.current.has(key)) return;
    logged.current.add(key);
    track('reminder_prompt_skipped', { reason, moment: at });
  }, []);

  useEffect(() => {
    if (onScreen) {
      visiting.current = true;
      shown.current = visible;
    } else {
      endVisit();
    }
    // Only a change of screen starts or ends a visit; `visible` is read as it was at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onScreen, endVisit]);
  useEffect(() => endVisit, [endVisit]);
}
