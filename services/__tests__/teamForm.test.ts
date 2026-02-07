/**
 * Tests for services/teamForm.ts
 * Tests: fetch behavior, result determination, streak computation, caching, error handling
 */

import {
  fetchTeamForm,
  clearTeamFormCache,
  _internals,
} from '../teamForm';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  clearTeamFormCache();
});

// ---------------------------------------------------------------------------
// Helper: build a mock schedule game
// ---------------------------------------------------------------------------

function makeGame(
  homeAbbrev: string,
  awayAbbrev: string,
  homeScore: number,
  awayScore: number,
  gameDate: string,
  lastPeriodType: string = 'REG',
  gameState: string = 'OFF',
) {
  return {
    gameDate,
    gameState,
    homeTeam: { abbrev: homeAbbrev, score: homeScore },
    awayTeam: { abbrev: awayAbbrev, score: awayScore },
    gameOutcome: { lastPeriodType },
  };
}

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
// fetchTeamForm
// ---------------------------------------------------------------------------

describe('fetchTeamForm', () => {
  function mockScheduleResponse(games: any[]) {
    return {
      ok: true,
      json: () => Promise.resolve({ games }),
    };
  }

  it('fetches from current and previous month schedule endpoints', async () => {
    mockFetch.mockResolvedValue(mockScheduleResponse([]));

    await fetchTeamForm('TOR');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const urls = mockFetch.mock.calls.map((c: any) => c[0]);
    expect(urls[0]).toMatch(/club-schedule\/TOR\/month\/\d{4}-\d{2}/);
    expect(urls[1]).toMatch(/club-schedule\/TOR\/month\/\d{4}-\d{2}/);
  });

  it('returns form data with correct win/loss/OTL counts', async () => {
    const prevMonthGames = [
      makeGame('BUF', 'TOR', 1, 5, '2025-12-14'),       // W (away)
      makeGame('TOR', 'DET', 3, 2, '2025-12-12', 'SO'), // W (SO)
    ];
    const currentMonthGames = [
      makeGame('TOR', 'MTL', 4, 2, '2026-01-20'),       // W
      makeGame('TOR', 'BOS', 1, 3, '2026-01-18'),       // L
      makeGame('TOR', 'OTT', 2, 3, '2026-01-16', 'OT'), // OTL
    ];

    // First call = prev month, second call = current month
    mockFetch
      .mockResolvedValueOnce(mockScheduleResponse(prevMonthGames))
      .mockResolvedValueOnce(mockScheduleResponse(currentMonthGames));

    const result = await fetchTeamForm('TOR');

    expect(result).not.toBeNull();
    expect(result!.teamAbbrev).toBe('TOR');
    expect(result!.results).toHaveLength(5);
    expect(result!.wins).toBe(3);
    expect(result!.losses).toBe(1);
    expect(result!.otLosses).toBe(1);
  });

  it('limits results to 10 most recent games', async () => {
    const games = Array.from({ length: 15 }, (_, i) =>
      makeGame('TOR', 'MTL', 4, 2, `2026-01-${String(i + 1).padStart(2, '0')}`),
    );

    // prev month empty, current month has 15 games
    mockFetch
      .mockResolvedValueOnce(mockScheduleResponse([]))
      .mockResolvedValueOnce(mockScheduleResponse(games));

    const result = await fetchTeamForm('TOR');

    expect(result).not.toBeNull();
    expect(result!.results.length).toBeLessThanOrEqual(10);
  });

  it('sorts games by date descending (most recent first)', async () => {
    const games = [
      makeGame('TOR', 'MTL', 1, 3, '2026-01-10'), // L (older)
      makeGame('TOR', 'BOS', 4, 2, '2026-01-20'), // W (newer)
    ];

    mockFetch
      .mockResolvedValueOnce(mockScheduleResponse([]))
      .mockResolvedValueOnce(mockScheduleResponse(games));

    const result = await fetchTeamForm('TOR');

    expect(result).not.toBeNull();
    // Most recent game (Jan 20, W) should be first
    expect(result!.results[0]).toBe('W');
    expect(result!.results[1]).toBe('L');
  });

  it('filters out non-completed games', async () => {
    const games = [
      makeGame('TOR', 'MTL', 4, 2, '2026-01-20', 'REG', 'OFF'),    // completed
      makeGame('TOR', 'BOS', 0, 0, '2026-01-22', 'REG', 'FUT'),    // future
      makeGame('TOR', 'OTT', 2, 1, '2026-01-21', 'REG', 'LIVE'),   // live
      makeGame('TOR', 'DET', 3, 1, '2026-01-18', 'REG', 'FINAL'),  // completed
    ];

    mockFetch
      .mockResolvedValueOnce(mockScheduleResponse([]))
      .mockResolvedValueOnce(mockScheduleResponse(games));

    const result = await fetchTeamForm('TOR');

    expect(result).not.toBeNull();
    expect(result!.results).toHaveLength(2); // only OFF and FINAL
  });

  it('computes streak from results', async () => {
    const games = [
      makeGame('TOR', 'MTL', 4, 2, '2026-01-20'),
      makeGame('TOR', 'BOS', 3, 1, '2026-01-18'),
      makeGame('TOR', 'OTT', 5, 3, '2026-01-16'),
      makeGame('TOR', 'DET', 1, 4, '2026-01-14'),
    ];

    mockFetch
      .mockResolvedValueOnce(mockScheduleResponse([]))
      .mockResolvedValueOnce(mockScheduleResponse(games));

    const result = await fetchTeamForm('TOR');

    expect(result).not.toBeNull();
    expect(result!.streak).toBe('W3');
  });

  it('returns empty form data when both month fetches fail', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await fetchTeamForm('TOR');

    // Promise.allSettled handles rejections — returns empty results, not null
    expect(result).not.toBeNull();
    expect(result!.results).toHaveLength(0);
    expect(result!.wins).toBe(0);
    expect(result!.losses).toBe(0);
    expect(result!.streak).toBe('');
  });

  it('handles one month failing gracefully', async () => {
    const games = [
      makeGame('TOR', 'MTL', 4, 2, '2026-01-20'),
    ];

    // First call (prev month) fails, second (current month) succeeds
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce(mockScheduleResponse(games));

    const result = await fetchTeamForm('TOR');

    expect(result).not.toBeNull();
    expect(result!.results).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Cache behavior
// ---------------------------------------------------------------------------

describe('cache behavior', () => {
  function mockScheduleResponse(games: any[]) {
    return {
      ok: true,
      json: () => Promise.resolve({ games }),
    };
  }

  it('returns cached data on second call within TTL', async () => {
    const games = [makeGame('TOR', 'MTL', 4, 2, '2026-01-20')];
    mockFetch.mockResolvedValue(mockScheduleResponse(games));

    await fetchTeamForm('TOR');
    const result = await fetchTeamForm('TOR');

    expect(result).not.toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(2); // 2 calls for first fetch (2 months), 0 for second
  });

  it('re-fetches after cache expires', async () => {
    const games = [makeGame('TOR', 'MTL', 4, 2, '2026-01-20')];
    mockFetch.mockResolvedValue(mockScheduleResponse(games));

    await fetchTeamForm('TOR');

    // Expire cache
    const entry = _internals.cache.get('TOR');
    if (entry) entry.timestamp = Date.now() - _internals.CACHE_TTL_MS - 1;

    await fetchTeamForm('TOR');

    expect(mockFetch).toHaveBeenCalledTimes(4); // 2 months x 2 fetches
  });

  it('clearTeamFormCache removes all cached data', async () => {
    const games = [makeGame('TOR', 'MTL', 4, 2, '2026-01-20')];
    mockFetch.mockResolvedValue(mockScheduleResponse(games));

    await fetchTeamForm('TOR');
    expect(_internals.cache.size).toBeGreaterThan(0);

    clearTeamFormCache();
    expect(_internals.cache.size).toBe(0);
  });

  it('caches per team independently', async () => {
    const games = [makeGame('TOR', 'MTL', 4, 2, '2026-01-20')];
    mockFetch.mockResolvedValue(mockScheduleResponse(games));

    await fetchTeamForm('TOR');
    await fetchTeamForm('MTL');

    expect(_internals.cache.size).toBe(2);
  });
});
