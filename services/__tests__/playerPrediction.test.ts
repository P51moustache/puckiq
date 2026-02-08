/**
 * Tests for services/playerPrediction.ts (Supabase-only)
 * Tests: fetchTeamRoster (Supabase), fetchPlayerStats (temporarily disabled),
 *        getTeamHotPlayers, getGoalieMatchup, getPlayerPredictionFactors, clearPlayerCache
 */

import {
  fetchTeamRoster,
  fetchPlayerStats,
  getTeamHotPlayers,
  getGoalieMatchup,
  getPlayerPredictionFactors,
  clearPlayerCache,
} from '../playerPrediction';
import { supabase } from '../../lib/supabase';

// ---------------------------------------------------------------------------
// Mock Supabase data
// ---------------------------------------------------------------------------

const mockPlayerRows = [
  {
    id: 8478402,
    first_name: 'Connor',
    last_name: 'McDavid',
    position: 'C',
    current_team_abbrev: 'EDM',
    is_active: true,
    sweater_number: 97,
  },
  {
    id: 8477934,
    first_name: 'Leon',
    last_name: 'Draisaitl',
    position: 'C',
    current_team_abbrev: 'EDM',
    is_active: true,
    sweater_number: 29,
  },
  {
    id: 8479361,
    first_name: 'Evan',
    last_name: 'Bouchard',
    position: 'D',
    current_team_abbrev: 'EDM',
    is_active: true,
    sweater_number: 2,
  },
  {
    id: 8479496,
    first_name: 'Stuart',
    last_name: 'Skinner',
    position: 'G',
    current_team_abbrev: 'EDM',
    is_active: true,
    sweater_number: 74,
  },
];

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let mockQueryResult: { data: any; error: any } = { data: [], error: null };

beforeEach(() => {
  clearPlayerCache();
  (supabase.from as jest.Mock).mockClear();
  mockQueryResult = { data: mockPlayerRows, error: null };

  // Build a chainable mock for Supabase
  const buildChain = () => {
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      then: (resolve: any) => resolve(mockQueryResult),
    };
    return chain;
  };

  (supabase.from as jest.Mock).mockImplementation(() => buildChain());
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// fetchTeamRoster
// ---------------------------------------------------------------------------

describe('fetchTeamRoster', () => {
  it('should return mapped players from Supabase', async () => {
    const roster = await fetchTeamRoster('EDM');

    expect(roster).toHaveLength(4);
    expect(roster[0].fullName).toBe('Connor McDavid');
    expect(roster[0].positionType).toBe('F');
    expect(roster[0].id).toBe(8478402);
    expect(roster[2].positionType).toBe('D');
    expect(roster[3].positionType).toBe('G');
  });

  it('should return cached data on subsequent calls', async () => {
    await fetchTeamRoster('EDM');
    await fetchTeamRoster('EDM');

    // from() called only once (second call uses cache)
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('should return empty array when Supabase returns no data', async () => {
    mockQueryResult = { data: [], error: null };

    const roster = await fetchTeamRoster('XXX');
    expect(roster).toEqual([]);
  });

  it('should return empty array when Supabase returns error', async () => {
    mockQueryResult = { data: null, error: { message: 'table not found' } };

    const roster = await fetchTeamRoster('XXX');
    expect(roster).toEqual([]);
  });

  it('should set sweaterNumber from Supabase data', async () => {
    const roster = await fetchTeamRoster('EDM');
    expect(roster[0].sweaterNumber).toBe(97);
  });
});

// ---------------------------------------------------------------------------
// fetchPlayerStats (temporarily disabled - returns null)
// ---------------------------------------------------------------------------

describe('fetchPlayerStats', () => {
  it('should return null (temporarily disabled due to incomplete seeding)', async () => {
    const stats = await fetchPlayerStats(8478402);
    expect(stats).toBeNull();
  });

  it('should return null for any player ID', async () => {
    const stats = await fetchPlayerStats(99999);
    expect(stats).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getTeamHotPlayers
// ---------------------------------------------------------------------------

describe('getTeamHotPlayers', () => {
  it('should return team abbrev and empty arrays when fetchPlayerStats is disabled', async () => {
    const result = await getTeamHotPlayers('EDM');

    expect(result.teamAbbrev).toBe('EDM');
    // With fetchPlayerStats returning null, no hot/cold players can be identified
    expect(result.hotPlayers).toEqual([]);
    expect(result.coldPlayers).toEqual([]);
    expect(result.overallHeatIndex).toBe(0);
  });

  it('should return empty arrays on error', async () => {
    // Force an error by making Supabase throw
    (supabase.from as jest.Mock).mockImplementation(() => {
      throw new Error('Database error');
    });

    const result = await getTeamHotPlayers('XXX');

    expect(result.hotPlayers).toEqual([]);
    expect(result.coldPlayers).toEqual([]);
    expect(result.overallHeatIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getGoalieMatchup
// ---------------------------------------------------------------------------

describe('getGoalieMatchup', () => {
  it('should return neutral matchup when fetchPlayerStats is disabled', async () => {
    // Roster has a goalie but fetchPlayerStats returns null
    const matchup = await getGoalieMatchup('EDM', 'EDM');

    // homeGoalie/awayGoalie should be null because fetchPlayerStats returns null
    expect(matchup.homeGoalie).toBeNull();
    expect(matchup.awayGoalie).toBeNull();
    expect(matchup.advantage).toBe('neutral');
    expect(matchup.confidenceImpact).toBe(0);
  });

  it('should return neutral matchup when no goalies in roster', async () => {
    // Return roster without goalies
    mockQueryResult = {
      data: [{ id: 1, first_name: 'Test', last_name: 'Player', position: 'C', is_active: true }],
      error: null,
    };

    const matchup = await getGoalieMatchup('TOR', 'MTL');

    expect(matchup.homeGoalie).toBeNull();
    expect(matchup.awayGoalie).toBeNull();
    expect(matchup.advantage).toBe('neutral');
    expect(matchup.confidenceImpact).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getPlayerPredictionFactors
// ---------------------------------------------------------------------------

describe('getPlayerPredictionFactors', () => {
  it('should return zero impact when fetchPlayerStats is disabled', async () => {
    const factors = await getPlayerPredictionFactors('EDM', 'TOR');

    expect(factors).toHaveProperty('goalieMatchup');
    expect(factors).toHaveProperty('homeHotPlayers');
    expect(factors).toHaveProperty('awayHotPlayers');
    expect(factors).toHaveProperty('totalImpact');
    expect(factors.totalImpact).toBe(0);
  });

  it('should return zero impact on error', async () => {
    (supabase.from as jest.Mock).mockImplementation(() => {
      throw new Error('Database error');
    });

    const factors = await getPlayerPredictionFactors('XXX', 'YYY');

    expect(factors.totalImpact).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// clearPlayerCache
// ---------------------------------------------------------------------------

describe('clearPlayerCache', () => {
  it('should clear cached roster data', async () => {
    // First call - queries Supabase
    await fetchTeamRoster('EDM');
    expect(supabase.from).toHaveBeenCalledTimes(1);

    // Second call - uses cache (no additional Supabase call)
    await fetchTeamRoster('EDM');
    expect(supabase.from).toHaveBeenCalledTimes(1);

    // Clear cache
    clearPlayerCache();

    // Third call - should query Supabase again
    await fetchTeamRoster('EDM');
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });
});
