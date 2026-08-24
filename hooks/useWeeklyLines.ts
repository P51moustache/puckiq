/**
 * Loads the one roster plus this week's lines (local only).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadRoster } from '../services/fantasyRoster';
import {
  assignPlayer,
  canCopyLastWeek,
  copyPreviousWeek,
  groupForPlayer,
  loadAndRollLines,
  persistLines,
} from '../services/weeklyLines';
import type { FantasyRoster } from '../types/fantasy';
import type { LineGroup, LinesStore } from '../types/lines';

export interface WeeklyLinesData {
  isLoading: boolean;
  roster: FantasyRoster | null;
  hasRoster: boolean;
  store: LinesStore | null;
  weekLabel: string;
  canCopyLastWeek: boolean;
  error: string | null;
  groupOf: (playerId: number) => LineGroup;
  assign: (playerId: number, group: LineGroup) => Promise<void>;
  copyLastWeek: () => Promise<void>;
  onRefresh: () => void;
}

export function useWeeklyLines(): WeeklyLinesData {
  const [isLoading, setIsLoading] = useState(true);
  const [roster, setRoster] = useState<FantasyRoster | null>(null);
  const [store, setStore] = useState<LinesStore | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [savedRoster, lines] = await Promise.all([loadRoster(), loadAndRollLines()]);
      setRoster(savedRoster);
      setStore(lines);
      setError(null);
    } catch (err) {
      console.warn('[WEEKLY_LINES] Error loading this week:', err);
      setError('Could not load this week’s lines.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const assign = useCallback(
    async (playerId: number, group: LineGroup) => {
      if (!store) return;
      const next = assignPlayer(store, playerId, group);
      setStore(next);
      try {
        await persistLines(next);
        setError(null);
      } catch {
        setError('Could not save that assignment.');
      }
    },
    [store],
  );

  const copyLastWeek = useCallback(async () => {
    if (!store || !roster) return;
    const next = copyPreviousWeek(
      store,
      roster.players.map((player) => player.playerId),
    );
    setStore(next);
    try {
      await persistLines(next);
      setError(null);
    } catch {
      setError('Could not copy last week.');
    }
  }, [store, roster]);

  const groupOf = useCallback(
    (playerId: number): LineGroup => groupForPlayer(store?.current.assignments ?? [], playerId),
    [store],
  );

  const hasRoster = roster !== null && roster.players.length > 0;

  return {
    isLoading,
    roster,
    hasRoster,
    store,
    weekLabel: store?.current.label ?? '',
    canCopyLastWeek: canCopyLastWeek(store),
    error,
    groupOf,
    assign,
    copyLastWeek,
    onRefresh: fetchData,
  };
}

export function useGroupedRosterPlayers(
  roster: FantasyRoster | null,
  groupOf: (playerId: number) => LineGroup,
) {
  return useMemo(() => {
    const players = roster?.players ?? [];
    return {
      F: players.filter((player) => groupOf(player.playerId) === 'F'),
      D: players.filter((player) => groupOf(player.playerId) === 'D'),
      G: players.filter((player) => groupOf(player.playerId) === 'G'),
      bench: players.filter((player) => groupOf(player.playerId) === 'bench'),
    };
  }, [roster, groupOf]);
}
