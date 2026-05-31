/**
 * Insight Finder user preferences — persisted to AsyncStorage.
 * Controls how deep the auto insight finder goes (simple → advanced) and
 * whether the feed is scoped to the user's favourite teams.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InsightDepth } from '../types/insights';

const STORAGE_KEY = 'puckiq_insight_prefs';

export interface InsightPreferences {
  /** 1 = Simple, 2 = Standard, 3 = Advanced. */
  depth: InsightDepth;
  /** When true, only surface insights for favourited teams. */
  favoritesOnly: boolean;
}

export const DEFAULT_INSIGHT_PREFERENCES: InsightPreferences = {
  depth: 2,
  favoritesOnly: false,
};

function normalize(raw: unknown): InsightPreferences {
  const obj = (raw ?? {}) as Partial<InsightPreferences>;
  const depth: InsightDepth =
    obj.depth === 1 || obj.depth === 2 || obj.depth === 3 ? obj.depth : DEFAULT_INSIGHT_PREFERENCES.depth;
  return {
    depth,
    favoritesOnly: obj.favoritesOnly === true,
  };
}

export async function getInsightPreferences(): Promise<InsightPreferences> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? normalize(JSON.parse(json)) : { ...DEFAULT_INSIGHT_PREFERENCES };
  } catch (error) {
    console.warn('[INSIGHT PREFS] load failed:', error);
    return { ...DEFAULT_INSIGHT_PREFERENCES };
  }
}

export async function saveInsightPreferences(prefs: InsightPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(prefs)));
  } catch (error) {
    console.warn('[INSIGHT PREFS] save failed:', error);
  }
}
