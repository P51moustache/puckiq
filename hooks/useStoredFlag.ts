/**
 * A boolean preference in AsyncStorage. Reads once, writes on change, never throws — the
 * default stands in until storage answers (or if it can't).
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useStoredFlag(key: string, fallback: boolean): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (alive && (raw === 'true' || raw === 'false')) setValue(raw === 'true');
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [key]);
  const update = useCallback((next: boolean) => {
    setValue(next);
    AsyncStorage.setItem(key, String(next)).catch(() => undefined);
  }, [key]);
  return [value, update];
}
