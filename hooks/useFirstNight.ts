/**
 * The guided first night's progress for Tonight. The reminder step counts as done as soon as
 * reminders are on, however they got turned on.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  completeStep,
  dismissFirstNight,
  isFirstNightActive,
  isFirstNightFinished,
  type FirstNightState,
  type FirstNightStep,
} from '../services/engagement/firstNight';
import { loadFirstNight, saveFirstNight } from '../services/engagement/firstNightStore';
import { track } from '../services/analytics/track';

export interface FirstNight {
  active: boolean;
  done: readonly FirstNightStep[];
  complete: (step: FirstNightStep) => void;
  dismiss: () => void;
}

const NONE: readonly FirstNightStep[] = [];

export function useFirstNight(remindersOn: boolean): FirstNight {
  const [state, setState] = useState<FirstNightState | null>(null);
  const current = useRef<FirstNightState | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadFirstNight().then((saved) => {
      if (cancelled) return;
      current.current = saved;
      setState(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const commit = useCallback((next: FirstNightState) => {
    current.current = next;
    setState(next);
    saveFirstNight(next).catch(() => undefined);
  }, []);

  const complete = useCallback((step: FirstNightStep) => {
    const before = current.current;
    if (!before || before.done.includes(step) || !isFirstNightActive(before, new Date())) return;
    const next = completeStep(before, step);
    commit(next);
    track('first_night_step', { step });
    if (isFirstNightFinished(next)) track('first_night_done', {});
  }, [commit]);

  const dismiss = useCallback(() => {
    const before = current.current;
    if (!before || before.dismissed) return;
    track('first_night_dismiss', { done: before.done.length });
    commit(dismissFirstNight(before));
  }, [commit]);

  useEffect(() => {
    if (remindersOn && state) complete('reminder');
  }, [remindersOn, state, complete]);

  return {
    active: isFirstNightActive(state, new Date()),
    done: state?.done ?? NONE,
    complete,
    dismiss,
  };
}
