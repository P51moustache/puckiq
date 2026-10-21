/**
 * Shared timing for Tonight's bottom-sheet asks (game-night reminders, the review ask): whether
 * the screen is really in front, the short wait before a sheet appears, and one "skipped" event
 * per visit that ends without the sheet.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { track } from '../services/analytics/track';

/** The screen is the focused tab and the app is in the foreground. */
export function useOnScreen(): boolean {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const listener = AppState.addEventListener('change', (next) => setActive(next === 'active'));
    return () => listener.remove();
  }, []);
  return focused && active;
}

/** True once `eligible` and `onScreen` have both held for `delayMs` without a break. */
export function useSettled(eligible: boolean, onScreen: boolean, delayMs: number): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!eligible || !onScreen) {
      setSettled(false);
      return;
    }
    const timer = setTimeout(() => setSettled(true), delayMs);
    return () => clearTimeout(timer);
  }, [eligible, onScreen, delayMs]);
  return settled;
}

/**
 * One `event` per visit that ends (blur, background or unmount) without the sheet, carrying the
 * rule in force at that moment as `reason`. Each reason is logged at most once a day, so people
 * a rule always holds for don't send it on every visit.
 */
export function useSkipLog({ event, onScreen, ready, skip, moment, visible }: {
  event: string;
  onScreen: boolean;
  ready: boolean;
  skip: string | null;
  moment: string | null;
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
    track(event, { reason, moment: at });
  }, [event]);

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
