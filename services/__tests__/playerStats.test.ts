/**
 * Tests for Player Stats Service
 * Verifies NHL API fetching, response mapping, caching, sorting, and error handling.
 */

import {
  clearPlayerStatsCache,
  getTeamPlayerStats,
  getKeyPlayersForGame,
} from '../playerStats';

// ---------------------------------------------------------------------------
// Mock NHL API response
// ---------------------------------------------------------------------------

const mockNHLResponse = {
  skaters: [
    {
      playerId: 8479318,
      firstName: { default: 'Auston' },
      lastName: { default: 'Matthews' },
      positionCode: 'C',
      gamesPlayed: 51,
      goals: 26,
      assists: 22,
      points: 48,
      plusMinus: 4,
      shots: 193,
      shootingPctg: 0.1347,
    },
    {
      playerId: 8478483,
      firstName: { default: 'Mitch' },
      lastName: { default: 'Marner' },
      positionCode: 'RW',
      gamesPlayed: 55,
      goals: 15,
      assists: 45,
      points: 60,
      plusMinus: 12,
      shots: 120,
      shootingPctg: 0.125,
    },
  ],
  goalies: [
    {
      playerId: 8480191,
      firstName: { default: 'Anthony' },
      lastName: { default: 'Stolarz' },
      gamesPlayed: 38,
      gamesStarted: 36,
      wins: 22,
      losses: 10,
      otLosses: 4,
      goalsAgainstAvg: 2.45,
      savePctg: 0.918,
    },
  ],
};

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();

beforeEach(() => {
  clearPlayerStatsCache();
  mockFetch.mockReset();
  global.fetch = mockFetch;
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// clearPlayerStatsCache
// ---------------------------------------------------------------------------

describe('clearPlayerStatsCache', () => {
  it('clears the cache so the next call fetches fresh data', async () => {
    mockFetch.mockResolvedValue({
      json: async () => mockNHLResponse,
    });

    // First call — populates cache
    await getTeamPlayerStats('TOR');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call — served from cache
    await getTeamPlayerStats('TOR');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Clear cache
    clearPlayerStatsCache();

    // Third call — should fetch again
    await getTeamPlayerStats('TOR');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// getTeamPlayerStats
// ---------------------------------------------------------------------------

describe('getTeamPlayerStats', () => {
  it('fetches from the correct NHL API endpoint', async () => {
    mockFetch.mockResolvedValue({
      json: async () => mockNHLResponse,
    });

    await getTeamPlayerStats('TOR');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api-web.nhle.com/v1/club-stats/TOR/now',
    );
  });

  it('returns mapped skater and goalie data', async () => {
    mockFetch.mockResolvedValue({
      json: async () => mockNHLResponse,
    });

    const result = await getTeamPlayerStats('TOR');

    expect(result.skaters).toHaveLength(2);
    expect(result.goalies).toHaveLength(1);

    // Verify a skater is fully mapped
    const marner = result.skaters[0]; // Marner has 60 pts, sorted first
    expect(marner).toEqual({
      playerId: 8478483,
      firstName: 'Mitch',
      lastName: 'Marner',
      positionCode: 'RW',
      gamesPlayed: 55,
      goals: 15,
      assists: 45,
      points: 60,
      plusMinus: 12,
      shots: 120,
      shootingPctg: 0.125,
    });

    // Verify goalie is fully mapped
    expect(result.goalies[0]).toEqual({
      playerId: 8480191,
      firstName: 'Anthony',
      lastName: 'Stolarz',
      gamesPlayed: 38,
      wins: 22,
      losses: 10,
      otLosses: 4,
      goalsAgainstAvg: 2.45,
      savePctg: 0.918,
    });
  });

  it('returns cached result on second call without re-fetching', async () => {
    mockFetch.mockResolvedValue({
      json: async () => mockNHLResponse,
    });

    const first = await getTeamPlayerStats('TOR');
    const second = await getTeamPlayerStats('TOR');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(second).toBe(first); // same reference — from cache
  });

  it('maps NHL API name objects ({ default: "..." }) to plain strings', async () => {
    mockFetch.mockResolvedValue({
      json: async () => mockNHLResponse,
    });

    const result = await getTeamPlayerStats('TOR');

    // Skater names should be plain strings, not objects
    for (const skater of result.skaters) {
      expect(typeof skater.firstName).toBe('string');
      expect(typeof skater.lastName).toBe('string');
    }

    // Goalie names should also be plain strings
    for (const goalie of result.goalies) {
      expect(typeof goalie.firstName).toBe('string');
      expect(typeof goalie.lastName).toBe('string');
    }

    expect(result.skaters[0].firstName).toBe('Mitch');
    expect(result.goalies[0].firstName).toBe('Anthony');
  });

  it('sorts skaters by points descending', async () => {
    mockFetch.mockResolvedValue({
      json: async () => mockNHLResponse,
    });

    const result = await getTeamPlayerStats('TOR');

    // Marner (60 pts) should come before Matthews (48 pts)
    expect(result.skaters[0].lastName).toBe('Marner');
    expect(result.skaters[0].points).toBe(60);
    expect(result.skaters[1].lastName).toBe('Matthews');
    expect(result.skaters[1].points).toBe(48);
  });

  it('sorts goalies by wins descending', async () => {
    const multiGoalieResponse = {
      skaters: [],
      goalies: [
        {
          playerId: 1,
          firstName: { default: 'Backup' },
          lastName: { default: 'Goalie' },
          gamesPlayed: 15,
          gamesStarted: 12,
          wins: 6,
          losses: 7,
          otLosses: 2,
          goalsAgainstAvg: 3.10,
          savePctg: 0.895,
        },
        {
          playerId: 2,
          firstName: { default: 'Starter' },
          lastName: { default: 'Goalie' },
          gamesPlayed: 45,
          gamesStarted: 43,
          wins: 28,
          losses: 12,
          otLosses: 3,
          goalsAgainstAvg: 2.30,
          savePctg: 0.922,
        },
      ],
    };

    mockFetch.mockResolvedValue({
      json: async () => multiGoalieResponse,
    });

    const result = await getTeamPlayerStats('TOR');

    expect(result.goalies[0].firstName).toBe('Starter');
    expect(result.goalies[0].wins).toBe(28);
    expect(result.goalies[1].firstName).toBe('Backup');
    expect(result.goalies[1].wins).toBe(6);
  });

  it('returns empty stats on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await getTeamPlayerStats('TOR');

    expect(result).toEqual({ skaters: [], goalies: [] });
  });

  it('returns empty stats when response.json() throws', async () => {
    mockFetch.mockResolvedValue({
      json: async () => {
        throw new Error('Invalid JSON');
      },
    });

    const result = await getTeamPlayerStats('TOR');

    expect(result).toEqual({ skaters: [], goalies: [] });
  });

  it('handles missing skaters or goalies arrays gracefully', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({}),
    });

    const result = await getTeamPlayerStats('TOR');

    expect(result.skaters).toEqual([]);
    expect(result.goalies).toEqual([]);
  });

  it('caches per team abbreviation independently', async () => {
    mockFetch.mockResolvedValue({
      json: async () => mockNHLResponse,
    });

    await getTeamPlayerStats('TOR');
    await getTeamPlayerStats('MTL');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api-web.nhle.com/v1/club-stats/TOR/now',
    );
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api-web.nhle.com/v1/club-stats/MTL/now',
    );
  });
});

// ---------------------------------------------------------------------------
// getKeyPlayersForGame
// ---------------------------------------------------------------------------

describe('getKeyPlayersForGame', () => {
  it('returns stats for both home and away teams', async () => {
    mockFetch.mockResolvedValue({
      json: async () => mockNHLResponse,
    });

    const result = await getKeyPlayersForGame('TOR', 'MTL');

    expect(result.home.skaters).toHaveLength(2);
    expect(result.home.goalies).toHaveLength(1);
    expect(result.away.skaters).toHaveLength(2);
    expect(result.away.goalies).toHaveLength(1);
  });

  it('fetches both teams in parallel', async () => {
    mockFetch.mockResolvedValue({
      json: async () => mockNHLResponse,
    });

    await getKeyPlayersForGame('TOR', 'MTL');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api-web.nhle.com/v1/club-stats/TOR/now',
    );
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api-web.nhle.com/v1/club-stats/MTL/now',
    );
  });

  it('returns empty stats for a team that fails without affecting the other', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async (url: string) => {
      callCount++;
      if (url.includes('MTL')) {
        throw new Error('Network error for MTL');
      }
      return { json: async () => mockNHLResponse };
    });

    const result = await getKeyPlayersForGame('TOR', 'MTL');

    // Home team (TOR) should have data
    expect(result.home.skaters).toHaveLength(2);
    expect(result.home.goalies).toHaveLength(1);

    // Away team (MTL) should have empty stats due to failure
    expect(result.away.skaters).toEqual([]);
    expect(result.away.goalies).toEqual([]);
  });

  it('returns empty stats for both teams when both fail', async () => {
    mockFetch.mockRejectedValue(new Error('Total network failure'));

    const result = await getKeyPlayersForGame('TOR', 'MTL');

    expect(result.home).toEqual({ skaters: [], goalies: [] });
    expect(result.away).toEqual({ skaters: [], goalies: [] });
  });
});
