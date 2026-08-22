import { useCallback, useEffect, useState } from 'react';
import { loadRoster } from '../services/fantasyRoster';
import { fetchRosterNews } from '../services/rosterNews';
import type { FantasyRoster, RosterNewsItem } from '../types/fantasy';

export function useRosterNews() {
  const [isLoading, setIsLoading] = useState(true);
  const [roster, setRoster] = useState<FantasyRoster | null>(null);
  const [items, setItems] = useState<RosterNewsItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const saved = await loadRoster();
      setRoster(saved);
      if (!saved || saved.players.length === 0) {
        setItems([]);
        return;
      }
      setItems(await fetchRosterNews(saved.players));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news');
      setItems([]);
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
    items,
    error,
    onRefresh: fetchData,
  };
}
