import { useCallback, useEffect, useState } from 'react';
import { loadRoster } from '../services/fantasyRoster';
import { emptyMyWeek, fetchMyWeek } from '../services/myWeek';
import { fetchRosterNews } from '../services/rosterNews';
import { getTonightStatusesForRoster } from '../services/tonightRoster';
import type { FantasyRoster, MyWeek, RosterNewsItem, TonightPlayerStatus } from '../types/fantasy';

export interface TonightRosterData {
  isLoading: boolean;
  roster: FantasyRoster | null;
  hasRoster: boolean;
  date: string | null;
  nextDate?: string;
  statuses: TonightPlayerStatus[];
  week: MyWeek | null;
  news: RosterNewsItem[];
  error: string | null;
  onRefresh: () => void;
}

export function useTonightRoster(): TonightRosterData {
  const [isLoading, setIsLoading] = useState(true);
  const [roster, setRoster] = useState<FantasyRoster | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [nextDate, setNextDate] = useState<string | undefined>(undefined);
  const [statuses, setStatuses] = useState<TonightPlayerStatus[]>([]);
  const [week, setWeek] = useState<MyWeek | null>(null);
  const [news, setNews] = useState<RosterNewsItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const saved = await loadRoster();
      setRoster(saved);
      if (!saved || saved.players.length === 0) {
        setStatuses([]);
        setWeek(null);
        setNews([]);
        setDate(null);
        return;
      }

      const newsItems = await fetchRosterNews(saved.players).catch(() => [] as RosterNewsItem[]);
      setNews(newsItems);

      const [tonight, myWeek] = await Promise.all([
        getTonightStatusesForRoster(saved.players, { news: newsItems }),
        fetchMyWeek(saved.players).catch(() => emptyMyWeek()),
      ]);
      setDate(tonight.date);
      setNextDate(tonight.nextDate);
      setStatuses(tonight.statuses);
      setWeek(myWeek);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tonight');
      setStatuses([]);
      setWeek(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    isLoading,
    roster,
    hasRoster: roster !== null && roster.players.length > 0,
    date,
    nextDate,
    statuses,
    week,
    news,
    error,
    onRefresh: fetchData,
  };
}
