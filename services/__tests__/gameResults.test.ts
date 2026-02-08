/**
 * Tests for Game Results Service
 */

import type { GameResult, H2HRecord } from '../../types/gameResults';
import {
  formatH2HSummary,
  getH2HRecord,
  getH2HForGames,
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
    id: 2024020100,
    season: 20242025,
    game_date: '2024-11-10',
    home_team_abbrev: 'TOR',
    away_team_abbrev: 'MTL',
    home_score: 4,
    away_score: 2,
    game_state: 'FINAL',
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
      makeGameResult({ home_team_abbrev: 'TOR', away_team_abbrev: 'MTL', home_score: 4, away_score: 2 }), // TOR win
      makeGameResult({ home_team_abbrev: 'MTL', away_team_abbrev: 'TOR', home_score: 3, away_score: 5 }), // TOR win (away)
      makeGameResult({ home_team_abbrev: 'MTL', away_team_abbrev: 'TOR', home_score: 4, away_score: 1 }), // MTL win
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

    await getH2HRecord('TOR', 'MTL', 20232024);

    // The first .eq() call should receive 'season' and the provided season number
    expect(mockEq).toHaveBeenCalledWith('season', 20232024);
  });

  it('queries Supabase from games table', async () => {
    mockQueryResult = { data: [], error: null };

    await getH2HRecord('TOR', 'MTL');

    expect(mockFrom).toHaveBeenCalledWith('games');
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
      makeGameResult({ home_team_abbrev: 'MTL', away_team_abbrev: 'TOR', home_score: 2, away_score: 5 }), // TOR win
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
      makeGameResult({ home_team_abbrev: 'MTL', away_team_abbrev: 'TOR', home_score: 2, away_score: 5 }),
      makeGameResult({ home_team_abbrev: 'BOS', away_team_abbrev: 'NYR', home_score: 3, away_score: 1 }),
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
      makeGameResult({ home_team_abbrev: 'MTL', away_team_abbrev: 'TOR', home_score: 1, away_score: 3 }), // TOR away win
      makeGameResult({ home_team_abbrev: 'TOR', away_team_abbrev: 'MTL', home_score: 4, away_score: 2 }), // TOR home win
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
// fetchGameResults — fetches all game results for current season
// ═══════════════════════════════════════════════════════════════════════════

describe('fetchGameResults', () => {
  it('returns game results from Supabase', async () => {
    const games = [
      makeGameResult({ id: 2024020100 }),
      makeGameResult({ id: 2024020101 }),
    ];
    mockQueryResult = { data: games, error: null };

    const result = await fetchGameResults();

    expect(result).toHaveLength(2);
    expect(mockFrom).toHaveBeenCalledWith('games');
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

