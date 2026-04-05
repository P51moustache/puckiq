/**
 * useMyTeamData Hook
 * Owns all state and data fetching for the My Team screen.
 * Loads roster from fantasyRoster, projections from fantasyProjections,
 * and waiver wire recommendations.
 */

import { useEffect, useState, useCallback } from 'react';
import { loadRoster } from '../services/fantasyRoster';
import { getProjectionsForRoster, getWaiverWireRecommendations } from '../services/fantasyProjections';
import type { FantasyRoster, PlayerProjection } from '../types/fantasy';

export interface MyTeamData {
  isLoading: boolean;
  roster: FantasyRoster | null;
  projections: PlayerProjection[];
  waiverPicks: PlayerProjection[];
  hasRoster: boolean;
  onRefresh: () => void;
}

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useMyTeamData(): MyTeamData {
  const [isLoading, setIsLoading] = useState(true);
  const [roster, setRoster] = useState<FantasyRoster | null>(null);
  const [projections, setProjections] = useState<PlayerProjection[]>([]);
  const [waiverPicks, setWaiverPicks] = useState<PlayerProjection[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const savedRoster = await loadRoster();
      setRoster(savedRoster);

      if (!savedRoster || savedRoster.players.length === 0) {
        setProjections([]);
        setWaiverPicks([]);
        return;
      }

      const today = getTodayString();
      const playerIds = savedRoster.players.map(p => p.playerId);
      const format = savedRoster.scoringFormat;

      const [rosterProjections, waiver] = await Promise.all([
        getProjectionsForRoster(playerIds, format, today),
        getWaiverWireRecommendations(playerIds, format, today, 5),
      ]);

      setProjections(rosterProjections);
      setWaiverPicks(waiver);
    } catch (error) {
      console.warn('[MY_TEAM] Error loading data:', error);
      setProjections([]);
      setWaiverPicks([]);
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
    projections,
    waiverPicks,
    hasRoster: roster !== null && roster.players.length > 0,
    onRefresh,
  };
}
