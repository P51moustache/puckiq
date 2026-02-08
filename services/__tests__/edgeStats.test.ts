/**
 * Tests for services/edgeStats.ts (Supabase-only)
 * Tests: cache TTL, Supabase querying, error handling, all endpoint functions.
 */

import {
  fetchEdgeSkaterLanding,
  fetchEdgeGoalieLanding,
  fetchEdgeTeamLanding,
  fetchEdgeByTheNumbers,
  fetchSkaterEdge,
  fetchTeamEdge,
  fetchGoalieEdge,
  fetchTeamZoneTime,
  clearEdgeCache,
  _internals,
} from '../edgeStats';
import { supabase } from '../../lib/supabase';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockSkaterLanding = {
  hardestShot: {
    player: { id: 8482671, firstName: { default: 'Jake' }, lastName: { default: 'Kleven' }, team: { abbrev: 'EDM' } },
    shotSpeed: { imperial: { speed: 103.0 }, metric: { speed: 165.8 } },
  },
  maxSkatingSpeed: {
    player: { id: 8478402, firstName: { default: 'Connor' }, lastName: { default: 'McDavid' }, team: { abbrev: 'EDM' } },
    skatingSpeed: { imperial: { speed: 24.57 } },
  },
};

const mockTeamDetail = {
  team: { id: 1, abbrev: 'NJD', wins: 20, losses: 15, otLosses: 5 },
  shotSpeed: { topShotSpeed: { imperial: 98.5, rank: 3 } },
};

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let mockSingleResult: { data: any; error: any } = { data: null, error: null };
let mockLimitResult: { data: any; error: any } = { data: null, error: null };

beforeEach(() => {
  clearEdgeCache();
  (supabase.from as jest.Mock).mockClear();
  mockSingleResult = { data: null, error: null };
  mockLimitResult = { data: null, error: null };

  // Build a chainable mock for Supabase
  const buildChain = () => {
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockImplementation(() => ({
        ...chain,
        single: jest.fn(() => Promise.resolve(mockSingleResult)),
        then: (resolve: any) => resolve(mockLimitResult),
      })),
      single: jest.fn(() => Promise.resolve(mockSingleResult)),
      then: (resolve: any) => resolve(mockLimitResult),
    };
    return chain;
  };

  (supabase.from as jest.Mock).mockImplementation(() => buildChain());
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Landing endpoints (use fetchLeaderboardFromSupabase -> .single())
// ---------------------------------------------------------------------------

describe('edgeStats service', () => {
  describe('fetchEdgeSkaterLanding', () => {
    it('returns data from Supabase', async () => {
      mockSingleResult = { data: { data: mockSkaterLanding }, error: null };
      const result = await fetchEdgeSkaterLanding();
      expect(result).toEqual(mockSkaterLanding);
    });

    it('returns null when Supabase returns error', async () => {
      mockSingleResult = { data: null, error: { message: 'not found' } };
      const result = await fetchEdgeSkaterLanding();
      expect(result).toBeNull();
    });

    it('returns null when Supabase returns no data', async () => {
      mockSingleResult = { data: null, error: null };
      const result = await fetchEdgeSkaterLanding();
      expect(result).toBeNull();
    });
  });

  describe('fetchEdgeGoalieLanding', () => {
    it('returns data from Supabase', async () => {
      const mockGoalie = { highDangerSavePctg: { player: { id: 1 }, savePctg: { value: 0.92 } } };
      mockSingleResult = { data: { data: mockGoalie }, error: null };
      const result = await fetchEdgeGoalieLanding();
      expect(result).toEqual(mockGoalie);
    });
  });

  describe('fetchEdgeTeamLanding', () => {
    it('returns data from Supabase', async () => {
      const mockTeam = { shotAttemptsOver90: { team: { abbrev: 'NJD' }, value: 215, rank: 1 } };
      mockSingleResult = { data: { data: mockTeam }, error: null };
      const result = await fetchEdgeTeamLanding();
      expect(result).toEqual(mockTeam);
    });
  });

  describe('fetchEdgeByTheNumbers', () => {
    it('returns data from Supabase', async () => {
      const mockBTN = { games: 6, gameDate: '2026-02-03' };
      mockSingleResult = { data: { data: mockBTN }, error: null };
      const result = await fetchEdgeByTheNumbers();
      expect(result).toEqual(mockBTN);
    });
  });

  // ---------------------------------------------------------------------------
  // Detail endpoints (use fetchDetailFromSupabase -> .limit(1).single())
  // ---------------------------------------------------------------------------

  describe('fetchSkaterEdge (detail)', () => {
    it('returns data for a specific player', async () => {
      const mockSkater = { player: { id: 8478402 }, topShotSpeed: { imperial: 95.0 } };
      mockSingleResult = { data: { data: mockSkater }, error: null };
      const result = await fetchSkaterEdge(8478402);
      expect(result).toEqual(mockSkater);
    });

    it('returns null when no data exists', async () => {
      mockSingleResult = { data: null, error: { message: 'not found' } };
      const result = await fetchSkaterEdge(99999);
      expect(result).toBeNull();
    });
  });

  describe('fetchTeamEdge (detail)', () => {
    it('returns data for a specific team', async () => {
      mockSingleResult = { data: { data: mockTeamDetail }, error: null };
      const result = await fetchTeamEdge(1);
      expect(result).toEqual(mockTeamDetail);
    });
  });

  describe('fetchGoalieEdge (detail)', () => {
    it('returns data for a specific goalie', async () => {
      const mockGoalie = { player: { id: 8478048 }, stats: { gaa: { value: 2.45 } } };
      mockSingleResult = { data: { data: mockGoalie }, error: null };
      const result = await fetchGoalieEdge(8478048);
      expect(result).toEqual(mockGoalie);
    });
  });

  describe('fetchTeamZoneTime', () => {
    it('returns zone time data for a team', async () => {
      const mockZone = { zoneTimeDetails: [{ strength: 'all', offensiveZonePctg: 42.0 }] };
      mockSingleResult = { data: { data: mockZone }, error: null };
      const result = await fetchTeamZoneTime(1);
      expect(result).toEqual(mockZone);
    });
  });

  // ---------------------------------------------------------------------------
  // Cache behavior
  // ---------------------------------------------------------------------------

  describe('cache behavior', () => {
    it('returns cached data on second call within TTL', async () => {
      mockSingleResult = { data: { data: mockSkaterLanding }, error: null };
      await fetchEdgeSkaterLanding();
      // Second call should not query Supabase again
      const result = await fetchEdgeSkaterLanding();
      expect(result).toEqual(mockSkaterLanding);
      // from() called only once (for first fetch)
      expect(supabase.from).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after cache expires', async () => {
      mockSingleResult = { data: { data: mockSkaterLanding }, error: null };
      await fetchEdgeSkaterLanding();

      // Manually expire the cache
      const entry = _internals.cache.get('skater-landing');
      if (entry) entry.timestamp = Date.now() - _internals.CACHE_TTL_MS - 1;

      await fetchEdgeSkaterLanding();
      expect(supabase.from).toHaveBeenCalledTimes(2);
    });

    it('clearEdgeCache removes all cached data', async () => {
      mockSingleResult = { data: { data: mockSkaterLanding }, error: null };
      await fetchEdgeSkaterLanding();
      expect(_internals.cache.size).toBeGreaterThan(0);
      clearEdgeCache();
      expect(_internals.cache.size).toBe(0);
    });

    it('different endpoints have separate cache entries', async () => {
      mockSingleResult = { data: { data: {} }, error: null };
      await fetchEdgeSkaterLanding();
      await fetchEdgeTeamLanding();
      expect(_internals.cache.size).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Error resilience
  // ---------------------------------------------------------------------------

  describe('error resilience', () => {
    it('does not cache failed responses', async () => {
      mockSingleResult = { data: null, error: { message: 'server error' } };
      await fetchEdgeSkaterLanding();
      expect(_internals.cache.size).toBe(0);
    });
  });
});
