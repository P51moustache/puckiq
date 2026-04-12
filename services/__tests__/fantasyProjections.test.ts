import {
  getProjectionsForRoster,
  getWaiverWireRecommendations,
  getGameProjections,
  clearProjectionsCache,
  CACHE_TTL,
} from '../fantasyProjections';

// ---------------------------------------------------------------------------
// Mock Supabase — use getter pattern to avoid hoisting issues
// ---------------------------------------------------------------------------

let mockQueryResult: { data: any; error: any } = { data: [], error: null };

const mockLimit = jest.fn(() => mockQueryResult);
const mockOrder = jest.fn(() => ({ limit: mockLimit }));
const mockNot = jest.fn(() => ({ order: mockOrder, limit: mockLimit }));
const mockIn = jest.fn(() => mockQueryResult);
const mockEq: jest.Mock = jest.fn();
mockEq.mockImplementation(() => ({
  eq: mockEq,
  in: mockIn,
  not: mockNot,
  order: mockOrder,
  limit: mockLimit,
}));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    get from() {
      return mockFrom;
    },
  },
}));

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleRow = {
  game_id: 2025020100,
  player_id: 8478402,
  player_name: 'Connor McDavid',
  team_abbrev: 'EDM',
  position: 'C',
  format: 'yahoo',
  fantasy_points: 8.5,
  floor: 3.0,
  ceiling: 15.0,
  pred_goals: 0.6,
  pred_assists: 1.2,
  pred_sog: 4.1,
  pred_hits: 0.5,
  pred_blocks: 0.3,
  game_date: '2026-04-04',
  recommendation: 'START',
  confidence: 'high',
  reason: 'Elite matchup',
  opponent_abbrev: 'CGY',
  is_home: true,
};

const sampleRow2 = {
  ...sampleRow,
  player_id: 8477934,
  player_name: 'Leon Draisaitl',
  fantasy_points: 7.2,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  clearProjectionsCache();
  mockQueryResult = { data: [], error: null };

  // Re-wire default chain behavior
  mockEq.mockImplementation(() => ({
    eq: mockEq,
    in: mockIn,
    not: mockNot,
    order: mockOrder,
    limit: mockLimit,
  }));
  mockIn.mockImplementation(() => mockQueryResult);
  mockLimit.mockImplementation(() => mockQueryResult);
});

describe('getProjectionsForRoster', () => {
  it('returns empty array for empty player IDs', async () => {
    const result = await getProjectionsForRoster([], 'yahoo', '2026-04-04');
    expect(result).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('fetches and maps projections for given player IDs', async () => {
    mockIn.mockReturnValueOnce({ data: [sampleRow, sampleRow2], error: null });

    const result = await getProjectionsForRoster(
      [8478402, 8477934],
      'yahoo',
      '2026-04-04',
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      playerId: 8478402,
      playerName: 'Connor McDavid',
      teamAbbrev: 'EDM',
      position: 'C',
      fantasyPoints: 8.5,
      floor: 3.0,
      ceiling: 15.0,
      predGoals: 0.6,
      predAssists: 1.2,
      predSog: 4.1,
      predHits: 0.5,
      predBlocks: 0.3,
      recommendation: 'START',
      confidence: 'high',
      reason: 'Elite matchup',
      gameId: 2025020100,
      opponentAbbrev: 'CGY',
      isHome: true,
    });
    expect(result[1].playerName).toBe('Leon Draisaitl');
  });

  it('returns cached data on subsequent calls', async () => {
    mockIn.mockReturnValueOnce({ data: [sampleRow], error: null });

    await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');
    const result = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');

    // select should only be called once (second call uses cache)
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  it('returns empty array on Supabase error', async () => {
    mockIn.mockReturnValueOnce({ data: null, error: { message: 'DB error' } });

    const result = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');
    expect(result).toEqual([]);
  });

  it('handles null fields with defaults', async () => {
    const sparseRow = {
      game_id: 100,
      player_id: 999,
      player_name: 'Test Player',
      team_abbrev: 'TST',
      position: null,
      fantasy_points: null,
      floor: null,
      ceiling: null,
      pred_goals: null,
      pred_assists: null,
      pred_sog: null,
      pred_hits: null,
      pred_blocks: null,
      recommendation: null,
      confidence: null,
      reason: null,
      opponent_abbrev: null,
      is_home: null,
    };
    mockIn.mockReturnValueOnce({ data: [sparseRow], error: null });

    const result = await getProjectionsForRoster([999], 'espn', '2026-04-04');
    expect(result[0]).toMatchObject({
      position: '',
      fantasyPoints: 0,
      floor: 0,
      ceiling: 0,
      predGoals: 0,
      predAssists: 0,
      predSog: 0,
      predHits: 0,
      predBlocks: 0,
      recommendation: 'FLEX',
      confidence: 'medium',
      reason: '',
      opponentAbbrev: '',
      isHome: false,
    });
  });
});

describe('getWaiverWireRecommendations', () => {
  it('fetches top players excluding roster IDs', async () => {
    mockLimit.mockReturnValueOnce({ data: [sampleRow2], error: null });

    const result = await getWaiverWireRecommendations(
      [8478402],
      'yahoo',
      '2026-04-04',
    );

    expect(result).toHaveLength(1);
    expect(result[0].playerName).toBe('Leon Draisaitl');
    expect(mockNot).toHaveBeenCalledWith('player_id', 'in', '(8478402)');
  });

  it('works with empty exclude list', async () => {
    mockLimit.mockReturnValueOnce({ data: [sampleRow, sampleRow2], error: null });

    const result = await getWaiverWireRecommendations([], 'yahoo', '2026-04-04');
    expect(result).toHaveLength(2);
  });

  it('respects custom limit', async () => {
    mockLimit.mockReturnValueOnce({ data: [sampleRow], error: null });

    await getWaiverWireRecommendations([], 'yahoo', '2026-04-04', 5);

    expect(mockLimit).toHaveBeenCalledWith(5);
  });

  it('returns empty array on error', async () => {
    mockLimit.mockReturnValueOnce({ data: null, error: { message: 'timeout' } });

    const result = await getWaiverWireRecommendations([], 'yahoo', '2026-04-04');
    expect(result).toEqual([]);
  });

  it('returns cached data on repeated calls', async () => {
    mockLimit.mockReturnValueOnce({ data: [sampleRow], error: null });

    await getWaiverWireRecommendations([8478402], 'espn', '2026-04-04');
    const result = await getWaiverWireRecommendations([8478402], 'espn', '2026-04-04');

    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });
});

describe('getGameProjections', () => {
  it('fetches all projections for a game', async () => {
    // The chain for getGameProjections is .select().eq('format').eq('game_id')
    // The last .eq() call returns the result directly (as a thenable)
    const innerEq = jest.fn().mockReturnValue({ data: [sampleRow, sampleRow2], error: null });
    mockEq.mockImplementationOnce(() => ({
      eq: innerEq,
      in: mockIn,
      not: mockNot,
      order: mockOrder,
      limit: mockLimit,
    }));

    const result = await getGameProjections(2025020100, 'yahoo');

    expect(result).toHaveLength(2);
    expect(result[0].gameId).toBe(2025020100);
  });

  it('returns empty array on error', async () => {
    const innerEq = jest.fn().mockReturnValue({ data: null, error: { message: 'fail' } });
    mockEq.mockImplementationOnce(() => ({
      eq: innerEq,
      in: mockIn,
      not: mockNot,
      order: mockOrder,
      limit: mockLimit,
    }));

    const result = await getGameProjections(999, 'espn');
    expect(result).toEqual([]);
  });

  it('caches game projections', async () => {
    const innerEq = jest.fn().mockReturnValue({ data: [sampleRow], error: null });
    mockEq.mockImplementationOnce(() => ({
      eq: innerEq,
      in: mockIn,
      not: mockNot,
      order: mockOrder,
      limit: mockLimit,
    }));

    await getGameProjections(2025020100, 'yahoo');
    const result = await getGameProjections(2025020100, 'yahoo');

    expect(result).toHaveLength(1);
    // innerEq only called once — second call from cache
    expect(innerEq).toHaveBeenCalledTimes(1);
  });
});

describe('clearProjectionsCache', () => {
  it('clears the cache so subsequent calls re-fetch', async () => {
    mockIn.mockReturnValue({ data: [sampleRow], error: null });

    await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');
    expect(mockSelect).toHaveBeenCalledTimes(1);

    clearProjectionsCache();

    await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });
});

describe('CACHE_TTL', () => {
  it('is 5 minutes', () => {
    expect(CACHE_TTL).toBe(5 * 60 * 1000);
  });
});
