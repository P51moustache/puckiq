/**
 * Tests for Player Stats Service (Supabase-only)
 * Verifies Supabase querying, response mapping, caching, sorting, and error handling.
 */

import {
  clearPlayerStatsCache,
  getTeamPlayerStats,
  getKeyPlayersForGame,
} from '../playerStats';
import { supabase } from '../../lib/supabase';

// ---------------------------------------------------------------------------
// Mock Supabase data
// ---------------------------------------------------------------------------

const mockSkaterRows = [
  {
    player_id: 8478483,
    position: 'RW',
    games_played: 55,
    goals: 15,
    assists: 45,
    points: 60,
    plus_minus: 12,
    shots: 120,
    shooting_pctg: 0.125,
  },
  {
    player_id: 8479318,
    position: 'C',
    games_played: 51,
    goals: 26,
    assists: 22,
    points: 48,
    plus_minus: 4,
    shots: 193,
    shooting_pctg: 0.1347,
  },
];

const mockGoalieRows = [
  {
    player_id: 8480191,
    games_played: 38,
    wins: 22,
    losses: 10,
    ot_losses: 4,
    goals_against_avg: 2.45,
    save_pctg: 0.918,
  },
];

const mockPlayerRows = [
  { id: 8478483, first_name: 'Mitch', last_name: 'Marner', headshot_url: 'https://assets.nhle.com/mugs/nhl/20252026/TOR/8478483.png' },
  { id: 8479318, first_name: 'Auston', last_name: 'Matthews', headshot_url: 'https://assets.nhle.com/mugs/nhl/20252026/TOR/8479318.png' },
  { id: 8480191, first_name: 'Anthony', last_name: 'Stolarz', headshot_url: null },
];

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

// Track what the chainable query builder returns
let mockSkaterResult: { data: any; error: any } = { data: mockSkaterRows, error: null };
let mockGoalieResult: { data: any; error: any } = { data: mockGoalieRows, error: null };
let mockPlayersResult: { data: any; error: any } = { data: mockPlayerRows, error: null };

beforeEach(() => {
  clearPlayerStatsCache();
  mockSkaterResult = { data: mockSkaterRows, error: null };
  mockGoalieResult = { data: mockGoalieRows, error: null };
  mockPlayersResult = { data: mockPlayerRows, error: null };

  // Build a chainable mock that resolves based on the table being queried
  let currentTable = '';

  const getResult = () => {
    if (currentTable === 'skater_season_stats') return mockSkaterResult;
    if (currentTable === 'goalie_season_stats') return mockGoalieResult;
    if (currentTable === 'players') return mockPlayersResult;
    return { data: [], error: null };
  };

  const buildChain = () => {
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockImplementation(() => {
        const result = getResult();
        return {
          ...chain,
          then: (resolve: any) => resolve(result),
        };
      }),
      then: (resolve: any) => {
        const result = getResult();
        return resolve(result);
      },
    };
    return chain;
  };

  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    currentTable = table;
    return buildChain();
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// clearPlayerStatsCache
// ---------------------------------------------------------------------------

describe('clearPlayerStatsCache', () => {
  it('clears the cache so the next call queries Supabase again', async () => {
    // First call — populates cache
    const first = await getTeamPlayerStats('TOR');
    expect(first.skaters).toHaveLength(2);

    // Second call — should use cache (same reference)
    const second = await getTeamPlayerStats('TOR');
    expect(second).toBe(first);

    // Clear cache
    clearPlayerStatsCache();

    // Third call — should query Supabase again
    const third = await getTeamPlayerStats('TOR');
    expect(third).not.toBe(first);
    expect(third.skaters).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// getTeamPlayerStats
// ---------------------------------------------------------------------------

describe('getTeamPlayerStats', () => {
  it('returns mapped skater and goalie data from Supabase', async () => {
    const result = await getTeamPlayerStats('TOR');

    expect(result.skaters).toHaveLength(2);
    expect(result.goalies).toHaveLength(1);

    // Verify skater is fully mapped (already sorted by points desc from Supabase)
    const marner = result.skaters[0];
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
      headshotUrl: 'https://assets.nhle.com/mugs/nhl/20252026/TOR/8478483.png',
    });

    // Verify goalie is fully mapped (null headshot_url becomes undefined)
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
      headshotUrl: undefined,
    });
  });

  it('returns cached result on second call', async () => {
    const first = await getTeamPlayerStats('TOR');
    const second = await getTeamPlayerStats('TOR');

    expect(second).toBe(first); // same reference — from cache
  });

  it('returns empty stats when Supabase returns no data', async () => {
    mockSkaterResult = { data: [], error: null };
    mockGoalieResult = { data: [], error: null };

    const result = await getTeamPlayerStats('TOR');

    expect(result).toEqual({ skaters: [], goalies: [] });
  });

  it('returns empty stats when Supabase returns an error', async () => {
    mockSkaterResult = { data: null, error: { message: 'table not found' } };
    mockGoalieResult = { data: null, error: { message: 'table not found' } };

    const result = await getTeamPlayerStats('TOR');

    expect(result).toEqual({ skaters: [], goalies: [] });
  });

  it('handles missing fields gracefully with defaults', async () => {
    mockSkaterResult = {
      data: [{
        player_id: 1,
        // All stat fields missing
      }],
      error: null,
    };
    mockGoalieResult = { data: [], error: null };
    mockPlayersResult = { data: [{ id: 1, first_name: 'Test', last_name: 'Player', headshot_url: null }], error: null };

    const result = await getTeamPlayerStats('TOR');

    expect(result.skaters[0].gamesPlayed).toBe(0);
    expect(result.skaters[0].goals).toBe(0);
    expect(result.skaters[0].points).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getKeyPlayersForGame
// ---------------------------------------------------------------------------

describe('getKeyPlayersForGame', () => {
  it('returns stats for both home and away teams', async () => {
    const result = await getKeyPlayersForGame('TOR', 'MTL');

    expect(result.home.skaters).toHaveLength(2);
    expect(result.home.goalies).toHaveLength(1);
    expect(result.away.skaters).toHaveLength(2);
    expect(result.away.goalies).toHaveLength(1);
  });

  it('returns empty stats for both teams when Supabase has no data', async () => {
    mockSkaterResult = { data: [], error: null };
    mockGoalieResult = { data: [], error: null };

    const result = await getKeyPlayersForGame('TOR', 'MTL');

    expect(result.home).toEqual({ skaters: [], goalies: [] });
    expect(result.away).toEqual({ skaters: [], goalies: [] });
  });
});
