/**
 * The "Pro is on" welcome on Tonight after a purchase: whether it shows, and what its buttons do.
 * The paywall leaves a record when a purchase goes through (services/engagement/trialWelcomeStore);
 * the next Tonight visit with the night loaded greets it once, and the accept button turns on
 * game-night reminders and goal & scratch alerts in one tap. services/engagement/trialWelcome
 * holds the rules; components/tonight/TrialWelcomeSheet draws it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAlerts } from '../components/AlertsProvider';
import { useReminders } from '../components/RemindersProvider';
import { useSubscription } from '../components/SubscriptionProvider';
import type { CoachMove } from '../services/fantasy/coach';
import { trialLine, welcomeDue, type TrialWelcomeRecord } from '../services/engagement/trialWelcome';
import { clearTrialWelcome, loadTrialWelcome } from '../services/engagement/trialWelcomeStore';
import { track } from '../services/analytics/track';
import { useOnScreen, useSettled } from './usePromptVisit';

/** Lets the App Store sheet and the paywall finish closing before the welcome slides up. */
export const TRIAL_WELCOME_DELAY_MS = 600;

export interface TrialWelcome {
  visible: boolean;
  /** Due or shown during this visit: Tonight's other asks hold off. */
  holding: boolean;
  /** The first move Pro unlocked tonight, or null. */
  move: CoachMove | null;
  trialLine: string | null;
  /** Reminders and alerts are both on already, so the sheet only greets. */
  notificationsOn: boolean;
  /** Turns on reminders and alerts (asking permission once), then closes. */
  accept: () => Promise<void>;
  dismiss: () => void;
}

export function useTrialWelcome({ move, ready }: { move: CoachMove | null; ready: boolean }): TrialWelcome {
  const { status } = useSubscription();
  const reminders = useReminders();
  const alerts = useAlerts();
  const onScreen = useOnScreen();
  const [record, setRecord] = useState<TrialWelcomeRecord | null>(null);
  const shown = useRef(false);

  // Re-read when Pro switches on (the purchase that left the record) and on each return to the screen.
  useEffect(() => {
    if (!status.isPro || !onScreen) return;
    let cancelled = false;
    loadTrialWelcome().then((next) => {
      if (!cancelled) setRecord(next);
    });
    return () => {
      cancelled = true;
    };
  }, [status.isPro, onScreen]);

  const due = status.isPro && welcomeDue(record, new Date());
  const eligible = due && ready;
  const settled = useSettled(eligible, onScreen, TRIAL_WELCOME_DELAY_MS);
  const visible = eligible && onScreen && settled;
  const notificationsOn = reminders.settings.enabled && reminders.permission === 'granted' && alerts.settings.enabled;

  useEffect(() => {
    if (!visible || shown.current) return;
    shown.current = true;
    track('trial_welcome_view', { move_kind: move?.kind ?? 'none', notifications_on: notificationsOn });
  }, [visible, move, notificationsOn]);

  const close = useCallback(() => {
    setRecord(null);
    void clearTrialWelcome();
  }, []);

  const { enable: enableReminders } = reminders;
  const { enable: enableAlerts } = alerts;
  const alertsOn = alerts.settings.enabled;
  const accept = useCallback(async () => {
    track('trial_welcome_answer', { answer: notificationsOn ? 'done' : 'on' });
    if (!notificationsOn) {
      const granted = await enableReminders({ source: 'trial_welcome', liveStart: true });
      if (granted && !alertsOn) await enableAlerts();
    }
    close();
  }, [notificationsOn, enableReminders, enableAlerts, alertsOn, close]);

  const dismiss = useCallback(() => {
    track('trial_welcome_answer', { answer: 'not_now' });
    close();
  }, [close]);

  return {
    visible,
    holding: due || shown.current,
    move,
    trialLine: record ? trialLine(status, record.renewal) : null,
    notificationsOn,
    accept,
    dismiss,
  };
}
