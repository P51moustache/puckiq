/**
 * The quick-pick roster list for onboarding: most-owned players by position, from the
 * same stats pool (and cache key) the Pickups tab loads, so setup and Pickups share one fetch.
 */

import { useMemo } from 'react';
import type { FantasyTeam, NhlSearchPlayer } from '../types/fantasy';
import { loadPickupPool } from '../services/fantasy/loaders';
import { quickPickGroups, type QuickPickGroup } from '../services/fantasy/quickPick';
import { useNhlToday } from './useTeamData';
import { useResource } from './useResource';

export interface QuickPicks {
  groups: Record<QuickPickGroup, NhlSearchPlayer[]> | null;
  loading: boolean;
  error: string | null;
  retry: () => Promise<void>;
}

export function useQuickPicks(team: FantasyTeam | null | undefined, enabled: boolean): QuickPicks {
  const today = useNhlToday();
  const key = team && enabled ? `pool|${today}|${JSON.stringify(team.scoring)}` : null;
  const pool = useResource(key, (force) => loadPickupPool(today, team!.scoring, new Set<number>(), { force }));
  const slots = team?.slots;
  const groups = useMemo(() => (pool.data && slots ? quickPickGroups(pool.data.candidates, slots) : null), [pool.data, slots]);
  return { groups, loading: pool.loading, error: pool.error, retry: pool.refresh };
}
