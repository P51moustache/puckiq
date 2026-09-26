/**
 * Minimal async resource hook: load when the key changes, pull-to-refresh with force,
 * ignore results from a key the screen has already moved past.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Resource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

export function useResource<T>(key: string | null, load: (force: boolean) => Promise<T>): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(key !== null);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(async (force: boolean) => {
    if (key === null) {
      setData(null);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    try {
      const result = await loadRef.current(force);
      if (id !== requestId.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [key]);

  useEffect(() => {
    setLoading(key !== null);
    run(false);
  }, [key, run]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await run(true);
  }, [run]);

  return { data, error, loading, refreshing, refresh };
}
