import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { track } from '../services/analytics/track';
import type { UsageProperties } from '../services/analytics/usageJourney';

/** Availability on a focused foreground screen, NOT viewport exposure or proof of reading. */
export function useBehaviorSnapshot(surface: string, properties: UsageProperties | null): void {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const last = useRef<string | null>(null);
  const loadingSince = useRef<number | null>(null);
  const serialized = properties ? JSON.stringify(properties) : null;
  useEffect(() => {
    const listener = AppState.addEventListener('change', (next) => setActive(next === 'active'));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    const state = serialized ? JSON.parse(serialized).state as string : null;
    if (!focused || !active || !state) {
      if (loadingSince.current !== null) track('advice_load_result', { surface, result: 'left_loading', wait_ms: Math.max(0, Date.now() - loadingSince.current) });
      loadingSince.current = null;
    } else if (state === 'loading') {
      loadingSince.current ??= Date.now();
    } else if (loadingSince.current !== null) {
      track('advice_load_result', { surface, result: state, wait_ms: Math.max(0, Date.now() - loadingSince.current) });
      loadingSince.current = null;
    }
    if (!focused || !active) { last.current = null; return; }
    if (!serialized || last.current === serialized) return;
    last.current = serialized;
    track('advice_state', { surface, ...JSON.parse(serialized) });
  }, [active, focused, serialized, surface]);
  useEffect(() => () => {
    if (loadingSince.current !== null) track('advice_load_result', { surface, result: 'left_loading', wait_ms: Math.max(0, Date.now() - loadingSince.current) });
    loadingSince.current = null;
  }, [surface]);
}
