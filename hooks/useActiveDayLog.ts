/** Adds each foreground stretch to today's time in the app, for the days-of-real-use count. */

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { logForegroundTime } from '../services/engagement/activeDaysStore';

export function useActiveDayLog(): void {
  useEffect(() => {
    let since: number | null = AppState.currentState === 'active' ? Date.now() : null;
    const close = () => {
      if (since === null) return;
      void logForegroundTime(Date.now() - since);
      since = null;
    };
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') since ??= Date.now();
      else close();
    });
    return () => {
      listener.remove();
      close();
    };
  }, []);
}
