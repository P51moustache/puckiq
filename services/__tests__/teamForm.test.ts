/**
 * Tests for services/teamForm.ts (Supabase-only)
 * Tests: determineResult, computeStreak, fetchTeamForm (Supabase), caching, error handling
 */

import {
  fetchTeamForm,
  clearTeamFormCache,
  _internals,
} from '../teamForm';
import { supabase } from '../../lib/supabase';

// ---------------------------------------------------------------------------
// Helper: build a mock Supabase row matching the games table schema
// ---------------------------------------------------------------------------

function makeGameRow(
  homeAbbrev: string,
  awayAbbrev: string,
  homeScore: number,
  awayScore: number,
  gameDate: string,
  periodType: string = 'REG',
  gameState: string = 'FINAL',
) {
  return {
    game_date: gameDate,
    game_state: gameState,
    home_team_abbrev: homeAbbrev,
    away_team_abbrev: awayAbbrev,
    home_score: homeScore,
    away_score: awayScore,
    period_type: periodType,
  };
}

// ---------------------------------------------------------------------------
// Helper: build a game object in the shape determineResult expects
// ---------------------------------------------------------------------------

function makeGame(
  homeAbbrev: string,
  awayAbbrev: string,
  homeScore: number,
  awayScore: number,
  gameDate: string,
  lastPeriodType: string = 'REG',
) {
  return {
    gameDate,
    homeTeam: { abbrev: homeAbbrev, score: homeScore },
    awayTeam: { abbrev: awayAbbrev, score: awayScore },
    gameOutcome: { lastPeriodType },
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let mockQueryResult: { data: any; error: any } = { data: [], error: null };

beforeEach(() => {
  clearTeamFormCache();
  (supabase.from as jest.Mock).mockClear();
  mockQueryResult = { data: [], error: null };

  // Build a chainable mock for Supabase games query
  const buildChain = () => {
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
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
// determineResult (internal)
// ---------------------------------------------------------------------------

describe('determineResult', () => {
  const { determineResult } = _internals;

  it('returns W when team wins at home', () => {
    const game = makeGame('TOR', 'MTL', 4, 2, '2026-01-20');
    expect(determineResult(game, 'TOR')).toBe('W');
  });

  it('returns W when team wins on the road', () => {
    const game = makeGame('MTL', 'TOR', 2, 5, '2026-01-20');
    expect(determineResult(game, 'TOR')).toBe('W');
  });

  it('returns L when team loses in regulation', () => {
    const game = makeGame('TOR', 'MTL', 1, 3, '2026-01-20');
    expect(determineResult(game, 'TOR')).toBe('L');
  });

  it('returns OTL when team loses in OT', () => {
    const game = makeGame('TOR', 'MTL', 2, 3, '2026-01-20', 'OT');
    expect(determineResult(game, 'TOR')).toBe('OTL');
  });

  it('returns OTL when team loses in SO', () => {
    const game = makeGame('TOR', 'MTL', 2, 3, '2026-01-20', 'SO');
    expect(determineResult(game, 'TOR')).toBe('OTL');
  });

  it('returns W when team wins in OT (winner is still W)', () => {
    const game = makeGame('TOR', 'MTL', 3, 2, '2026-01-20', 'OT');
    expect(determineResult(game, 'TOR')).toBe('W');
  });

  it('returns null when scores are missing', () => {
    const game = {
      gameDate: '2026-01-20',
      homeTeam: { abbrev: 'TOR', score: null },
      awayTeam: { abbrev: 'MTL', score: 2 },
      gameOutcome: { lastPeriodType: 'REG' },
    };
    expect(determineResult(game, 'TOR')).toBeNull();
  });

  it('returns null when teams are missing', () => {
    const game = { gameDate: '2026-01-20' };
    expect(determineResult(game, 'TOR')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeStreak (internal)
// ---------------------------------------------------------------------------

describe('computeStreak', () => {
  const { computeStreak } = _internals;

  it('returns W3 for three consecutive wins', () => {
    expect(computeStreak(['W', 'W', 'W', 'L', 'W'])).toBe('W3');
  });

  it('returns L2 for two consecutive losses', () => {
    expect(computeStreak(['L', 'L', 'W', 'W'])).toBe('L2');
  });

  it('returns OTL1 for a single OTL', () => {
    expect(computeStreak(['OTL', 'W', 'W'])).toBe('OTL1');
  });

  it('returns empty string for no results', () => {
    expect(computeStreak([])).toBe('');
  });

  it('returns W1 for a single game', () => {
    expect(computeStreak(['W'])).toBe('W1');
  });
});

// ---------------------------------------------------------------------------
// fetchTeamForm (Supabase-only)
// ---------------------------------------------------------------------------

describe('fetchTeamForm', () => {
  it('returns form data with correct win/loss/OTL counts from Supabase', async () => {
    mockQueryResult = {
      data: [
        makeGameRow('TOR', 'MTL', 4, 2, '2026-01-20'),        // W
        makeGameRow('TOR', 'BOS', 1, 3, '2026-01-18'),        // L
        makeGameRow('TOR', 'OTT', 2, 3, '2026-01-16', 'OT'),  // OTL
        makeGameRow('BUF', 'TOR', 1, 5, '2026-01-14'),        // W (away)
        makeGameRow('TOR', 'DET', 3, 2, '2026-01-12', 'SO'),  // W (SO)
      ],
      error: null,
    };

    const result = await fetchTeamForm('TOR');

    expect(result).not.toBeNull();
    expect(result!.teamAbbrev).toBe('TOR');
    expect(result!.results).toHaveLength(5);
    expect(result!.wins).toBe(3);
    expect(result!.losses).toBe(1);
    expect(result!.otLosses).toBe(1);
  });

  it('computes streak from results', async () => {
    mockQueryResult = {
      data: [
        makeGameRow('TOR', 'MTL', 4, 2, '2026-01-20'),
        makeGameRow('TOR', 'BOS', 3, 1, '2026-01-18'),
        makeGameRow('TOR', 'OTT', 5, 3, '2026-01-16'),
        makeGameRow('TOR', 'DET', 1, 4, '2026-01-14'),
      ],
      error: null,
    };

    const result = await fetchTeamForm('TOR');

    expect(result).not.toBeNull();
    expect(result!.streak).toBe('W3');
  });

  it('returns null when Supabase returns error', async () => {
    mockQueryResult = { data: null, error: { message: 'table not found' } };

    const result = await fetchTeamForm('TOR');
    expect(result).toBeNull();
  });

  it('returns empty form data when Supabase returns no games', async () => {
    mockQueryResult = { data: [], error: null };

    const result = await fetchTeamForm('TOR');

    expect(result).not.toBeNull();
    expect(result!.results).toHaveLength(0);
    expect(result!.wins).toBe(0);
    expect(result!.losses).toBe(0);
    expect(result!.streak).toBe('');
  });

  it('queries the Supabase games table', async () => {
    mockQueryResult = { data: [], error: null };

    await fetchTeamForm('TOR');

    expect(supabase.from).toHaveBeenCalledWith('games');
  });
});

// ---------------------------------------------------------------------------
// Cache behavior
// ---------------------------------------------------------------------------

describe('cache behavior', () => {
  it('returns cached data on second call within TTL', async () => {
    mockQueryResult = {
      data: [makeGameRow('TOR', 'MTL', 4, 2, '2026-01-20')],
      error: null,
    };

    await fetchTeamForm('TOR');
    const result = await fetchTeamForm('TOR');

    expect(result).not.toBeNull();
    // from() called only once (cached on second call)
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after cache expires', async () => {
    mockQueryResult = {
      data: [makeGameRow('TOR', 'MTL', 4, 2, '2026-01-20')],
      error: null,
    };

    await fetchTeamForm('TOR');

    // Expire cache
    const entry = _internals.cache.get('TOR');
    if (entry) entry.timestamp = Date.now() - _internals.CACHE_TTL_MS - 1;

    await fetchTeamForm('TOR');

    expect(supabase.from).toHaveBeenCalledTimes(2);
  });

  it('clearTeamFormCache removes all cached data', async () => {
    mockQueryResult = {
      data: [makeGameRow('TOR', 'MTL', 4, 2, '2026-01-20')],
      error: null,
    };

    await fetchTeamForm('TOR');
    expect(_internals.cache.size).toBeGreaterThan(0);

    clearTeamFormCache();
    expect(_internals.cache.size).toBe(0);
  });

  it('caches per team independently', async () => {
    mockQueryResult = {
      data: [makeGameRow('TOR', 'MTL', 4, 2, '2026-01-20')],
      error: null,
    };

    await fetchTeamForm('TOR');
    await fetchTeamForm('MTL');

    expect(_internals.cache.size).toBe(2);
  });
});
