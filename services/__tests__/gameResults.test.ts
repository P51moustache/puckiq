/**
 * Tests for Game Results Service
 */

import type { GameResult, H2HRecord } from '../../types/gameResults';
import {
  formatH2HSummary,
  getH2HRecord,
  getH2HForGames,
  seedCurrentSeason,
  syncRecentResults,
  fetchGameResults,
  _resetCircuitBreaker,
} from '../gameResults';

// ── Supabase mock ──────────────────────────────────────────────────────────
// Build a chainable query builder whose terminal call returns { data, error }.
let mockQueryResult: { data: any; error: any } = { data: [], error: null };
let mockCountResult: { count: number | null; error: any } = { count: 10, error: null };

const mockLimit = jest.fn(() => mockQueryResult);
const mockOrder = jest.fn(() => ({ limit: mockLimit, ...mockQueryResult }));
const mockOr = jest.fn(() => ({ order: mockOrder }));
const mockIn = jest.fn(() => ({ or: mockOr }));
const mockEq = jest.fn(() => ({ in: mockIn, order: mockOrder, ...mockCountResult }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockUpsert = jest.fn((): { error: any } => ({ error: null }));
const mockFrom = jest.fn(() => ({
  select: mockSelect,
  upsert: mockUpsert,
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    get from() {
      return mockFrom;
    },
  },
}));

// ── fetch mock ─────────────────────────────────────────────────────────────
global.fetch = jest.fn() as jest.Mock;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Create a minimal GameResult for testing */
function makeGameResult(overrides: Partial<GameResult> = {}): GameResult {
  return {
    id: 1,
    game_id: 2024020100,
    season: '20242025',
    game_date: '2024-11-10',
    home_team: 'TOR',
    away_team: 'MTL',
    home_score: 4,
    away_score: 2,
    game_state: 'FINAL',
    created_at: '2024-11-10T23:00:00Z',
    ...overrides,
  };
}

/** Create an H2HRecord for formatH2HSummary tests */
function makeH2HRecord(overrides: Partial<H2HRecord> = {}): H2HRecord {
  return {
    teamA: 'TOR',
    teamB: 'MTL',
    teamAWins: 0,
    teamBWins: 0,
    otLosses: 0,
    games: [],
    ...overrides,
  };
}

// ── Setup / Teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryResult = { data: [], error: null };
  mockCountResult = { count: 10, error: null };
  mockUpsert.mockReturnValue({ error: null });
  (global.fetch as jest.Mock).mockReset();
  _resetCircuitBreaker();
});

// ═══════════════════════════════════════════════════════════════════════════
// formatH2HSummary — pure function, no mocks needed
// ═══════════════════════════════════════════════════════════════════════════

describe('formatH2HSummary', () => {
  it('returns "First meeting" when games array is empty', () => {
    const record = makeH2HRecord({ games: [] });
    expect(formatH2HSummary(record)).toBe('First meeting');
  });

  it('returns "Tied X-X" when teamAWins === teamBWins', () => {
    const record = makeH2HRecord({
      teamAWins: 2,
      teamBWins: 2,
      games: [makeGameResult(), makeGameResult()], // non-empty so it passes the length check
    });
    expect(formatH2HSummary(record)).toBe('Tied 2-2');
  });

  it('returns "Tied 0-0" when both teams have 0 wins but games exist', () => {
    // Edge case: games played but all draws? Shouldn't happen in NHL, but tests the branch.
    const record = makeH2HRecord({
      teamAWins: 0,
      teamBWins: 0,
      games: [makeGameResult()],
    });
    expect(formatH2HSummary(record)).toBe('Tied 0-0');
  });

  it('returns "TOR leads 3-1" when teamA leads', () => {
    const record = makeH2HRecord({
      teamA: 'TOR',
      teamB: 'MTL',
      teamAWins: 3,
      teamBWins: 1,
      games: [makeGameResult(), makeGameResult(), makeGameResult(), makeGameResult()],
    });
    expect(formatH2HSummary(record)).toBe('TOR leads 3-1');
  });

  it('returns "MTL leads 2-1" when teamB leads', () => {
    const record = makeH2HRecord({
      teamA: 'TOR',
      teamB: 'MTL',
      teamAWins: 1,
      teamBWins: 2,
      games: [makeGameResult(), makeGameResult(), makeGameResult()],
    });
    expect(formatH2HSummary(record)).toBe('MTL leads 2-1');
  });

  it('uses the correct team abbreviation in the output', () => {
    const record = makeH2HRecord({
      teamA: 'BOS',
      teamB: 'NYR',
      teamAWins: 4,
      teamBWins: 0,
      games: [makeGameResult(), makeGameResult(), makeGameResult(), makeGameResult()],
    });
    expect(formatH2HSummary(record)).toBe('BOS leads 4-0');
  });

  it('handles 1-0 leads correctly', () => {
    const record = makeH2HRecord({
      teamA: 'EDM',
      teamB: 'CGY',
      teamAWins: 0,
      teamBWins: 1,
      games: [makeGameResult()],
    });
    expect(formatH2HSummary(record)).toBe('CGY leads 1-0');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getH2HRecord — depends on Supabase
// ═══════════════════════════════════════════════════════════════════════════

describe('getH2HRecord', () => {
  it('returns an H2HRecord with correct win counts', async () => {
    const games: GameResult[] = [
      makeGameResult({ home_team: 'TOR', away_team: 'MTL', home_score: 4, away_score: 2 }), // TOR win
      makeGameResult({ home_team: 'MTL', away_team: 'TOR', home_score: 3, away_score: 5 }), // TOR win (away)
      makeGameResult({ home_team: 'MTL', away_team: 'TOR', home_score: 4, away_score: 1 }), // MTL win
    ];
    mockQueryResult = { data: games, error: null };

    const result = await getH2HRecord('TOR', 'MTL');

    expect(result).not.toBeNull();
    expect(result!.teamA).toBe('TOR');
    expect(result!.teamB).toBe('MTL');
    expect(result!.teamAWins).toBe(2);
    expect(result!.teamBWins).toBe(1);
    expect(result!.games).toHaveLength(3);
  });

  it('returns null on Supabase error', async () => {
    mockQueryResult = { data: null, error: { message: 'DB error' } };

    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
    const result = await getH2HRecord('TOR', 'MTL');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[GAME RESULTS] getH2HRecord query error:',
      'DB error',
    );
    consoleSpy.mockRestore();
  });

  it('handles empty result set (first meeting)', async () => {
    mockQueryResult = { data: [], error: null };

    const result = await getH2HRecord('SEA', 'UTA');

    expect(result).not.toBeNull();
    expect(result!.teamAWins).toBe(0);
    expect(result!.teamBWins).toBe(0);
    expect(result!.games).toHaveLength(0);
  });

  it('handles null data gracefully (treats as empty)', async () => {
    mockQueryResult = { data: null, error: null };

    const result = await getH2HRecord('TOR', 'MTL');

    expect(result).not.toBeNull();
    expect(result!.teamAWins).toBe(0);
    expect(result!.teamBWins).toBe(0);
    expect(result!.games).toHaveLength(0);
  });

  it('passes the correct season to Supabase when provided', async () => {
    mockQueryResult = { data: [], error: null };

    await getH2HRecord('TOR', 'MTL', '20232024');

    // The first .eq() call should receive 'season' and the provided season string
    expect(mockEq).toHaveBeenCalledWith('season', '20232024');
  });

  it('queries Supabase from game_results table', async () => {
    mockQueryResult = { data: [], error: null };

    await getH2HRecord('TOR', 'MTL');

    expect(mockFrom).toHaveBeenCalledWith('game_results');
    expect(mockSelect).toHaveBeenCalledWith('*');
  });

  it('returns null when an exception is thrown', async () => {
    // Simulate an exception in the chain
    mockOrder.mockImplementationOnce(() => {
      throw new Error('Unexpected crash');
    });

    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
    const result = await getH2HRecord('TOR', 'MTL');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[GAME RESULTS] getH2HRecord failed:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getH2HForGames — batch query for multiple game matchups
// ═══════════════════════════════════════════════════════════════════════════

describe('getH2HForGames', () => {
  it('returns map keyed by "AWAY-HOME"', async () => {
    const supabaseGames: GameResult[] = [
      makeGameResult({ home_team: 'MTL', away_team: 'TOR', home_score: 2, away_score: 5 }), // TOR win
    ];
    mockQueryResult = { data: supabaseGames, error: null };

    const tonightGames = [
      { homeTeam: { abbrev: 'MTL' }, awayTeam: { abbrev: 'TOR' } },
    ];

    const result = await getH2HForGames(tonightGames);

    expect(result).toBeInstanceOf(Map);
    expect(result.has('TOR-MTL')).toBe(true);

    const record = result.get('TOR-MTL')!;
    expect(record.teamA).toBe('TOR'); // away team
    expect(record.teamB).toBe('MTL'); // home team
    expect(record.teamAWins).toBe(1);
    expect(record.teamBWins).toBe(0);
  });

  it('returns empty map for empty games array', async () => {
    const result = await getH2HForGames([]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    // Should not call supabase at all
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns empty map on Supabase error', async () => {
    mockQueryResult = { data: null, error: { message: 'Query failed' } };

    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
    const tonightGames = [
      { homeTeam: { abbrev: 'MTL' }, awayTeam: { abbrev: 'TOR' } },
    ];

    const result = await getH2HForGames(tonightGames);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[GAME RESULTS] getH2HForGames query error:',
      'Query failed',
    );
    consoleSpy.mockRestore();
  });

  it('handles multiple games in a single batch', async () => {
    const supabaseGames: GameResult[] = [
      makeGameResult({ home_team: 'MTL', away_team: 'TOR', home_score: 2, away_score: 5 }),
      makeGameResult({ home_team: 'BOS', away_team: 'NYR', home_score: 3, away_score: 1 }),
    ];
    mockQueryResult = { data: supabaseGames, error: null };

    const tonightGames = [
      { homeTeam: { abbrev: 'MTL' }, awayTeam: { abbrev: 'TOR' } },
      { homeTeam: { abbrev: 'BOS' }, awayTeam: { abbrev: 'NYR' } },
    ];

    const result = await getH2HForGames(tonightGames);

    expect(result.size).toBe(2);
    expect(result.has('TOR-MTL')).toBe(true);
    expect(result.has('NYR-BOS')).toBe(true);
  });

  it('returns empty map when an exception is thrown', async () => {
    mockOrder.mockImplementationOnce(() => {
      throw new Error('Network failure');
    });

    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
    const tonightGames = [
      { homeTeam: { abbrev: 'MTL' }, awayTeam: { abbrev: 'TOR' } },
    ];

    const result = await getH2HForGames(tonightGames);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[GAME RESULTS] getH2HForGames failed:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it('correctly counts wins for the away team in the key', async () => {
    // Two games: TOR wins both (once at home, once away)
    const supabaseGames: GameResult[] = [
      makeGameResult({ home_team: 'MTL', away_team: 'TOR', home_score: 1, away_score: 3 }), // TOR away win
      makeGameResult({ home_team: 'TOR', away_team: 'MTL', home_score: 4, away_score: 2 }), // TOR home win
    ];
    mockQueryResult = { data: supabaseGames, error: null };

    const tonightGames = [
      { homeTeam: { abbrev: 'MTL' }, awayTeam: { abbrev: 'TOR' } },
    ];

    const result = await getH2HForGames(tonightGames);
    const record = result.get('TOR-MTL')!;

    // TOR is teamA (away in tonight's game), should have 2 wins
    expect(record.teamAWins).toBe(2);
    expect(record.teamBWins).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// seedCurrentSeason — smoke test with mocked fetch + Supabase
// ═══════════════════════════════════════════════════════════════════════════

describe('seedCurrentSeason', () => {
  it('does not crash and returns 0 when NHL API returns no games', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ games: [] }),
    });

    const result = await seedCurrentSeason();

    expect(result).toBe(0);
  });

  it('processes FINAL games and upserts to Supabase', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          games: [
            {
              id: 2024020001,
              gameDate: '2024-11-01',
              startTimeUTC: '2024-11-01T23:00:00Z',
              gameState: 'FINAL',
              homeTeam: { id: 1, abbrev: 'TOR', score: 4 },
              awayTeam: { id: 2, abbrev: 'MTL', score: 2 },
            },
            {
              id: 2024020002,
              gameDate: '2024-11-01',
              startTimeUTC: '2024-11-01T23:00:00Z',
              gameState: 'FUT', // Future game - should be skipped
              homeTeam: { id: 1, abbrev: 'TOR', score: 0 },
              awayTeam: { id: 3, abbrev: 'BOS', score: 0 },
            },
          ],
        }),
    });

    const result = await seedCurrentSeason();

    // 32 teams fetched, each returning 1 FINAL game with the same ID -> map deduplicates
    expect(mockUpsert).toHaveBeenCalled();
    expect(result).toBeGreaterThan(0);
  });

  it('calls onProgress callback for each team', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ games: [] }),
    });

    const onProgress = jest.fn();
    await seedCurrentSeason(onProgress);

    // Should be called 32 times (once per team)
    expect(onProgress).toHaveBeenCalledTimes(32);
    expect(onProgress).toHaveBeenCalledWith(expect.any(String), expect.any(Number), 32);
  }, 30000);

  it('returns 0 on Supabase upsert error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          games: [
            {
              id: 2024020001,
              gameDate: '2024-11-01',
              startTimeUTC: '2024-11-01T23:00:00Z',
              gameState: 'FINAL',
              homeTeam: { id: 1, abbrev: 'TOR', score: 4 },
              awayTeam: { id: 2, abbrev: 'MTL', score: 2 },
            },
          ],
        }),
    });

    mockUpsert.mockReturnValueOnce({ error: { message: 'upsert failed' } });

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const result = await seedCurrentSeason();

    expect(result).toBe(0);
    consoleSpy.mockRestore();
  });

  it('continues processing when a single team fetch fails', async () => {
    let callCount = 0;
    (global.fetch as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ games: [] }),
      });
    });

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const result = await seedCurrentSeason();

    // Should still complete without throwing
    expect(result).toBe(0); // no FINAL games
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[GAME RESULTS] Failed to fetch schedule for'),
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  }, 30000);
});

// ═══════════════════════════════════════════════════════════════════════════
// syncRecentResults — smoke test with mocked fetch + Supabase
// ═══════════════════════════════════════════════════════════════════════════

describe('syncRecentResults', () => {
  it('does not crash with empty API responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ games: [] }),
    });

    await expect(syncRecentResults()).resolves.toBeUndefined();
  });

  it('fetches scores for yesterday and today', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ games: [] }),
    });

    await syncRecentResults();

    // Should be called twice: once for yesterday, once for today
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('https://api-web.nhle.com/v1/score/');
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('https://api-web.nhle.com/v1/score/');
  });

  it('upserts FINAL games to Supabase', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          games: [
            {
              id: 2024020500,
              gameDate: '2024-12-01',
              startTimeUTC: '2024-12-01T23:00:00Z',
              gameState: 'FINAL',
              homeTeam: { id: 1, abbrev: 'TOR', score: 3 },
              awayTeam: { id: 2, abbrev: 'MTL', score: 1 },
            },
          ],
        }),
    });

    await syncRecentResults();

    expect(mockFrom).toHaveBeenCalledWith('game_results');
    expect(mockUpsert).toHaveBeenCalled();
  });

  it('skips non-FINAL games', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          games: [
            {
              id: 2024020500,
              gameDate: '2024-12-01',
              startTimeUTC: '2024-12-01T23:00:00Z',
              gameState: 'LIVE',
              homeTeam: { id: 1, abbrev: 'TOR', score: 2 },
              awayTeam: { id: 2, abbrev: 'MTL', score: 1 },
            },
          ],
        }),
    });

    await syncRecentResults();

    // Should not upsert since no FINAL games
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('does not crash when fetch throws', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network down'));

    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
    await expect(syncRecentResults()).resolves.toBeUndefined();
    consoleSpy.mockRestore();
  });

  it('handles Supabase upsert error gracefully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          games: [
            {
              id: 2024020500,
              gameDate: '2024-12-01',
              startTimeUTC: '2024-12-01T23:00:00Z',
              gameState: 'OFF',
              homeTeam: { id: 1, abbrev: 'TOR', score: 3 },
              awayTeam: { id: 2, abbrev: 'MTL', score: 1 },
            },
          ],
        }),
    });

    mockUpsert.mockReturnValueOnce({ error: { message: 'upsert failed' } });

    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
    await expect(syncRecentResults()).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[GAME RESULTS] syncRecentResults upsert error:',
      'upsert failed',
    );
    consoleSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// fetchGameResults — fetches all game results for current season
// ═══════════════════════════════════════════════════════════════════════════

describe('fetchGameResults', () => {
  it('returns game results from Supabase', async () => {
    const games = [
      makeGameResult({ game_id: 2024020100 }),
      makeGameResult({ game_id: 2024020101 }),
    ];
    mockQueryResult = { data: games, error: null };

    const result = await fetchGameResults();

    expect(result).toHaveLength(2);
    expect(mockFrom).toHaveBeenCalledWith('game_results');
    expect(mockSelect).toHaveBeenCalledWith('*');
  });

  it('returns empty array on Supabase error', async () => {
    mockQueryResult = { data: null, error: { message: 'Connection refused' } };

    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
    const result = await fetchGameResults();

    expect(result).toEqual([]);
    consoleSpy.mockRestore();
  });

  it('returns empty array when data is null without error', async () => {
    mockQueryResult = { data: null, error: null };

    const result = await fetchGameResults();

    expect(result).toEqual([]);
  });

  it('returns empty array on exception', async () => {
    mockLimit.mockImplementationOnce(() => {
      throw new Error('Unexpected error');
    });

    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
    const result = await fetchGameResults();

    expect(result).toEqual([]);
    consoleSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Circuit breaker behavior
// ═══════════════════════════════════════════════════════════════════════════

describe('circuit breaker', () => {
  it('returns null/empty after 3 consecutive Supabase failures', async () => {
    // Trigger 3 failures via getH2HRecord
    mockQueryResult = { data: null, error: { message: 'DB down' } };
    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

    await getH2HRecord('TOR', 'MTL');
    await getH2HRecord('TOR', 'MTL');
    await getH2HRecord('TOR', 'MTL');

    // 4th call should be short-circuited — Supabase not even called
    mockFrom.mockClear();
    const result = await getH2HRecord('TOR', 'MTL');

    expect(result).toBeNull();
    // mockFrom should NOT have been called since circuit breaker is open
    expect(mockFrom).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('resets after _resetCircuitBreaker is called', async () => {
    mockQueryResult = { data: null, error: { message: 'DB down' } };
    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

    // Trigger 3 failures
    await getH2HRecord('TOR', 'MTL');
    await getH2HRecord('TOR', 'MTL');
    await getH2HRecord('TOR', 'MTL');

    // Reset
    _resetCircuitBreaker();

    // Should call Supabase again
    mockQueryResult = { data: [], error: null };
    mockFrom.mockClear();
    const result = await getH2HRecord('TOR', 'MTL');

    expect(result).not.toBeNull();
    expect(mockFrom).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('resets on a successful call after failures', async () => {
    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

    // 2 failures (not enough to trip breaker)
    mockQueryResult = { data: null, error: { message: 'DB down' } };
    await getH2HRecord('TOR', 'MTL');
    await getH2HRecord('TOR', 'MTL');

    // 1 success — should reset counter
    mockQueryResult = { data: [], error: null };
    await getH2HRecord('TOR', 'MTL');

    // 1 failure — counter should be at 1, not 3
    mockQueryResult = { data: null, error: { message: 'DB down again' } };
    mockFrom.mockClear();
    await getH2HRecord('TOR', 'MTL');

    // Should still call Supabase (breaker not tripped)
    expect(mockFrom).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('circuit breaker affects fetchGameResults too', async () => {
    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

    // Trigger circuit breaker via H2H errors
    mockQueryResult = { data: null, error: { message: 'DB down' } };
    await getH2HRecord('TOR', 'MTL');
    await getH2HRecord('TOR', 'MTL');
    await getH2HRecord('TOR', 'MTL');

    // fetchGameResults should return empty without calling Supabase
    mockFrom.mockClear();
    const result = await fetchGameResults();

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('circuit breaker affects getH2HForGames too', async () => {
    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

    // Trigger circuit breaker
    mockQueryResult = { data: null, error: { message: 'DB down' } };
    await getH2HRecord('TOR', 'MTL');
    await getH2HRecord('TOR', 'MTL');
    await getH2HRecord('TOR', 'MTL');

    // getH2HForGames should return empty map without calling Supabase
    mockFrom.mockClear();
    const result = await getH2HForGames([
      { homeTeam: { abbrev: 'MTL' }, awayTeam: { abbrev: 'TOR' } },
    ]);

    expect(result.size).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// syncRecentResults — full seed when table is empty
// ═══════════════════════════════════════════════════════════════════════════

describe('syncRecentResults — empty table triggers full seed', () => {
  it('triggers full season seed when count is 0', async () => {
    // Mock the count check to return 0
    mockCountResult = { count: 0, error: null };

    // Mock fetch for the full seed (32 teams)
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ games: [] }),
    });

    await syncRecentResults();

    // Should have called fetch 32 times (once per team for full seed)
    expect(global.fetch).toHaveBeenCalledTimes(32);
  }, 30000);

  it('does not trigger full seed when count > 0', async () => {
    mockCountResult = { count: 500, error: null };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ games: [] }),
    });

    await syncRecentResults();

    // Should have called fetch only twice (yesterday + today)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns early when count check fails', async () => {
    mockCountResult = { count: null, error: { message: 'Permission denied' } };

    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
    await syncRecentResults();

    // Should not fetch any games
    expect(global.fetch).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
