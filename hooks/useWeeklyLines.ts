/**
 * Loads the one roster plus this week's lines, NHL next-game, week slate, and pair locks.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addNhlSearchPlayer, loadRoster } from '../services/fantasyRoster';
import { emptyMyWeek, fetchMyWeek } from '../services/myWeek';
import { fetchRosterNews } from '../services/rosterNews';
import { buildTonightHeadline, type TonightHeadline } from '../services/tonightHeadline';
import { getTonightStatusesForRoster } from '../services/tonightRoster';
import {
  assignPlayer,
  brokenDoNotPairs,
  canCopyLastWeek,
  cannotStart,
  copyPreviousWeek,
  groupForPlayer,
  loadAndRollLines,
  persistLines,
  toggleDoNotPair,
} from '../services/weeklyLines';
import type { FantasyRoster, MyWeek, NhlSearchPlayer, TonightPlayerStatus } from '../types/fantasy';
import type { LineGroup, LinesStore } from '../types/lines';

export interface WeeklyLinesData {
  isLoading: boolean;
  roster: FantasyRoster | null;
  hasRoster: boolean;
  store: LinesStore | null;
  weekLabel: string;
  canCopyLastWeek: boolean;
  error: string | null;
  statuses: Record<number, TonightPlayerStatus>;
  headline: TonightHeadline | null;
  week: MyWeek | null;
  slateDate: string | null;
  brokenPairs: ReturnType<typeof brokenDoNotPairs>;
  pairingFrom: number | null;
  groupOf: (playerId: number) => LineGroup;
  assign: (playerId: number, group: LineGroup) => Promise<void>;
  addNhlPlayer: (hit: NhlSearchPlayer, group: LineGroup) => Promise<void>;
  addName: (name: string, group: LineGroup) => Promise<void>;
  copyLastWeek: () => Promise<void>;
  beginPair: (playerId: number) => void;
  onRefresh: () => void;
}

export function useWeeklyLines(): WeeklyLinesData {
  const [isLoading, setIsLoading] = useState(true);
  const [roster, setRoster] = useState<FantasyRoster | null>(null);
  const [store, setStore] = useState<LinesStore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<number, TonightPlayerStatus>>({});
  const [week, setWeek] = useState<MyWeek | null>(null);
  const [slateDate, setSlateDate] = useState<string | null>(null);
  const [pairingFrom, setPairingFrom] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [savedRoster, lines] = await Promise.all([loadRoster(), loadAndRollLines()]);
      setRoster(savedRoster);
      setStore(lines);
      setError(null);
      if (savedRoster?.players.length) {
        try {
          const news = await fetchRosterNews(savedRoster.players).catch(() => []);
          const [tonight, myWeek] = await Promise.all([
            getTonightStatusesForRoster(savedRoster.players, { news }),
            fetchMyWeek(savedRoster.players).catch(() => emptyMyWeek()),
          ]);
          const next: Record<number, TonightPlayerStatus> = {};
          for (const row of tonight.statuses) next[row.playerId] = row;
          setStatuses(next);
          setWeek(myWeek);
          setSlateDate(tonight.date);
        } catch {
          setStatuses({});
          setWeek(null);
          setSlateDate(null);
        }
      } else {
        setStatuses({});
        setWeek(null);
        setSlateDate(null);
      }
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

  const groupOf = useCallback(
    (playerId: number): LineGroup => groupForPlayer(store?.current.assignments ?? [], playerId),
    [store],
  );

  const assign = useCallback(
    async (playerId: number, group: LineGroup) => {
      if (!store) return;
      if (group !== 'bench' && cannotStart(statuses[playerId]?.injurySignal)) {
        setError('OUT / scratch cannot start. Leave them on the bench.');
        return;
      }
      const next = assignPlayer(store, playerId, group);
      setStore(next);
      try {
        await persistLines(next);
        setError(null);
      } catch {
        setError('Could not save that assignment.');
      }
    },
    [store, statuses],
  );

  const addNhlPlayer = useCallback(
    async (hit: NhlSearchPlayer, group: LineGroup) => {
      if (!store) return;
      try {
        const { roster: nextRoster, player } = await addNhlSearchPlayer(hit);
        const next = assignPlayer(store, player.playerId, group);
        setRoster(nextRoster);
        setStore(next);
        await persistLines(next);
        setError(null);
        try {
          const news = await fetchRosterNews(nextRoster.players).catch(() => []);
          const [tonight, myWeek] = await Promise.all([
            getTonightStatusesForRoster(nextRoster.players, { news }),
            fetchMyWeek(nextRoster.players).catch(() => emptyMyWeek()),
          ]);
          const map: Record<number, TonightPlayerStatus> = {};
          for (const row of tonight.statuses) map[row.playerId] = row;
          setStatuses(map);
          setWeek(myWeek);
          setSlateDate(tonight.date);
        } catch {
          /* next-game is additive */
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        setError(message.includes('already') ? message : 'Could not add that player.');
      }
    },
    [store],
  );

  const addName = useCallback(async (_name: string, _group: LineGroup) => {
    setError('Search the NHL list — typed names without a player ID are not added.');
  }, []);

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

  const beginPair = useCallback(
    async (playerId: number) => {
      if (!store) return;
      if (pairingFrom == null) {
        setPairingFrom(playerId);
        return;
      }
      const next = toggleDoNotPair(store, pairingFrom, playerId);
      setStore(next);
      setPairingFrom(null);
      try {
        await persistLines(next);
      } catch {
        setError('Could not save the pair lock.');
      }
    },
    [store, pairingFrom],
  );

  const hasRoster = roster !== null && roster.players.length > 0;
  const brokenPairs = useMemo(() => brokenDoNotPairs(store, groupOf), [store, groupOf]);
  const headline = useMemo(
    () => (hasRoster ? buildTonightHeadline(Object.values(statuses)) : null),
    [hasRoster, statuses],
  );

  return {
    isLoading,
    roster,
    hasRoster,
    store,
    weekLabel: store?.current.label ?? '',
    canCopyLastWeek: canCopyLastWeek(store),
    error,
    statuses,
    headline,
    week,
    slateDate,
    brokenPairs,
    pairingFrom,
    groupOf,
    assign,
    addNhlPlayer,
    addName,
    copyLastWeek,
    beginPair,
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
