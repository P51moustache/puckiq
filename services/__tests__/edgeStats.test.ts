/**
 * Tests for services/edgeStats.ts
 * Tests: cache TTL, fetch behavior, error handling, all endpoint functions
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

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  clearEdgeCache();
});

const mockSkaterLanding = {
  hardestShot: {
    player: { id: 8482671, firstName: { default: 'Jake' }, lastName: { default: 'Kleven' }, team: { abbrev: 'EDM' } },
    shotSpeed: { imperial: { speed: 103.0 }, metric: { speed: 165.8 } },
  },
  maxSkatingSpeed: {
    player: { id: 8478402, firstName: { default: 'Connor' }, lastName: { default: 'McDavid' }, team: { abbrev: 'EDM' } },
    skatingSpeed: { imperial: { speed: 24.57 } },
  },
  totalDistanceSkated: {
    player: { id: 8478402, firstName: { default: 'Connor' }, lastName: { default: 'McDavid' }, team: { abbrev: 'EDM' } },
    distanceSkated: { imperial: { distance: 230.39 } },
  },
};

const mockTeamDetail = {
  team: { id: 1, abbrev: 'NJD', wins: 20, losses: 15, otLosses: 5 },
  shotSpeed: { topShotSpeed: { imperial: 98.5, rank: 3 }, shotAttemptsOver90: { value: 150, rank: 5 } },
  skatingSpeed: { speedMax: { imperial: 24.1, rank: 8 }, burstsOver22: { value: 120, rank: 10 } },
  distanceSkated: { total: { imperial: 200.5, rank: 12 } },
  sogSummary: [],
  sogDetails: [],
  zoneTimeDetails: { offensiveZonePctg: 42.5, neutralZonePctg: 18.0, defensiveZonePctg: 39.5 },
};

describe('edgeStats service', () => {
  describe('fetchEdgeSkaterLanding', () => {
    it('returns data on successful fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSkaterLanding),
      });
      const result = await fetchEdgeSkaterLanding();
      expect(result).toEqual(mockSkaterLanding);
      expect(mockFetch).toHaveBeenCalledWith('https://api-web.nhle.com/v1/edge/skater-landing/now');
    });

    it('returns null on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      const result = await fetchEdgeSkaterLanding();
      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await fetchEdgeSkaterLanding();
      expect(result).toBeNull();
    });
  });

  describe('fetchEdgeGoalieLanding', () => {
    it('returns data on successful fetch', async () => {
      const mockGoalie = { highDangerSavePctg: { player: { id: 1 }, savePctg: { value: 0.92 } } };
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockGoalie) });
      const result = await fetchEdgeGoalieLanding();
      expect(result).toEqual(mockGoalie);
    });
  });

  describe('fetchEdgeTeamLanding', () => {
    it('returns data on successful fetch', async () => {
      const mockTeam = { shotAttemptsOver90: { team: { abbrev: 'NJD' }, value: 215, rank: 1 } };
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockTeam) });
      const result = await fetchEdgeTeamLanding();
      expect(result).toEqual(mockTeam);
    });
  });

  describe('fetchEdgeByTheNumbers', () => {
    it('returns data on successful fetch', async () => {
      const mockBTN = { games: 6, gameDate: '2026-02-03' };
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockBTN) });
      const result = await fetchEdgeByTheNumbers();
      expect(result).toEqual(mockBTN);
    });
  });

  describe('fetchSkaterEdge (detail)', () => {
    it('returns data for a specific player', async () => {
      const mockSkater = { player: { id: 8478402 }, topShotSpeed: { imperial: 95.0 } };
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSkater) });
      const result = await fetchSkaterEdge(8478402);
      expect(result).toEqual(mockSkater);
      expect(mockFetch).toHaveBeenCalledWith('https://api-web.nhle.com/v1/edge/skater-detail/8478402/now');
    });
  });

  describe('fetchTeamEdge (detail)', () => {
    it('returns data for a specific team', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockTeamDetail) });
      const result = await fetchTeamEdge(1);
      expect(result).toEqual(mockTeamDetail);
      expect(mockFetch).toHaveBeenCalledWith('https://api-web.nhle.com/v1/edge/team-detail/1/now');
    });
  });

  describe('fetchGoalieEdge (detail)', () => {
    it('returns data for a specific goalie', async () => {
      const mockGoalie = { player: { id: 8478048 }, stats: { gaa: { value: 2.45 } } };
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockGoalie) });
      const result = await fetchGoalieEdge(8478048);
      expect(result).toEqual(mockGoalie);
    });
  });

  describe('fetchTeamZoneTime', () => {
    it('returns zone time data for a team', async () => {
      const mockZone = { zoneTimeDetails: [{ strength: 'all', offensiveZonePctg: 42.0 }] };
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockZone) });
      const result = await fetchTeamZoneTime(1);
      expect(result).toEqual(mockZone);
    });
  });

  describe('cache behavior', () => {
    it('returns cached data on second call within TTL', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSkaterLanding) });
      await fetchEdgeSkaterLanding();
      const result = await fetchEdgeSkaterLanding();
      expect(result).toEqual(mockSkaterLanding);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only one fetch
    });

    it('re-fetches after cache expires', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockSkaterLanding) });
      await fetchEdgeSkaterLanding();

      // Manually expire the cache
      const entry = _internals.cache.get('skater-landing');
      if (entry) entry.timestamp = Date.now() - _internals.CACHE_TTL_MS - 1;

      await fetchEdgeSkaterLanding();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('clearEdgeCache removes all cached data', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockSkaterLanding) });
      await fetchEdgeSkaterLanding();
      expect(_internals.cache.size).toBeGreaterThan(0);
      clearEdgeCache();
      expect(_internals.cache.size).toBe(0);
    });

    it('different endpoints have separate cache entries', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      await fetchEdgeSkaterLanding();
      await fetchEdgeTeamLanding();
      expect(_internals.cache.size).toBe(2);
    });
  });

  describe('error resilience', () => {
    it('returns null when JSON parsing fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });
      const result = await fetchEdgeSkaterLanding();
      expect(result).toBeNull();
    });

    it('does not cache failed responses', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await fetchEdgeSkaterLanding();
      expect(_internals.cache.size).toBe(0);
    });
  });
});
