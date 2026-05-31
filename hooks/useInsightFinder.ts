/**
 * useInsightFinder — loads auto-generated insights from the insight finder,
 * wired to the user's depth + favourites preferences.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearInsightFinderCache, findInsights } from '../services/insightFinder';
import {
  DEFAULT_INSIGHT_PREFERENCES,
  getInsightPreferences,
  saveInsightPreferences,
  type InsightPreferences,
} from '../services/insightPreferences';
import { getFavoriteTeams } from '../services/teamFavorites';
import type { Insight, InsightCategory, InsightDepth } from '../types/insights';

export interface InsightSection {
  key: 'trend' | 'regression' | 'goalie';
  title: string;
  insights: Insight[];
}

const SECTION_META: { key: InsightSection['key']; title: string; categories: InsightCategory[] }[] = [
  { key: 'trend', title: 'Trends', categories: ['trend'] },
  { key: 'regression', title: 'Regression watch', categories: ['regression'] },
  { key: 'goalie', title: 'Goaltending', categories: ['goalie'] },
];

export function useInsightFinder() {
  const [prefs, setPrefs] = useState<InsightPreferences>(DEFAULT_INSIGHT_PREFERENCES);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const load = useCallback(
    async (activePrefs: InsightPreferences, activeFavorites: string[]) => {
      setError(null);
      try {
        const teams = activePrefs.favoritesOnly ? activeFavorites : undefined;
        const result = await findInsights({ depth: activePrefs.depth, teams });
        setInsights(result.insights);
      } catch (err) {
        console.warn('[useInsightFinder] load failed:', err);
        setError('Could not load insights right now.');
        setInsights([]);
      }
    },
    [],
  );

  // Initial load: prefs + favourites, then insights.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loadedPrefs, favTeams] = await Promise.all([getInsightPreferences(), getFavoriteTeams()]);
      const favCodes = favTeams.map((t) => t.triCode);
      if (cancelled) return;
      setPrefs(loadedPrefs);
      setFavorites(favCodes);
      await load(loadedPrefs, favCodes);
      if (!cancelled) {
        setIsLoading(false);
        initialized.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const setDepth = useCallback(
    (depth: InsightDepth) => {
      setPrefs((prev) => {
        if (prev.depth === depth) return prev;
        const next = { ...prev, depth };
        saveInsightPreferences(next);
        setIsLoading(true);
        load(next, favorites).finally(() => setIsLoading(false));
        return next;
      });
    },
    [favorites, load],
  );

  const setFavoritesOnly = useCallback(
    (favoritesOnly: boolean) => {
      setPrefs((prev) => {
        if (prev.favoritesOnly === favoritesOnly) return prev;
        const next = { ...prev, favoritesOnly };
        saveInsightPreferences(next);
        setIsLoading(true);
        load(next, favorites).finally(() => setIsLoading(false));
        return next;
      });
    },
    [favorites, load],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearInsightFinderCache();
    const favTeams = await getFavoriteTeams();
    const favCodes = favTeams.map((t) => t.triCode);
    setFavorites(favCodes);
    await load(prefs, favCodes);
    setRefreshing(false);
  }, [load, prefs]);

  const sections = useMemo<InsightSection[]>(() => {
    return SECTION_META.map((meta) => ({
      key: meta.key,
      title: meta.title,
      insights: insights.filter((i) => meta.categories.includes(i.category)),
    })).filter((s) => s.insights.length > 0);
  }, [insights]);

  return {
    prefs,
    favorites,
    hasFavorites: favorites.length > 0,
    insights,
    sections,
    isLoading,
    refreshing,
    error,
    setDepth,
    setFavoritesOnly,
    onRefresh,
  };
}
