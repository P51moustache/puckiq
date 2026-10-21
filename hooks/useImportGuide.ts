/**
 * The import sheet's guidance (services/rosterImport/importGuide): opens the user's league app to
 * take roster screenshots, notices when PuckIQ comes back to the foreground, and remembers a
 * cancelled pick. The sheet stays open in the meantime, so the user lands back where they left.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { AppState } from 'react-native';
import { INITIAL_GUIDE, nextGuide, type ImportGuide } from '../services/rosterImport/importGuide';
import type { HostLink } from '../services/fantasy/hostLinks';
import { openFantasyHost } from '../services/native/deviceLinks';
import { track } from '../services/analytics/track';

export interface ImportGuideState {
  guide: ImportGuide;
  /** The league app to open, or null when the team's platform has none. */
  host: HostLink | null;
  openHost: () => Promise<void>;
  pickCancelled: () => void;
}

export function useImportGuide(visible: boolean, source: string, host: HostLink | null): ImportGuideState {
  const [guide, dispatch] = useReducer(nextGuide, INITIAL_GUIDE);
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    dispatch('reset');
    leftAt.current = null;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || leftAt.current === null) return;
      track('roster_import_return', { source, away_ms: Math.max(0, Date.now() - leftAt.current) });
      leftAt.current = null;
      dispatch('came_back');
    });
    return () => subscription.remove();
  }, [visible, source]);

  const openHost = useCallback(async () => {
    if (!host) return;
    leftAt.current = Date.now();
    dispatch('left_for_host');
    const result = await openFantasyHost(host, `import_${source}`);
    if (result === 'opened') return;
    // The in-app browser (or the alert) never leaves PuckIQ, so there's no foreground to wait for.
    leftAt.current = null;
    dispatch(result === 'in_app_browser' ? 'came_back' : 'reset');
  }, [host, source]);

  const pickCancelled = useCallback(() => dispatch('pick_cancelled'), []);

  return { guide, host, openHost, pickCancelled };
}
