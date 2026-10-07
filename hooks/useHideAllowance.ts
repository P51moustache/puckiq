/**
 * This week's free "Already taken" count, kept in AsyncStorage per NHL week (Monday key).
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { canHidePickup, hideAllowanceKey, parseHideCount } from '../services/fantasy/freeHides';
import { mondayOf } from '../services/nhl/dates';
import { useNhlToday } from './useCoach';

export function useHideAllowance(isPro: boolean): { allowed: boolean; record: () => void } {
  const monday = mondayOf(useNhlToday());
  const key = hideAllowanceKey(monday);
  const [used, setUsed] = useState(0);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (alive) setUsed(parseHideCount(raw));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [key]);

  const record = useCallback(() => {
    if (isPro) return;
    setUsed((count) => {
      const next = count + 1;
      AsyncStorage.setItem(key, String(next)).catch(() => undefined);
      return next;
    });
  }, [isPro, key]);

  return { allowed: canHidePickup(isPro, used), record };
}
