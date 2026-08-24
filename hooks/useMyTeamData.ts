/**
 * Loads the one saved roster. Lines and Roster both use this list.
 */

import { useEffect, useState, useCallback } from 'react';
import { loadRoster } from '../services/fantasyRoster';
import type { FantasyRoster, PlayerProjection } from '../types/fantasy';

export interface MyTeamData {
  isLoading: boolean;
  roster: FantasyRoster | null;
  projections: PlayerProjection[];
  waiverPicks: PlayerProjection[];
  hasRoster: boolean;
  onRefresh: () => void;
}

export function useMyTeamData(): MyTeamData {
  const [isLoading, setIsLoading] = useState(true);
  const [roster, setRoster] = useState<FantasyRoster | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const savedRoster = await loadRoster();
      setRoster(savedRoster);
    } catch (error) {
      console.warn('[MY_TEAM] Error loading roster:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    isLoading,
    roster,
    projections: [],
    waiverPicks: [],
    hasRoster: roster !== null && roster.players.length > 0,
    onRefresh,
  };
}
