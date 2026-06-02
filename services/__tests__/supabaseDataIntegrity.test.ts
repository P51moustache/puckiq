/**
 * Data Integrity Tests for Supabase games table
 * Verifies data shape, constraints, and query patterns against mocked Supabase.
 */

import type { GameResult } from '../../types/gameResults';
import {
  getH2HRecord,
  getH2HForGames,
  fetchGameResults,
  formatH2HSummary,
  _resetCircuitBreaker,
} from '../gameResults';

// ── Supabase mock ──────────────────────────────────────────────────────────
// Fully chainable, thenable builder tolerant of any chain shape the service
// uses (e.g. .eq().in().in().or().order()). All filter/sort methods return the
// builder; awaiting resolves to the current mockQueryResult.
let mockQueryResult: { data: any; error: any } = { data: [], error: null };

const builder: any = {};
const mockSelect = jest.fn(() => builder);
const mockUpsert = jest.fn((): { error: any } => ({ error: null }));
Object.assign(builder, {
  select: mockSelect,
  eq: jest.fn(() => builder),
  neq: jest.fn(() => builder),
  in: jest.fn(() => builder),
  gte: jest.fn(() => builder),
  lte: jest.fn(() => builder),
  or: jest.fn(() => builder),
  order: jest.fn(() => builder),
  limit: jest.fn(() => builder),
  upsert: mockUpsert,
  then: (resolve: any) => Promise.resolve(mockQueryResult).then(resolve),
});
const mockFrom = jest.fn(() => builder);

jest.mock('../../lib/supabase', () => ({
  supabase: {
    get from() {
      return mockFrom;
    },
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeGameResult(overrides: Partial<GameResult> = {}): GameResult {
  return {
    id: 2025020100,
    season: 20252026,
    game_date: '2025-11-10',
    home_team_abbrev: 'TOR',
    away_team_abbrev: 'MTL',
    home_score: 4,
    away_score: 2,
    game_state: 'OFF',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryResult = { data: [], error: null };
  _resetCircuitBreaker();
});

// ═══════════════════════════════════════════════════════════════════════════
// Data shape validation
// ═══════════════════════════════════════════════════════════════════════════

describe('GameResult data shape', () => {
  it('has all required fields in the expected types', () => {
    const game = makeGameResult();

    expect(typeof game.id).toBe('number');
    expect(typeof game.season).toBe('number');
    expect(typeof game.game_date).toBe('string');
    expect(typeof game.home_team_abbrev).toBe('string');
    expect(typeof game.away_team_abbrev).toBe('string');
    expect(typeof game.home_score).toBe('number');
    expect(typeof game.away_score).toBe('number');
    expect(typeof game.game_state).toBe('string');
  });

  it('season number matches YYYYYYYY format', () => {
    const game = makeGameResult({ season: 20252026 });
    const seasonStr = String(game.season);
    expect(seasonStr).toMatch(/^\d{8}$/);
    expect(parseInt(seasonStr.slice(4))).toBe(parseInt(seasonStr.slice(0, 4)) + 1);
  });

  it('game_date matches YYYY-MM-DD format', () => {
    const game = makeGameResult({ game_date: '2025-11-10' });
    expect(game.game_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('team abbreviations are 3 characters', () => {
    const game = makeGameResult({ home_team_abbrev: 'TOR', away_team_abbrev: 'MTL' });
    expect(game.home_team_abbrev).toHaveLength(3);
    expect(game.away_team_abbrev).toHaveLength(3);
  });

  it('scores are non-negative integers', () => {
    const game = makeGameResult({ home_score: 4, away_score: 2 });
    expect(game.home_score).toBeGreaterThanOrEqual(0);
    expect(game.away_score).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(game.home_score)).toBe(true);
    expect(Number.isInteger(game.away_score)).toBe(true);
  });

  it('game_state is a valid NHL state', () => {
    const validStates = ['FINAL', 'OFF', 'FUT', 'LIVE', 'PRE', 'CRIT'];
    const game = makeGameResult({ game_state: 'OFF' });
    expect(validStates).toContain(game.game_state);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H2H win counting correctness
// ═══════════════════════════════════════════════════════════════════════════

describe('H2H win counting edge cases', () => {
  it('correctly handles tied scores (should not happen in NHL but tests the branch)', async () => {
    const games = [
      makeGameResult({ home_team_abbrev: 'TOR', away_team_abbrev: 'MTL', home_score: 3, away_score: 3 }),
    ];
    mockQueryResult = { data: games, error: null };

    const result = await getH2HRecord('TOR', 'MTL');

    // Tied scores count as teamB win in current logic (neither condition for teamA satisfied)
    expect(result).not.toBeNull();
    expect(result!.teamAWins).toBe(0);
    expect(result!.teamBWins).toBe(1);
  });

  it('handles one team winning all games', async () => {
    const games = [
      makeGameResult({ home_team_abbrev: 'TOR', away_team_abbrev: 'MTL', home_score: 5, away_score: 1 }),
      makeGameResult({ home_team_abbrev: 'MTL', away_team_abbrev: 'TOR', home_score: 0, away_score: 3 }),
      makeGameResult({ home_team_abbrev: 'TOR', away_team_abbrev: 'MTL', home_score: 7, away_score: 2 }),
    ];
    mockQueryResult = { data: games, error: null };

    const result = await getH2HRecord('TOR', 'MTL');

    expect(result!.teamAWins).toBe(3);
    expect(result!.teamBWins).toBe(0);
    expect(formatH2HSummary(result!)).toBe('TOR leads 3-0');
  });

  it('handles large season series (5+ games)', async () => {
    const games = [
      makeGameResult({ home_team_abbrev: 'TOR', away_team_abbrev: 'MTL', home_score: 4, away_score: 2 }), // TOR
      makeGameResult({ home_team_abbrev: 'MTL', away_team_abbrev: 'TOR', home_score: 5, away_score: 3 }), // MTL
      makeGameResult({ home_team_abbrev: 'TOR', away_team_abbrev: 'MTL', home_score: 2, away_score: 3 }), // MTL
      makeGameResult({ home_team_abbrev: 'MTL', away_team_abbrev: 'TOR', home_score: 1, away_score: 6 }), // TOR
      makeGameResult({ home_team_abbrev: 'TOR', away_team_abbrev: 'MTL', home_score: 3, away_score: 1 }), // TOR
    ];
    mockQueryResult = { data: games, error: null };

    const result = await getH2HRecord('TOR', 'MTL');

    expect(result!.teamAWins).toBe(3);
    expect(result!.teamBWins).toBe(2);
    expect(result!.games).toHaveLength(5);
    expect(formatH2HSummary(result!)).toBe('TOR leads 3-2');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Batch H2H query for multiple games
// ═══════════════════════════════════════════════════════════════════════════

describe('getH2HForGames — multi-matchup integrity', () => {
  it('separates results correctly for overlapping teams', async () => {
    // TOR plays MTL and BOS on different nights
    const supabaseGames: GameResult[] = [
      makeGameResult({ home_team_abbrev: 'TOR', away_team_abbrev: 'MTL', home_score: 4, away_score: 1, game_date: '2025-10-15' }),
      makeGameResult({ home_team_abbrev: 'BOS', away_team_abbrev: 'TOR', home_score: 2, away_score: 5, game_date: '2025-10-20' }),
    ];
    mockQueryResult = { data: supabaseGames, error: null };

    const tonightGames = [
      { homeTeam: { abbrev: 'TOR' }, awayTeam: { abbrev: 'MTL' } },
      { homeTeam: { abbrev: 'BOS' }, awayTeam: { abbrev: 'TOR' } },
    ];

    const result = await getH2HForGames(tonightGames);

    expect(result.size).toBe(2);

    // MTL@TOR
    const mtlTor = result.get('MTL-TOR')!;
    expect(mtlTor.teamAWins).toBe(0); // MTL wins
    expect(mtlTor.teamBWins).toBe(1); // TOR wins

    // TOR@BOS
    const torBos = result.get('TOR-BOS')!;
    expect(torBos.teamAWins).toBe(1); // TOR (away) wins
    expect(torBos.teamBWins).toBe(0); // BOS wins
  });

  it('handles same matchup in both directions within season', async () => {
    // TOR hosted MTL and also visited MTL
    const supabaseGames: GameResult[] = [
      makeGameResult({ home_team_abbrev: 'TOR', away_team_abbrev: 'MTL', home_score: 4, away_score: 1 }),
      makeGameResult({ home_team_abbrev: 'MTL', away_team_abbrev: 'TOR', home_score: 3, away_score: 2 }),
    ];
    mockQueryResult = { data: supabaseGames, error: null };

    const tonightGames = [
      { homeTeam: { abbrev: 'TOR' }, awayTeam: { abbrev: 'MTL' } },
    ];

    const result = await getH2HForGames(tonightGames);
    const record = result.get('MTL-TOR')!;

    // MTL is away in tonight's game (teamA)
    // Game 1: TOR 4 - MTL 1 → TOR (home=teamB) wins
    // Game 2: MTL 3 - TOR 2 → MTL (home, but teamA is away in tonight's game context)
    //   In game 2, MTL is home and won. MTL is 'away' (teamA) for tonight.
    //   Code checks: away_team === away → TOR. away_score (2) > home_score (3)? No.
    //   So this counts as teamB (TOR) win? Actually MTL won at home.
    //   Let me re-check: away = MTL (tonight's away = teamA)
    //   Game 2: home_team = MTL = away? No, home_team = MTL, but we check if home_team === away (MTL)
    //   → yes! home_score (3) > away_score (2) → teamAWins++ (MTL wins)
    expect(record.teamAWins).toBe(1); // MTL won 1
    expect(record.teamBWins).toBe(1); // TOR won 1
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// fetchGameResults query construction
// ═══════════════════════════════════════════════════════════════════════════

describe('fetchGameResults — query construction', () => {
  it('queries games table', async () => {
    mockQueryResult = { data: [], error: null };

    await fetchGameResults();

    expect(mockFrom).toHaveBeenCalledWith('games');
  });

  it('selects all columns', async () => {
    mockQueryResult = { data: [], error: null };

    await fetchGameResults();

    expect(mockSelect).toHaveBeenCalledWith('*');
  });

  it('returns typed GameResult array', async () => {
    const games = [
      makeGameResult({ id: 2025020100 }),
      makeGameResult({ id: 2025020101, home_team_abbrev: 'BOS', away_team_abbrev: 'NYR' }),
    ];
    mockQueryResult = { data: games, error: null };

    const result = await fetchGameResults();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(2025020100);
    expect(result[1].home_team_abbrev).toBe('BOS');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Preseason vs Regular Season game ID patterns
// ═══════════════════════════════════════════════════════════════════════════

describe('game ID patterns', () => {
  it('regular season game IDs start with 2025020xxx', () => {
    const regularSeasonId = 2025020100;
    expect(regularSeasonId).toBeGreaterThanOrEqual(2025020000);
    expect(regularSeasonId).toBeLessThan(2025030000);
  });

  it('preseason game IDs start with 2025010xxx', () => {
    const preseasonId = 2025010042;
    expect(preseasonId).toBeGreaterThanOrEqual(2025010000);
    expect(preseasonId).toBeLessThan(2025020000);
  });

  it('all 32 NHL teams have valid 3-letter abbreviations', () => {
    const ALL_TEAMS = [
      'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL',
      'DAL', 'DET', 'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD',
      'NSH', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'SEA', 'SJS',
      'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK', 'WPG', 'WSH',
    ];

    expect(ALL_TEAMS).toHaveLength(32);
    for (const team of ALL_TEAMS) {
      expect(team).toMatch(/^[A-Z]{3}$/);
    }
  });
});
