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

let responses: Record<string, { data: any; error: any }> = {};
const queries: Record<string, Record<string, jest.Mock>> = {};

function makeQuery(table: string) {
  const query: Record<string, jest.Mock> = {};
  for (const method of ['select', 'eq', 'in', 'not', 'order', 'limit']) {
    query[method] = jest.fn(() => query);
  }
  queries[table] = query;
  query.then = jest.fn((resolve: (result: any) => unknown) =>
    Promise.resolve(resolve(responses[table] ?? { data: [], error: null })),
  );
  return query;
}

const mockFrom = jest.fn((table: string) => makeQuery(table));

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
  player_name: '',
  team_abbrev: 'EDM',
  position: 'C',
  format: 'yahoo',
  fantasy_points: 8.5,
  floor: 3.0,
  ceiling: 15.0,
  pred_goals: 0.6,
  pred_assists: 1.2,
  pred_points: 1.8,
  pred_sog: 4.1,
  pred_hits: 0.5,
  pred_blocks: 0.3,
  game_date: '2026-04-04',
  model_version: '2026-04-04',
  data_quality: 'fresh',
  predicted_at: '2026-04-04T12:00:00.000Z',
};

const sampleRow2 = {
  ...sampleRow,
  player_id: 8477934,
  player_name: 'Leon Draisaitl',
  fantasy_points: 7.2,
};

const samplePlayer = {
  id: 8478402,
  first_name: 'Connor',
  last_name: 'McDavid',
  full_name: 'Connor McDavid',
  position: 'C',
  current_team_abbrev: 'EDM',
};

const samplePlayer2 = {
  id: 8477934,
  first_name: 'Leon',
  last_name: 'Draisaitl',
  full_name: 'Leon Draisaitl',
  position: 'C',
};

const sampleGame = {
  id: 2025020100,
  season: 20252026,
  game_type: 2,
  game_date: '2026-04-04',
  start_time_utc: '2026-04-04T20:00:00.000Z',
  game_state: 'FUT',
  away_team_abbrev: 'CGY',
  home_team_abbrev: 'EDM',
};

const liveStubRow = {
  ...sampleRow,
  game_id: 2025030241,
  game_date: '2026-05-04',
  team_abbrev: '',
  model_version: '20260220_061917',
};

function setResponses(overrides: Record<string, { data: any; error: any }> = {}) {
  responses = {
    ml_player_projections: { data: [sampleRow], error: null },
    players: { data: [samplePlayer], error: null },
    games: { data: [sampleGame], error: null },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-04-04T13:00:00.000Z'));
  jest.clearAllMocks();
  clearProjectionsCache();
  responses = {};
  for (const key of Object.keys(queries)) delete queries[key];
});

afterAll(() => {
  jest.useRealTimers();
});

describe('getProjectionsForRoster', () => {
  it('returns empty array for empty player IDs', async () => {
    const result = await getProjectionsForRoster([], 'yahoo', '2026-04-04');
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('fetches and maps projections for given player IDs', async () => {
    setResponses();

    const result = await getProjectionsForRoster(
      [8478402],
      'yahoo',
      '2026-04-04',
    );

    expect(result[0]).toMatchObject({
      playerId: 8478402,
      playerName: 'Connor McDavid',
      teamAbbrev: 'EDM',
      fantasyPoints: 8.5,
      recommendation: null,
      confidence: null,
      reason: null,
      gameId: 2025020100,
      opponentAbbrev: 'CGY',
      isHome: true,
    });
    expect(queries.ml_player_projections.select).toHaveBeenCalledWith(expect.not.stringContaining('recommendation'));
  });

  it('preserves a schema-shaped forecast when recommendation fields are unavailable', async () => {
    setResponses();

    const result = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      fantasyPoints: 8.5,
      predGoals: 0.6,
      predAssists: 1.2,
      recommendation: null,
      confidence: null,
      reason: null,
    });
  });

  it('rejects the observed fresh row with blank identity and no matching game', async () => {
    setResponses({
      ml_player_projections: { data: [liveStubRow], error: null },
      games: { data: [], error: null },
    });

    const result = await getProjectionsForRoster([8478402], 'yahoo', '2026-05-04');

    expect(result).toEqual([]);
  });

  it('rejects stale projection rows before they reach the UI', async () => {
    setResponses({
      ml_player_projections: { data: [{ ...sampleRow, data_quality: 'stale' }], error: null },
    });

    const result = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');
    expect(result).toEqual([]);
    expect(queries.ml_player_projections.eq).toHaveBeenCalledWith('data_quality', 'fresh');
  });

  it('rejects a forecast when its game context is missing', async () => {
    setResponses({
      ml_player_projections: { data: [sampleRow], error: null },
      games: { data: [], error: null },
    });

    const result = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');

    expect(result).toEqual([]);
  });

  it('rejects a forecast whose team is not in the matching game', async () => {
    setResponses({
      ml_player_projections: { data: [sampleRow], error: null },
      games: {
        data: [{ ...sampleGame, home_team_abbrev: 'TOR', away_team_abbrev: 'CGY' }],
        error: null,
      },
    });

    const result = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');

    expect(result).toEqual([]);
  });

  it('rejects null and non-finite forecast values instead of coercing them to zero', async () => {
    setResponses({
      ml_player_projections: {
        data: [{ ...sampleRow, fantasy_points: null }, { ...sampleRow, player_id: 8477934, fantasy_points: Infinity }],
        error: null,
      },
    });

    const result = await getProjectionsForRoster([8478402, 8477934], 'espn', '2026-04-04');
    expect(result).toEqual([]);
  });

  it('rejects a non-finite aggregate prediction value', async () => {
    setResponses({
      ml_player_projections: {
        data: [{ ...sampleRow, pred_points: NaN }],
        error: null,
      },
    });

    const result = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');

    expect(result).toEqual([]);
  });

  it('rejects a row with no authoritative player identity', async () => {
    setResponses({
      ml_player_projections: { data: [{ ...sampleRow, player_name: 'Unverified Name' }], error: null },
      players: { data: [], error: null },
    });

    const result = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');

    expect(result).toEqual([]);
  });

  it('rejects missing or future prediction timestamps', async () => {
    setResponses({
      ml_player_projections: {
        data: [
          { ...sampleRow, predicted_at: null },
          { ...sampleRow, player_id: 8477934, predicted_at: new Date(Date.now() + 60_000).toISOString() },
        ],
        error: null,
      },
    });

    const result = await getProjectionsForRoster([8478402, 8477934], 'espn', '2026-04-04');

    expect(result).toEqual([]);
  });

  it('does not mutate caller IDs while creating a cache key', async () => {
    setResponses();
    const playerIds = [2, 1];

    await getProjectionsForRoster(playerIds, 'yahoo', '2026-04-04');

    expect(playerIds).toEqual([2, 1]);
  });

  it('rejects negative count stats and incoherent pred_points', async () => {
    setResponses({
      ml_player_projections: {
        data: [
          { ...sampleRow, pred_goals: -0.1 },
          { ...sampleRow, player_id: 8477934, pred_points: 9.9 },
        ],
        error: null,
      },
    });

    const result = await getProjectionsForRoster([8478402, 8477934], 'yahoo', '2026-04-04');

    expect(result).toEqual([]);
  });

  it('rejects an old fresh row under the documented freshness window', async () => {
    setResponses({
      ml_player_projections: {
        data: [{ ...sampleRow, predicted_at: '2026-04-02T12:59:59.000Z', data_quality: 'fresh' }],
        error: null,
      },
    });

    const result = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');

    expect(result).toEqual([]);
  });

  it('rejects a future game that has already started despite FUT state', async () => {
    setResponses({
      games: {
        data: [{ ...sampleGame, start_time_utc: '2026-04-04T12:59:59.000Z' }],
        error: null,
      },
    });

    const result = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');

    expect(result).toEqual([]);
  });

  it('rejects game rows without season, type, or start-time context', async () => {
    setResponses({
      games: {
        data: [{ ...sampleGame, season: null, game_type: null, start_time_utc: null }],
        error: null,
      },
    });

    const result = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');

    expect(result).toEqual([]);
  });

  it('rejects a season that does not belong to the requested game date', async () => {
    setResponses({
      games: { data: [{ ...sampleGame, season: 20262027 }], error: null },
    });

    const result = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');

    expect(result).toEqual([]);
  });

  it('rejects a kickoff whose Eastern calendar day differs from game_date', async () => {
    setResponses({
      games: { data: [{ ...sampleGame, start_time_utc: '2026-04-05T04:00:00.000Z' }], error: null },
    });

    const result = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');

    expect(result).toEqual([]);
  });

  it.each([
    ['2026-07-01', '2026-07-01T20:00:00.000Z'],
    ['2026-08-15', '2026-08-15T20:00:00.000Z'],
  ])('accepts canonical 2026-27 season for July/August game date %s', async (gameDate, startTimeUTC) => {
    setResponses({
      ml_player_projections: {
        data: [{ ...sampleRow, game_date: gameDate }],
        error: null,
      },
      games: {
        data: [{ ...sampleGame, season: 20262027, game_date: gameDate, start_time_utc: startTimeUTC }],
        error: null,
      },
    });

    const result = await getProjectionsForRoster([8478402], 'yahoo', gameDate);

    expect(result).toHaveLength(1);
  });

  it('does not serve a cached forecast after its kickoff', async () => {
    setResponses();
    await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');
    const firstReadCount = mockFrom.mock.calls.length;

    jest.advanceTimersByTime(7 * 60 * 60 * 1000 + 60 * 1000);
    setResponses({ ml_player_projections: { data: [], error: null } });

    const result = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');

    expect(result).toEqual([]);
    expect(mockFrom.mock.calls.length).toBeGreaterThan(firstReadCount);
  });

  it('does not serve a cached forecast after its prediction-age boundary', async () => {
    setResponses({
      ml_player_projections: {
        data: [{ ...sampleRow, predicted_at: '2026-04-03T14:00:00.000Z' }],
        error: null,
      },
      games: {
        data: [{ ...sampleGame, start_time_utc: '2026-04-05T03:00:00.000Z' }],
        error: null,
      },
    });
    await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');
    const firstReadCount = mockFrom.mock.calls.length;

    jest.advanceTimersByTime(61 * 60 * 1000);
    setResponses({ ml_player_projections: { data: [], error: null } });

    const result = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');

    expect(result).toEqual([]);
    expect(mockFrom.mock.calls.length).toBeGreaterThan(firstReadCount);
  });

  it('does not cache invalid rows as a successful forecast', async () => {
    setResponses({
      ml_player_projections: { data: [{ ...sampleRow, pred_points: NaN }], error: null },
    });
    const playerQuery = getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');
    await playerQuery;
    const firstReadCount = mockFrom.mock.calls.length;

    setResponses({ ml_player_projections: { data: [], error: null } });
    await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');

    expect(mockFrom.mock.calls.length).toBeGreaterThan(firstReadCount);
  });

  it('returns cached data without allowing caller mutation to poison it', async () => {
    setResponses({ ml_player_projections: { data: [sampleRow], error: null } });
    await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');
    const result = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');

    result[0].playerName = 'Mutated by caller';
    const reread = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');
    expect(reread[0].playerName).toBe('Connor McDavid');
  });
});

describe('getWaiverWireRecommendations', () => {
  it('fetches top players excluding roster IDs', async () => {
    setResponses({ ml_player_projections: { data: [sampleRow2], error: null } });

    const result = await getWaiverWireRecommendations(
      [8478402],
      'yahoo',
      '2026-04-04',
    );

    expect(result).toEqual([]);
    expect(queries.ml_player_projections.not).toHaveBeenCalledWith('player_id', 'in', '(8478402)');
  });

  it('works with empty exclude list', async () => {
    setResponses({
      ml_player_projections: { data: [sampleRow, sampleRow2], error: null },
      players: { data: [samplePlayer, samplePlayer2], error: null },
    });

    const result = await getWaiverWireRecommendations([], 'yahoo', '2026-04-04');
    expect(result).toHaveLength(2);
  });

  it('respects custom limit', async () => {
    setResponses({ ml_player_projections: { data: [sampleRow], error: null } });

    await getWaiverWireRecommendations([], 'yahoo', '2026-04-04', 5);

    expect(queries.ml_player_projections.limit).toHaveBeenCalledWith(5);
  });

  it('returns empty array on error', async () => {
    setResponses({ ml_player_projections: { data: null, error: { message: 'timeout' } } });

    const result = await getWaiverWireRecommendations([], 'yahoo', '2026-04-04');
    expect(result).toEqual([]);
  });

  it('keeps numeric waiver usefulness without a recommendation policy', async () => {
    setResponses({ ml_player_projections: { data: [sampleRow], error: null } });

    const result = await getWaiverWireRecommendations([], 'espn', '2026-04-04');

    expect(result).toHaveLength(1);
    expect(result[0].fantasyPoints).toBe(8.5);
    expect(result[0].recommendation).toBeNull();
  });
});

describe('getGameProjections', () => {
  it('fetches all projections for a game', async () => {
    // The chain for getGameProjections is .select().eq('format').eq('game_id')
    // The last .eq() call returns the result directly (as a thenable)
    setResponses({
      ml_player_projections: { data: [sampleRow, sampleRow2], error: null },
      players: { data: [samplePlayer, samplePlayer2], error: null },
    });

    const result = await getGameProjections(2025020100, 'yahoo');

    expect(result).toHaveLength(2);
  });

  it('returns empty array on error', async () => {
    setResponses({ ml_player_projections: { data: null, error: { message: 'fail' } } });

    const result = await getGameProjections(999, 'espn');
    expect(result).toEqual([]);
  });

  it('caches game projections', async () => {
    setResponses({ ml_player_projections: { data: [sampleRow], error: null } });

    await getGameProjections(2025020100, 'yahoo');
    const result = await getGameProjections(2025020100, 'yahoo');

    expect(result).toHaveLength(1);
    expect(queries.ml_player_projections.select).toHaveBeenCalledTimes(1);
  });
});

describe('clearProjectionsCache', () => {
  it('clears the cache so subsequent calls re-fetch', async () => {
    setResponses();

    await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');
    expect(mockFrom).toHaveBeenCalledTimes(3);

    clearProjectionsCache();

    await getProjectionsForRoster([8478402], 'yahoo', '2026-04-04');
    expect(mockFrom).toHaveBeenCalledTimes(6);
  });
});

describe('CACHE_TTL', () => {
  it('is 5 minutes', () => {
    expect(CACHE_TTL).toBe(5 * 60 * 1000);
  });
});
