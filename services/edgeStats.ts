/**
 * NHL Edge IQ API Client
 * Supabase-first with NHL API fallback.
 * Centralized service for fetching Edge tracking data with 5-minute in-memory cache.
 * All functions return null on error — Edge data is optional.
 */

import type {
  SkaterEdgeDetail,
  TeamEdgeDetail,
  GoalieEdgeDetail,
  EdgeByTheNumbers,
  EdgeSkaterLanding,
  EdgeGoalieLanding,
  EdgeTeamLanding,
  TeamZoneTimeDetails,
} from '../types/edgeStats';
import { supabase } from '../lib/supabase';

const EDGE_BASE_URL = 'https://api-web.nhle.com/v1/edge';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CURRENT_SEASON = 20252026;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// NHL API fallback fetch (original implementation)
async function fetchEdgeFromAPI<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${EDGE_BASE_URL}${path}`);
    if (!response.ok) {
      console.warn(`[EdgeStats] NHL API ${path} returned ${response.status}`);
      return null;
    }
    return await response.json() as T;
  } catch (error) {
    console.error(`[EdgeStats] NHL API fallback failed for ${path}:`, error);
    return null;
  }
}

// ============================================
// Supabase helpers
// ============================================

async function fetchLeaderboardFromSupabase<T>(category: string): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from('edge_leaderboards')
      .select('data')
      .eq('category', category)
      .eq('subcategory', '__landing__')
      .eq('season', CURRENT_SEASON)
      .single();

    if (error || !data) return null;
    return data.data as T;
  } catch {
    return null;
  }
}

async function fetchDetailFromSupabase<T>(
  entityType: string,
  entityId: number,
  endpointName?: string,
): Promise<T | null> {
  try {
    let query = supabase
      .from('edge_detailed_stats')
      .select('data')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('season', CURRENT_SEASON);

    if (endpointName) {
      query = query.eq('endpoint_name', endpointName);
    }

    const { data, error } = await query.limit(1).single();

    if (error || !data) return null;
    return data.data as T;
  } catch {
    return null;
  }
}

// ============================================
// Landing / Overview Endpoints (on mount)
// ============================================

export async function fetchEdgeSkaterLanding(): Promise<EdgeSkaterLanding | null> {
  const cacheKey = 'skater-landing';
  const cached = getCached<EdgeSkaterLanding>(cacheKey);
  if (cached) return cached;

  // Supabase first
  const sbData = await fetchLeaderboardFromSupabase<EdgeSkaterLanding>('skater-landing');
  if (sbData) {
    setCache(cacheKey, sbData);
    return sbData;
  }

  // NHL API fallback
  const apiData = await fetchEdgeFromAPI<EdgeSkaterLanding>('/skater-landing/now');
  if (apiData) setCache(cacheKey, apiData);
  return apiData;
}

export async function fetchEdgeGoalieLanding(): Promise<EdgeGoalieLanding | null> {
  const cacheKey = 'goalie-landing';
  const cached = getCached<EdgeGoalieLanding>(cacheKey);
  if (cached) return cached;

  const sbData = await fetchLeaderboardFromSupabase<EdgeGoalieLanding>('goalie-landing');
  if (sbData) {
    setCache(cacheKey, sbData);
    return sbData;
  }

  const apiData = await fetchEdgeFromAPI<EdgeGoalieLanding>('/goalie-landing/now');
  if (apiData) setCache(cacheKey, apiData);
  return apiData;
}

export async function fetchEdgeTeamLanding(): Promise<EdgeTeamLanding | null> {
  const cacheKey = 'team-landing';
  const cached = getCached<EdgeTeamLanding>(cacheKey);
  if (cached) return cached;

  const sbData = await fetchLeaderboardFromSupabase<EdgeTeamLanding>('team-landing');
  if (sbData) {
    setCache(cacheKey, sbData);
    return sbData;
  }

  const apiData = await fetchEdgeFromAPI<EdgeTeamLanding>('/team-landing/now');
  if (apiData) setCache(cacheKey, apiData);
  return apiData;
}

export async function fetchEdgeByTheNumbers(): Promise<EdgeByTheNumbers | null> {
  const cacheKey = 'by-the-numbers';
  const cached = getCached<EdgeByTheNumbers>(cacheKey);
  if (cached) return cached;

  const sbData = await fetchLeaderboardFromSupabase<EdgeByTheNumbers>('by-the-numbers');
  if (sbData) {
    setCache(cacheKey, sbData);
    return sbData;
  }

  const apiData = await fetchEdgeFromAPI<EdgeByTheNumbers>('/by-the-numbers/now');
  if (apiData) setCache(cacheKey, apiData);
  return apiData;
}

// ============================================
// Detail Endpoints (on demand)
// ============================================

export async function fetchSkaterEdge(playerId: number): Promise<SkaterEdgeDetail | null> {
  const cacheKey = `skater-${playerId}`;
  const cached = getCached<SkaterEdgeDetail>(cacheKey);
  if (cached) return cached;

  const sbData = await fetchDetailFromSupabase<SkaterEdgeDetail>('skater', playerId);
  if (sbData) {
    setCache(cacheKey, sbData);
    return sbData;
  }

  const apiData = await fetchEdgeFromAPI<SkaterEdgeDetail>(`/skater-detail/${playerId}/now`);
  if (apiData) setCache(cacheKey, apiData);
  return apiData;
}

export async function fetchTeamEdge(teamId: number): Promise<TeamEdgeDetail | null> {
  const cacheKey = `team-${teamId}`;
  const cached = getCached<TeamEdgeDetail>(cacheKey);
  if (cached) return cached;

  const sbData = await fetchDetailFromSupabase<TeamEdgeDetail>('team', teamId);
  if (sbData) {
    setCache(cacheKey, sbData);
    return sbData;
  }

  const apiData = await fetchEdgeFromAPI<TeamEdgeDetail>(`/team-detail/${teamId}/now`);
  if (apiData) setCache(cacheKey, apiData);
  return apiData;
}

export async function fetchGoalieEdge(playerId: number): Promise<GoalieEdgeDetail | null> {
  const cacheKey = `goalie-${playerId}`;
  const cached = getCached<GoalieEdgeDetail>(cacheKey);
  if (cached) return cached;

  const sbData = await fetchDetailFromSupabase<GoalieEdgeDetail>('goalie', playerId);
  if (sbData) {
    setCache(cacheKey, sbData);
    return sbData;
  }

  const apiData = await fetchEdgeFromAPI<GoalieEdgeDetail>(`/goalie-detail/${playerId}/now`);
  if (apiData) setCache(cacheKey, apiData);
  return apiData;
}

export async function fetchTeamZoneTime(teamId: number): Promise<TeamZoneTimeDetails | null> {
  const cacheKey = `zone-time-${teamId}`;
  const cached = getCached<TeamZoneTimeDetails>(cacheKey);
  if (cached) return cached;

  const sbData = await fetchDetailFromSupabase<TeamZoneTimeDetails>(
    'team', teamId, 'team-zone-time-details'
  );
  if (sbData) {
    setCache(cacheKey, sbData);
    return sbData;
  }

  const apiData = await fetchEdgeFromAPI<TeamZoneTimeDetails>(`/team-zone-time-details/${teamId}/now`);
  if (apiData) setCache(cacheKey, apiData);
  return apiData;
}

// ============================================
// Cache Management
// ============================================

export function clearEdgeCache(): void {
  cache.clear();
}

/** Visible for testing */
export const _internals = {
  cache,
  CACHE_TTL_MS,
  getCached,
  setCache,
};
