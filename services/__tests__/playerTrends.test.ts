/**
 * Tests for services/playerTrends.ts (Supabase-only)
 *
 * Comprehensive coverage:
 * - getTrendingPlayers: hot/cold direction, field mapping, error handling
 * - getPlayerHitRate: threshold logic, stat categories, edge cases
 * - getPlayersPlayingTonight: game cross-referencing, matchup data
 * - getTrendingGoalies: trend classification, direction filtering
 * - getPlayerL10GameStats: chronological ordering, stat categories
 * - batchGetHitRates: parallel fetching
 * - Cache behavior: TTL, expiry, clearing, isolation
 * - _internals: constants, mapTrendingPlayer helper
 */

import {
  getTrendingPlayers,
  getPlayerHitRate,
  getPlayersPlayingTonight,
  getTrendingGoalies,
  getPlayerL10GameStats,
  getLeaderTrends,
  batchGetHitRates,
  clearTrendsCache,
  _internals,
} from '../playerTrends';
import type { StatCategory } from '../playerTrends';
import { supabase } from '../../lib/supabase';

// ---------------------------------------------------------------------------
// Mock data fixtures — realistic NHL data
// ---------------------------------------------------------------------------

const mockHotSkater = {
  player_id: 8478402,
  player_name: 'Connor McDavid',
  headshot_url: 'https://assets.nhle.com/mugs/nhl/20252026/EDM/8478402.png',
  team_abbrev: 'EDM',
  position: 'C',
  trend_label: 'HOT',
  hot_cold_score: 9.2,
  point_streak: 7,
  recent_ppg: 2.1,
  season_ppg: 1.5,
  recent_gpg: 0.8,
  season_gpg: 0.55,
  recent_shooting_pct: 0.22,
  season_shooting_pct: 0.14,
  avg_goals_5g: 1.2,
  avg_assists_5g: '1.8',   // string — Supabase numeric columns
  avg_points_5g: 3.0,
  avg_shots_5g: '5.4',     // string
  avg_goals_10g: 0.9,
  avg_points_10g: 2.4,
  games_played: 52,
  season_goals: 30,
  season_assists: 48,
  season_points: 78,
};

const mockWarmSkater = {
  player_id: 8479318,
  player_name: 'Auston Matthews',
  headshot_url: 'https://assets.nhle.com/mugs/nhl/20252026/TOR/8479318.png',
  team_abbrev: 'TOR',
  position: 'C',
  trend_label: 'WARM',
  hot_cold_score: 5.4,
  point_streak: 3,
  recent_ppg: 1.6,
  season_ppg: 1.2,
  recent_gpg: 0.7,
  season_gpg: 0.5,
  recent_shooting_pct: 0.18,
  season_shooting_pct: 0.15,
  avg_goals_5g: 0.8,
  avg_assists_5g: '0.6',
  avg_points_5g: 1.4,
  avg_shots_5g: '4.2',
  avg_goals_10g: 0.7,
  avg_points_10g: 1.3,
  games_played: 48,
  season_goals: 25,
  season_assists: 32,
  season_points: 57,
};

const mockColdSkater = {
  player_id: 8476453,
  player_name: 'Max Pacioretty',
  headshot_url: null,
  team_abbrev: 'WSH',
  position: 'LW',
  trend_label: 'COLD',
  hot_cold_score: -6.1,
  point_streak: 0,
  recent_ppg: 0.2,
  season_ppg: 0.6,
  recent_gpg: 0.0,
  season_gpg: 0.2,
  recent_shooting_pct: 0.0,
  season_shooting_pct: 0.1,
  avg_goals_5g: 0.0,
  avg_assists_5g: '0.2',
  avg_points_5g: 0.2,
  avg_shots_5g: '1.0',
  avg_goals_10g: 0.1,
  avg_points_10g: 0.3,
  games_played: 40,
  season_goals: 8,
  season_assists: 16,
  season_points: 24,
};

const mockGameSkaterStats = [
  { game_id: 2025020800, goals: 2, assists: 1, points: 3, shots_on_goal: 6, games: { game_date: '2026-02-07' } },
  { game_id: 2025020750, goals: 1, assists: 0, points: 1, shots_on_goal: 4, games: { game_date: '2026-02-05' } },
  { game_id: 2025020700, goals: 0, assists: 2, points: 2, shots_on_goal: 3, games: { game_date: '2026-02-03' } },
  { game_id: 2025020650, goals: 1, assists: 1, points: 2, shots_on_goal: 5, games: { game_date: '2026-02-01' } },
  { game_id: 2025020600, goals: 0, assists: 0, points: 0, shots_on_goal: 2, games: { game_date: '2026-01-30' } },
];

const mockTodaysGames = [
  { id: 2025020850, home_team_abbrev: 'EDM', away_team_abbrev: 'TOR', start_time_utc: '2026-02-08T01:00:00Z', game_state: 'FUT' },
  { id: 2025020851, home_team_abbrev: 'VAN', away_team_abbrev: 'CGY', start_time_utc: '2026-02-08T03:00:00Z', game_state: 'FUT' },
];

const mockGoalieRolling = [
  {
    player_id: 8479394,
    team_abbrev: 'WPG',
    starts: 30,
    avg_ga_5g: 1.8,
    save_pct_5g: 0.935,
    wins_5g: 4,
    avg_ga_10g: 2.1,
    save_pct_10g: 0.928,
    wins_10g: 7,
    season_save_pct: 0.915,
    season_avg_ga: 2.5,
    season_wins: 28,
    season_shutouts: 3,
  },
  {
    player_id: 8478048,
    team_abbrev: 'NYR',
    starts: 28,
    avg_ga_5g: 3.6,
    save_pct_5g: 0.890,
    wins_5g: 1,
    avg_ga_10g: 3.2,
    save_pct_10g: 0.895,
    wins_10g: 3,
    season_save_pct: 0.910,
    season_avg_ga: 2.7,
    season_wins: 22,
    season_shutouts: 2,
  },
];

const mockGoalieSeasonStats = [
  { player_id: 8479394, games_played: 45, wins: 28, losses: 10, ot_losses: 5, goals_against_avg: 2.5, save_pctg: 0.915 },
  { player_id: 8478048, games_played: 42, wins: 22, losses: 14, ot_losses: 4, goals_against_avg: 2.7, save_pctg: 0.910 },
];

const mockGoaliePlayers = [
  { id: 8479394, first_name: 'Connor', last_name: 'Hellebuyck', headshot_url: 'https://assets.nhle.com/mugs/nhl/20252026/WPG/8479394.png' },
  { id: 8478048, first_name: 'Igor', last_name: 'Shesterkin', headshot_url: 'https://assets.nhle.com/mugs/nhl/20252026/NYR/8478048.png' },
];

// getLeaderTrends mock data
const mockLeaderHotCold = [
  { player_id: 8478402, trend_label: 'HOT', hot_cold_score: 9.2, point_streak: 7, recent_ppg: 2.1, season_ppg: 1.5 },
  { player_id: 8479318, trend_label: 'WARM', hot_cold_score: 5.4, point_streak: 3, recent_ppg: 1.6, season_ppg: 1.2 },
];

const mockLeaderPace = [
  { player_id: 8478402, projected_goals_82: 48, projected_assists_82: 78, projected_points_82: 126, goals_per_game: 0.58, points_per_game: 1.54 },
  { player_id: 8479318, projected_goals_82: 43, projected_assists_82: 55, projected_points_82: 98, goals_per_game: 0.52, points_per_game: 1.19 },
];

// Supplementary data fixtures for skater_hot_cold and skater_rolling_stats
const mockSkaterHotColdSupp = [
  { player_id: 8478402, recent_gpg: 0.8, season_gpg: 0.55 },
  { player_id: 8479318, recent_gpg: 0.7, season_gpg: 0.5 },
  { player_id: 8476453, recent_gpg: 0.0, season_gpg: 0.2 },
];

const mockSkaterRollingSupp = [
  { player_id: 8478402, avg_shots_5g: 5.4, avg_assists_5g: 1.8 },
  { player_id: 8479318, avg_shots_5g: 4.2, avg_assists_5g: 0.6 },
  { player_id: 8476453, avg_shots_5g: 1.0, avg_assists_5g: 0.2 },
];

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let mockTrendResult: { data: any; error: any };
let mockGamesResult: { data: any; error: any };
let mockGameSkaterResult: { data: any; error: any };
let mockGoalieRollingResult: { data: any; error: any };
let mockGoalieSeasonResult: { data: any; error: any };
let mockGoaliePlayersResult: { data: any; error: any };
let mockHotColdSuppResult: { data: any; error: any };
let mockRollingSuppResult: { data: any; error: any };
let mockPaceResult: { data: any; error: any };

beforeEach(() => {
  clearTrendsCache();
  (supabase.from as jest.Mock).mockClear();

  mockTrendResult = { data: [mockHotSkater, mockWarmSkater], error: null };
  mockGamesResult = { data: mockTodaysGames, error: null };
  mockGameSkaterResult = { data: mockGameSkaterStats, error: null };
  mockGoalieRollingResult = { data: mockGoalieRolling, error: null };
  mockGoalieSeasonResult = { data: mockGoalieSeasonStats, error: null };
  mockGoaliePlayersResult = { data: mockGoaliePlayers, error: null };
  mockHotColdSuppResult = { data: mockSkaterHotColdSupp, error: null };
  mockRollingSuppResult = { data: mockSkaterRollingSupp, error: null };
  mockPaceResult = { data: mockLeaderPace, error: null };

  const getResultForTable = (table: string) => {
    // skater_hot_cold is the primary trend source now (skater_trend_summary was
    // dropped). getTrendingPlayers/getLeaderTrends both read it.
    if (table === 'skater_hot_cold') return mockTrendResult;
    if (table === 'games') return mockGamesResult;
    if (table === 'game_skater_stats') return mockGameSkaterResult;
    if (table === 'goalie_rolling_stats') return mockGoalieRollingResult;
    if (table === 'goalie_season_stats') return mockGoalieSeasonResult;
    if (table === 'players') return mockGoaliePlayersResult;
    if (table === 'skater_rolling_stats') return mockRollingSuppResult;
    if (table === 'skater_pace_projections') return mockPaceResult;
    return { data: [], error: null };
  };

  const buildChain = (table: string) => {
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      then: (resolve: any) => resolve(getResultForTable(table)),
    };
    return chain;
  };

  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    return buildChain(table);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// getTrendingPlayers
// ---------------------------------------------------------------------------

describe('getTrendingPlayers', () => {
  it('returns HOT/WARM players for direction "up"', async () => {
    mockTrendResult = { data: [mockHotSkater, mockWarmSkater], error: null };

    const result = await getTrendingPlayers('up');

    expect(result).toHaveLength(2);
    expect(result[0].playerId).toBe(8478402);
    expect(result[0].playerName).toBe('Connor McDavid');
    expect(result[0].trendLabel).toBe('HOT');
    expect(result[0].hotColdScore).toBe(9.2);
    expect(result[0].teamAbbrev).toBe('EDM');
    expect(result[0].position).toBe('C');
    expect(result[0].pointStreak).toBe(7);
    expect(result[0].headshotUrl).toBe(
      'https://assets.nhle.com/mugs/nhl/20252026/EDM/8478402.png',
    );
  });

  it('returns COLD/COOL players for direction "down"', async () => {
    mockTrendResult = { data: [mockColdSkater], error: null };

    const result = await getTrendingPlayers('down');

    expect(result).toHaveLength(1);
    expect(result[0].playerId).toBe(8476453);
    expect(result[0].trendLabel).toBe('COLD');
    expect(result[0].hotColdScore).toBe(-6.1);
  });

  it('correctly maps all fields including parsed string values', async () => {
    mockTrendResult = { data: [mockHotSkater], error: null };

    const result = await getTrendingPlayers('up');
    const player = result[0];

    // Supplementary fields from skater_rolling_stats
    expect(player.avgAssists5g).toBe(1.8);
    expect(player.avgShots5g).toBe(5.4);
    // Numeric fields mapped from the hot/cold row
    expect(player.avgGoals5g).toBe(1.2);
    expect(player.avgPoints5g).toBe(3.0);
    expect(player.avgGoals10g).toBe(0.9);
    expect(player.avgPoints10g).toBe(2.4);
    // Season totals
    expect(player.gamesPlayed).toBe(52);
    expect(player.seasonGoals).toBe(30);
    expect(player.seasonAssists).toBe(48);
    expect(player.seasonPoints).toBe(78);
    // Rate stats
    expect(player.recentPpg).toBe(2.1);
    expect(player.seasonPpg).toBe(1.5);
    // Supplementary fields from skater_hot_cold
    expect(player.recentGpg).toBe(0.8);
    expect(player.seasonGpg).toBe(0.55);
    expect(player.recentShotsPerGame).toBe(5.4); // from rolling avg_shots_5g
    expect(player.seasonShotsPerGame).toBe(0);
  });

  it('handles null headshot_url (maps to undefined)', async () => {
    mockTrendResult = { data: [mockColdSkater], error: null };

    const result = await getTrendingPlayers('down');
    expect(result[0].headshotUrl).toBeUndefined();
  });

  it('returns empty array when Supabase returns an error', async () => {
    mockTrendResult = { data: null, error: { message: 'relation does not exist' } };

    const result = await getTrendingPlayers('up');
    expect(result).toEqual([]);
  });

  it('returns empty array when Supabase returns null data', async () => {
    mockTrendResult = { data: null, error: null };

    const result = await getTrendingPlayers('up');
    expect(result).toEqual([]);
  });

  it('returns empty array when no rows match', async () => {
    mockTrendResult = { data: [], error: null };

    const result = await getTrendingPlayers('up');
    expect(result).toEqual([]);
  });

  it('respects the limit parameter', async () => {
    mockTrendResult = { data: [mockHotSkater], error: null };

    await getTrendingPlayers('up', 1);

    const fromCall = (supabase.from as jest.Mock).mock.results[0].value;
    expect(fromCall.limit).toHaveBeenCalledWith(1);
  });

  it('queries skater_hot_cold table', async () => {
    await getTrendingPlayers('up');
    expect(supabase.from).toHaveBeenCalledWith('skater_hot_cold');
  });

  it('handles missing optional fields gracefully', async () => {
    const minimalRow = {
      player_id: 1,
      player_name: null,
      headshot_url: null,
      team_abbrev: null,
      position: null,
      trend_label: 'HOT',
      hot_cold_score: null,
      point_streak: null,
      season_points: 50,
      season_ppg: 1.0,
    };
    mockTrendResult = { data: [minimalRow], error: null };

    const result = await getTrendingPlayers('up');

    expect(result[0].playerName).toBe('');
    expect(result[0].teamAbbrev).toBe('');
    expect(result[0].position).toBe('');
    expect(result[0].trendLabel).toBe('HOT');
    expect(result[0].hotColdScore).toBe(0);
    expect(result[0].pointStreak).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getPlayerHitRate
// ---------------------------------------------------------------------------

describe('getPlayerHitRate', () => {
  it('calculates hit rate correctly for goals > 0.5', async () => {
    mockGameSkaterResult = { data: mockGameSkaterStats, error: null };

    const result = await getPlayerHitRate(8478402, 'goals');

    // Games: 2, 1, 0, 1, 0 goals — 3 of 5 exceed 0.5 threshold
    expect(result.hit).toBe(3);
    expect(result.total).toBe(5);
    expect(result.rate).toBeCloseTo(0.6);
    expect(result.games).toHaveLength(5);
  });

  it('returns per-game details with exceeded flag', async () => {
    mockGameSkaterResult = { data: mockGameSkaterStats, error: null };

    const result = await getPlayerHitRate(8478402, 'goals');

    // First game (most recent): 2 goals > 0.5 threshold
    expect(result.games[0].value).toBe(2);
    expect(result.games[0].exceeded).toBe(true);
    expect(result.games[0].gameDate).toBe('2026-02-07');
    expect(result.games[0].gameId).toBe(2025020800);

    // Last game: 0 goals, not exceeded
    expect(result.games[4].value).toBe(0);
    expect(result.games[4].exceeded).toBe(false);
  });

  it('uses shots_on_goal column for "shots" category', async () => {
    mockGameSkaterResult = { data: mockGameSkaterStats, error: null };

    const result = await getPlayerHitRate(8478402, 'shots');

    // Default threshold for shots is 2.5
    // Games: 6, 4, 3, 5, 2 SOG — 4 of 5 exceed 2.5
    expect(result.hit).toBe(4);
    expect(result.total).toBe(5);
    expect(result.rate).toBeCloseTo(0.8);
  });

  it('uses custom threshold when provided', async () => {
    mockGameSkaterResult = { data: mockGameSkaterStats, error: null };

    const result = await getPlayerHitRate(8478402, 'goals', 1.5);

    // Games: 2, 1, 0, 1, 0 goals — only 1 exceeds 1.5
    expect(result.hit).toBe(1);
    expect(result.total).toBe(5);
  });

  it('returns zero result for player with no games', async () => {
    mockGameSkaterResult = { data: [], error: null };

    const result = await getPlayerHitRate(99999, 'goals');

    expect(result).toEqual({ hit: 0, total: 0, rate: 0, games: [] });
  });

  it('returns zero result when Supabase returns null data', async () => {
    mockGameSkaterResult = { data: null, error: null };

    const result = await getPlayerHitRate(8478402, 'goals');

    expect(result).toEqual({ hit: 0, total: 0, rate: 0, games: [] });
  });

  it('returns zero result on Supabase error', async () => {
    mockGameSkaterResult = { data: null, error: { message: 'timeout' } };

    const result = await getPlayerHitRate(8478402, 'goals');

    expect(result).toEqual({ hit: 0, total: 0, rate: 0, games: [] });
  });

  it('handles missing game_date gracefully', async () => {
    mockGameSkaterResult = {
      data: [{ game_id: 1, goals: 1, games: null }],
      error: null,
    };

    const result = await getPlayerHitRate(8478402, 'goals');

    expect(result.games[0].gameDate).toBe('');
  });

  it('handles missing stat value (defaults to 0)', async () => {
    mockGameSkaterResult = {
      data: [{ game_id: 1, games: { game_date: '2026-02-08' } }],
      error: null,
    };

    const result = await getPlayerHitRate(8478402, 'goals');

    expect(result.games[0].value).toBe(0);
    expect(result.games[0].exceeded).toBe(false);
  });

  it('returns empty result for invalid stat category', async () => {
    const result = await getPlayerHitRate(8478402, 'invalid' as StatCategory);

    expect(result).toEqual({ hit: 0, total: 0, rate: 0, games: [] });
    // Should not query Supabase since column lookup fails
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('queries game_skater_stats table', async () => {
    await getPlayerHitRate(8478402, 'goals');
    expect(supabase.from).toHaveBeenCalledWith('game_skater_stats');
  });

  it('caches hit rate results on success', async () => {
    mockGameSkaterResult = { data: mockGameSkaterStats, error: null };

    await getPlayerHitRate(8478402, 'goals');
    (supabase.from as jest.Mock).mockClear();

    // Second call should use cache
    const result = await getPlayerHitRate(8478402, 'goals');
    expect(supabase.from).not.toHaveBeenCalled();
    expect(result.hit).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getPlayerL10GameStats
// ---------------------------------------------------------------------------

describe('getPlayerL10GameStats', () => {
  it('returns L10 game-level stats in chronological order', async () => {
    mockGameSkaterResult = { data: mockGameSkaterStats, error: null };

    const result = await getPlayerL10GameStats(8478402, 'goals');

    // Should be reversed to chronological (oldest first)
    expect(result).toHaveLength(5);
    expect(result[0].gameDate).toBe('2026-01-30');
    expect(result[0].value).toBe(0);
    expect(result[4].gameDate).toBe('2026-02-07');
    expect(result[4].value).toBe(2);
  });

  it('returns shots_on_goal values for shots category', async () => {
    mockGameSkaterResult = { data: mockGameSkaterStats, error: null };

    const result = await getPlayerL10GameStats(8478402, 'shots');

    // Reversed: 2, 5, 3, 4, 6
    expect(result[0].value).toBe(2);
    expect(result[4].value).toBe(6);
  });

  it('returns empty array when no data', async () => {
    mockGameSkaterResult = { data: [], error: null };

    const result = await getPlayerL10GameStats(8478402, 'goals');
    expect(result).toEqual([]);
  });

  it('returns empty array on Supabase error', async () => {
    mockGameSkaterResult = { data: null, error: { message: 'error' } };

    const result = await getPlayerL10GameStats(8478402, 'goals');
    expect(result).toEqual([]);
  });

  it('returns empty array for invalid stat category', async () => {
    const result = await getPlayerL10GameStats(8478402, 'invalid' as StatCategory);

    expect(result).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getPlayersPlayingTonight
// ---------------------------------------------------------------------------

describe('getPlayersPlayingTonight', () => {
  // Helper: set up per-table mock responses for tonight's players
  function setupTonightMocks(overrides?: {
    gamesData?: any;
    gamesError?: any;
    trendData?: any;
    trendError?: any;
  }) {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: (resolve: any) => {
          if (table === 'games') {
            return resolve({
              data: overrides?.gamesData ?? mockTodaysGames,
              error: overrides?.gamesError ?? null,
            });
          }
          if (table === 'skater_hot_cold') {
            return resolve({
              data: overrides?.trendData ?? [mockHotSkater, mockWarmSkater],
              error: overrides?.trendError ?? null,
            });
          }
          return resolve({ data: [], error: null });
        },
      };
      return chain;
    });
  }

  it('returns trending players for tonight with matchup data', async () => {
    setupTonightMocks();

    const result = await getPlayersPlayingTonight();

    expect(result.length).toBeGreaterThan(0);

    // McDavid plays for EDM (home) vs TOR
    const mcdavid = result.find(p => p.playerId === 8478402);
    expect(mcdavid).toBeDefined();
    expect(mcdavid!.matchup).toBeDefined();
    expect(mcdavid!.matchup!.opponent).toBe('TOR');
    expect(mcdavid!.matchup!.isHome).toBe(true);
    expect(mcdavid!.matchup!.gameId).toBe(2025020850);

    // Matthews plays for TOR (away) at EDM
    const matthews = result.find(p => p.playerId === 8479318);
    expect(matthews).toBeDefined();
    expect(matthews!.matchup).toBeDefined();
    expect(matthews!.matchup!.opponent).toBe('EDM');
    expect(matthews!.matchup!.isHome).toBe(false);
  });

  it('returns empty array when no games today', async () => {
    setupTonightMocks({ gamesData: [] });

    const result = await getPlayersPlayingTonight();
    expect(result).toEqual([]);
  });

  it('returns empty array when games query errors', async () => {
    setupTonightMocks({ gamesData: null, gamesError: { message: 'games error' } });

    const result = await getPlayersPlayingTonight();
    expect(result).toEqual([]);
  });

  it('returns empty array when trend query errors', async () => {
    setupTonightMocks({ trendData: null, trendError: { message: 'trend error' } });

    const result = await getPlayersPlayingTonight();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getTrendingGoalies
// ---------------------------------------------------------------------------

describe('getTrendingGoalies', () => {
  it('returns HOT goalies for direction "up"', async () => {
    // Hellebuyck: save_pct_5g (0.935) - season_save_pct (0.915) = +0.020 -> HOT
    const result = await getTrendingGoalies('up');

    expect(result.length).toBeGreaterThanOrEqual(1);
    const hot = result.find(g => g.playerId === 8479394);
    expect(hot).toBeDefined();
    expect(hot!.trendLabel).toBe('HOT');
    expect(hot!.playerName).toBe('Connor Hellebuyck');
    expect(hot!.avgGa5g).toBe(1.8);
    expect(hot!.savePct5g).toBe(0.935);
    expect(hot!.wins5g).toBe(4);
    expect(hot!.gamesPlayed).toBe(45);
    expect(hot!.wins).toBe(28);
    expect(hot!.losses).toBe(10);
    expect(hot!.otLosses).toBe(5);
  });

  it('returns COLD goalies for direction "down"', async () => {
    // Shesterkin: save_pct_5g (0.890) - season_save_pct (0.910) = -0.020 -> COLD
    const result = await getTrendingGoalies('down');

    expect(result.length).toBeGreaterThanOrEqual(1);
    const cold = result.find(g => g.playerId === 8478048);
    expect(cold).toBeDefined();
    expect(cold!.trendLabel).toBe('COLD');
    expect(cold!.playerName).toBe('Igor Shesterkin');
  });

  it('does not include HOT goalies in "down" results', async () => {
    const result = await getTrendingGoalies('down');
    const hotGoalie = result.find(g => g.playerId === 8479394);
    expect(hotGoalie).toBeUndefined();
  });

  it('does not include COLD goalies in "up" results', async () => {
    const result = await getTrendingGoalies('up');
    const coldGoalie = result.find(g => g.playerId === 8478048);
    expect(coldGoalie).toBeUndefined();
  });

  it('returns empty array when no goalie rolling data', async () => {
    mockGoalieRollingResult = { data: [], error: null };

    const result = await getTrendingGoalies('up');
    expect(result).toEqual([]);
  });

  it('returns empty array on Supabase error', async () => {
    mockGoalieRollingResult = { data: null, error: { message: 'timeout' } };

    const result = await getTrendingGoalies('up');
    expect(result).toEqual([]);
  });

  it('handles missing player info gracefully', async () => {
    mockGoaliePlayersResult = { data: [], error: null };

    const result = await getTrendingGoalies('up');

    // Should still return goalies with fallback names
    const goalie = result.find(g => g.playerId === 8479394);
    if (goalie) {
      expect(goalie.playerName).toBe('Player 8479394');
      expect(goalie.firstName).toBe('');
      expect(goalie.lastName).toBe('');
      expect(goalie.headshotUrl).toBeUndefined();
    }
  });

  it('respects the limit parameter', async () => {
    const result = await getTrendingGoalies('up', 1);
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it('classifies STEADY when save pct difference is small', async () => {
    mockGoalieRollingResult = {
      data: [{
        player_id: 1,
        team_abbrev: 'BOS',
        starts: 20,
        avg_ga_5g: 2.5,
        save_pct_5g: 0.912,
        wins_5g: 3,
        avg_ga_10g: 2.4,
        save_pct_10g: 0.914,
        wins_10g: 5,
        season_save_pct: 0.910,
        season_avg_ga: 2.5,
        season_wins: 15,
        season_shutouts: 1,
      }],
      error: null,
    };
    mockGoaliePlayersResult = {
      data: [{ id: 1, first_name: 'Test', last_name: 'Goalie', headshot_url: null }],
      error: null,
    };

    // Diff = 0.912 - 0.910 = 0.002 -> STEADY (< 0.005 threshold)
    const upResult = await getTrendingGoalies('up');
    clearTrendsCache();
    const downResult = await getTrendingGoalies('down');

    // STEADY should not appear in either up or down
    expect(upResult).toEqual([]);
    expect(downResult).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// batchGetHitRates
// ---------------------------------------------------------------------------

describe('batchGetHitRates', () => {
  it('returns hit rates for multiple players', async () => {
    mockGameSkaterResult = { data: mockGameSkaterStats, error: null };

    const results = await batchGetHitRates([8478402, 8479318], 'goals');

    expect(results.size).toBe(2);
    expect(results.has(8478402)).toBe(true);
    expect(results.has(8479318)).toBe(true);
    expect(results.get(8478402)!.total).toBe(5);
  });

  it('returns empty map for empty player IDs', async () => {
    const results = await batchGetHitRates([], 'goals');
    expect(results.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cache behavior
// ---------------------------------------------------------------------------

describe('cache behavior', () => {
  it('returns cached data on second call within TTL', async () => {
    mockTrendResult = { data: [mockHotSkater], error: null };

    await getTrendingPlayers('up');
    (supabase.from as jest.Mock).mockClear();

    const result = await getTrendingPlayers('up');

    expect(result).toHaveLength(1);
    expect(result[0].playerId).toBe(8478402);
    // from() should NOT have been called again
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('re-fetches after cache is manually expired', async () => {
    mockTrendResult = { data: [mockHotSkater], error: null };

    await getTrendingPlayers('up');

    // Manually expire the cache entry
    const cacheKey = 'trending:up:10';
    const entry = _internals.trendCache.get(cacheKey);
    expect(entry).toBeDefined();
    if (entry) {
      entry.timestamp = Date.now() - _internals.CACHE_TTL - 1;
    }

    (supabase.from as jest.Mock).mockClear();
    await getTrendingPlayers('up');

    expect(supabase.from).toHaveBeenCalled();
  });

  it('clearTrendsCache removes all cached data', async () => {
    mockTrendResult = { data: [mockHotSkater], error: null };

    await getTrendingPlayers('up');
    expect(_internals.trendCache.size).toBeGreaterThan(0);

    clearTrendsCache();
    expect(_internals.trendCache.size).toBe(0);
  });

  it('different functions have separate cache entries', async () => {
    mockTrendResult = { data: [mockHotSkater], error: null };
    mockGameSkaterResult = { data: mockGameSkaterStats, error: null };

    await getTrendingPlayers('up');
    await getTrendingPlayers('down');
    await getPlayerHitRate(8478402, 'goals');

    expect(_internals.trendCache.size).toBe(3);
  });

  it('does not cache failed responses for getTrendingPlayers', async () => {
    mockTrendResult = { data: null, error: { message: 'error' } };

    await getTrendingPlayers('up');
    expect(_internals.trendCache.size).toBe(0);
  });

  it('does not cache empty hit rate results (no rows)', async () => {
    mockGameSkaterResult = { data: null, error: null };

    await getPlayerHitRate(99999, 'goals');
    expect(_internals.trendCache.size).toBe(0);
  });

  it('caches hit rate results when data exists', async () => {
    mockGameSkaterResult = { data: mockGameSkaterStats, error: null };

    await getPlayerHitRate(8478402, 'goals');
    expect(_internals.trendCache.size).toBe(1);

    (supabase.from as jest.Mock).mockClear();
    await getPlayerHitRate(8478402, 'goals');
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Internal helpers / constants
// ---------------------------------------------------------------------------

describe('_internals', () => {
  it('exposes CACHE_TTL as 5 minutes', () => {
    expect(_internals.CACHE_TTL).toBe(5 * 60 * 1000);
  });

  it('exposes STAT_COLUMN_MAP with correct column mappings', () => {
    expect(_internals.STAT_COLUMN_MAP.goals).toBe('goals');
    expect(_internals.STAT_COLUMN_MAP.assists).toBe('assists');
    expect(_internals.STAT_COLUMN_MAP.points).toBe('points');
    expect(_internals.STAT_COLUMN_MAP.shots).toBe('shots_on_goal');
  });

  it('exposes DEFAULT_THRESHOLDS with correct values', () => {
    expect(_internals.DEFAULT_THRESHOLDS.goals).toBe(0.5);
    expect(_internals.DEFAULT_THRESHOLDS.assists).toBe(0.5);
    expect(_internals.DEFAULT_THRESHOLDS.points).toBe(0.5);
    expect(_internals.DEFAULT_THRESHOLDS.shots).toBe(2.5);
  });

  it('mapTrendingPlayer splits player_name into firstName and lastName', () => {
    const mapped = _internals.mapTrendingPlayer({
      player_id: 1,
      player_name: 'Connor McDavid',
    });
    expect(mapped.firstName).toBe('Connor');
    expect(mapped.lastName).toBe('McDavid');
  });

  it('mapTrendingPlayer handles multi-word last names', () => {
    const mapped = _internals.mapTrendingPlayer({
      player_id: 1,
      player_name: 'Pierre-Luc Dubois',
    });
    expect(mapped.firstName).toBe('Pierre-Luc');
    expect(mapped.lastName).toBe('Dubois');
  });

  it('mapTrendingPlayer handles null player_name', () => {
    const mapped = _internals.mapTrendingPlayer({
      player_id: 1,
      player_name: null,
    });
    expect(mapped.firstName).toBe('');
    expect(mapped.lastName).toBe('');
    expect(mapped.playerName).toBe('');
  });

  it('mapTrendingPlayer uses gpgMap and rollingMap when provided', () => {
    const gpgMap = new Map([[1, { recentGpg: 0.9, seasonGpg: 0.6 }]]);
    const rollingMap = new Map([[1, { avgShots5g: 6.0, avgAssists5g: 2.0 }]]);

    const mapped = _internals.mapTrendingPlayer(
      { player_id: 1, player_name: 'Test Player' },
      gpgMap,
      rollingMap,
    );

    expect(mapped.recentGpg).toBe(0.9);
    expect(mapped.seasonGpg).toBe(0.6);
    expect(mapped.avgShots5g).toBe(6.0);
    expect(mapped.avgAssists5g).toBe(2.0);
    expect(mapped.recentShotsPerGame).toBe(6.0); // from rolling avgShots5g
    expect(mapped.seasonShotsPerGame).toBe(0);
  });

  it('mapTrendingPlayer defaults supplementary fields to 0 without maps', () => {
    const mapped = _internals.mapTrendingPlayer({
      player_id: 1,
      player_name: 'Test Player',
    });

    expect(mapped.recentGpg).toBe(0);
    expect(mapped.seasonGpg).toBe(0);
    expect(mapped.avgShots5g).toBe(0);
    expect(mapped.avgAssists5g).toBe(0);
    expect(mapped.recentShotsPerGame).toBe(0);
    expect(mapped.seasonShotsPerGame).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getLeaderTrends
// ---------------------------------------------------------------------------

describe('getLeaderTrends', () => {
  it('returns trend data for given player IDs', async () => {
    // getLeaderTrends queries skater_hot_cold and skater_pace_projections
    mockTrendResult = { data: mockLeaderHotCold, error: null };

    const result = await getLeaderTrends([8478402, 8479318]);

    expect(result.size).toBe(2);
    const mcdavid = result.get(8478402);
    expect(mcdavid).toBeDefined();
    expect(mcdavid!.trendLabel).toBe('HOT');
    expect(mcdavid!.hotColdScore).toBe(9.2);
    expect(mcdavid!.pointStreak).toBe(7);
    expect(mcdavid!.recentPpg).toBe(2.1);
    expect(mcdavid!.seasonPpg).toBe(1.5);
    // Pace projections
    expect(mcdavid!.projectedGoals82).toBe(48);
    expect(mcdavid!.projectedPoints82).toBe(126);
    expect(mcdavid!.goalsPerGame).toBe(0.58);
  });

  it('returns empty map for empty player IDs', async () => {
    const result = await getLeaderTrends([]);
    expect(result.size).toBe(0);
    // Should not query Supabase at all
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns pace-only data when hot/cold query errors', async () => {
    mockTrendResult = { data: null, error: { message: 'error' } };
    // Pace still succeeds — service is resilient
    const result = await getLeaderTrends([8478402]);

    // Should still populate from pace data (with STEADY defaults)
    expect(result.size).toBeGreaterThanOrEqual(1);
    const player = result.get(8478402);
    if (player) {
      expect(player.trendLabel).toBe('STEADY');
      expect(player.projectedGoals82).toBe(48);
    }
  });

  it('returns empty map when both queries error', async () => {
    mockTrendResult = { data: null, error: { message: 'error' } };
    mockPaceResult = { data: null, error: { message: 'error' } };

    const result = await getLeaderTrends([8478402]);
    expect(result.size).toBe(0);
  });

  it('handles missing pace data gracefully', async () => {
    mockTrendResult = { data: mockLeaderHotCold, error: null };
    mockPaceResult = { data: [], error: null };

    const result = await getLeaderTrends([8478402]);

    const mcdavid = result.get(8478402);
    expect(mcdavid).toBeDefined();
    expect(mcdavid!.trendLabel).toBe('HOT');
    // Pace fields should default to 0
    expect(mcdavid!.projectedGoals82).toBe(0);
    expect(mcdavid!.projectedPoints82).toBe(0);
  });

  it('caches results within TTL', async () => {
    mockTrendResult = { data: mockLeaderHotCold, error: null };

    await getLeaderTrends([8478402, 8479318]);
    (supabase.from as jest.Mock).mockClear();

    const result = await getLeaderTrends([8478402, 8479318]);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(result.size).toBe(2);
  });
});
