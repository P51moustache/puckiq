/**
 * NHL Edge IQ API Client
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

const EDGE_BASE_URL = 'https://api-web.nhle.com/v1/edge';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

async function fetchEdge<T>(path: string, cacheKey: string): Promise<T | null> {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${EDGE_BASE_URL}${path}`);
    if (!response.ok) {
      console.warn(`[EdgeStats] ${path} returned ${response.status}`);
      return null;
    }
    const data: T = await response.json();
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error(`[EdgeStats] Failed to fetch ${path}:`, error);
    return null;
  }
}

// ============================================
// Landing / Overview Endpoints (on mount)
// ============================================

export async function fetchEdgeSkaterLanding(): Promise<EdgeSkaterLanding | null> {
  return fetchEdge<EdgeSkaterLanding>('/skater-landing/now', 'skater-landing');
}

export async function fetchEdgeGoalieLanding(): Promise<EdgeGoalieLanding | null> {
  return fetchEdge<EdgeGoalieLanding>('/goalie-landing/now', 'goalie-landing');
}

export async function fetchEdgeTeamLanding(): Promise<EdgeTeamLanding | null> {
  return fetchEdge<EdgeTeamLanding>('/team-landing/now', 'team-landing');
}

export async function fetchEdgeByTheNumbers(): Promise<EdgeByTheNumbers | null> {
  return fetchEdge<EdgeByTheNumbers>('/by-the-numbers/now', 'by-the-numbers');
}

// ============================================
// Detail Endpoints (on demand)
// ============================================

export async function fetchSkaterEdge(playerId: number): Promise<SkaterEdgeDetail | null> {
  return fetchEdge<SkaterEdgeDetail>(
    `/skater-detail/${playerId}/now`,
    `skater-${playerId}`
  );
}

export async function fetchTeamEdge(teamId: number): Promise<TeamEdgeDetail | null> {
  return fetchEdge<TeamEdgeDetail>(
    `/team-detail/${teamId}/now`,
    `team-${teamId}`
  );
}

export async function fetchGoalieEdge(playerId: number): Promise<GoalieEdgeDetail | null> {
  return fetchEdge<GoalieEdgeDetail>(
    `/goalie-detail/${playerId}/now`,
    `goalie-${playerId}`
  );
}

export async function fetchTeamZoneTime(teamId: number): Promise<TeamZoneTimeDetails | null> {
  return fetchEdge<TeamZoneTimeDetails>(
    `/team-zone-time-details/${teamId}/now`,
    `zone-time-${teamId}`
  );
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
