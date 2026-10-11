/** Async data belongs to its key; stale requests never update a different or disabled resource. */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface Resource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
}
interface Snapshot<T> {
  key: string | null;
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
}

export function useResource<T>(key: string | null, load: (force: boolean) => Promise<T>): Resource<T> {
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({
    key, data: null, error: null, loading: key !== null, refreshing: false,
  });
  const requestId = useRef(0);
  const keyRef = useRef(key);
  const loadRef = useRef(load);
  keyRef.current = key;
  loadRef.current = load;

  const run = useCallback(async (force: boolean) => {
    if (key === null || keyRef.current !== key) return;
    const id = ++requestId.current;
    setSnapshot((previous) => {
      const same = previous.key === key;
      return {
        key, data: same ? previous.data : null, error: same ? previous.error : null,
        loading: !force || !same || previous.data === null, refreshing: force,
      };
    });
    const current = () => id === requestId.current && keyRef.current === key;
    try {
      const data = await loadRef.current(force);
      if (current()) setSnapshot({ key, data, error: null, loading: false, refreshing: false });
    } catch (error) {
      if (current()) setSnapshot((previous) => ({
        ...previous, error: error instanceof Error ? error.message : 'Something went wrong',
        loading: false, refreshing: false,
      }));
    }
  }, [key]);

  useEffect(() => {
    if (key === null) setSnapshot({ key, data: null, error: null, loading: false, refreshing: false });
    else void run(false);
    return () => { requestId.current += 1; };
  }, [key, run]);
  const refresh = useCallback(() => run(true), [run]);
  // Hide the previous key's result immediately, before the effect starts the next request.
  const visible = key !== null && snapshot.key === key;
  return {
    data: visible ? snapshot.data : null,
    error: visible ? snapshot.error : null,
    loading: key !== null && (!visible || snapshot.loading),
    refreshing: visible && snapshot.refreshing,
    refresh,
  };
}
