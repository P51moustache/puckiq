import { useEffect, useRef } from 'react';

/** Consume a setup navigation request only once the active roster has loaded. */
export function useSetupImport(requested: boolean, ready: boolean, open: () => void, consume: () => void): void {
  const handled = useRef(false);
  useEffect(() => {
    if (!requested) { handled.current = false; return; }
    if (!ready || handled.current) return;
    handled.current = true;
    open();
    consume();
  }, [requested, ready, open, consume]);
}
