/**
 * Tests for services/playerDetail.ts
 *
 * Covers:
 * - getPlayerDetail: multi-table join (players, skater/goalie stats,
 *   player_career_data, edge_skater_stats, game_skater_stats)
 * - Graceful fallback when player_career_data is missing
 * - Edge IQ data inclusion when available
 * - Last 5 games join logic for skaters and goalies
 * - Cache behavior
 * - Error handling
 */

import { supabase } from '../../lib/supabase';
import { getPlayerDetail, clearDetailCache } from '../playerDetail';

// ---------------------------------------------------------------------------
// Mock data — matches Supabase column naming
// ---------------------------------------------------------------------------

const mockPlayerRow = {
  id: 8478402,
  first_name: 'Connor',
  last_name: 'McDavid',
  full_name: 'Connor McDavid',
  position: 'C',
  shoots_catches: 'L',
  height_inches: 73,
  weight_pounds: 193,
  birth_date: '1997-01-13',
  birth_city: 'Richmond Hill',
  birth_country: 'CAN',
  current_team_id: 22,
  current_team_abbrev: 'EDM',
  sweater_number: 97,
  is_active: true,
  headshot_url: 'https://assets.nhle.com/mugs/nhl/20252026/EDM/8478402.png',
  draft_year: 2015,
  draft_round: 1,
  draft_pick: 1,
  draft_overall: 1,
};

const mockSkaterSeasonRow = {
  player_id: 8478402,
  season: 20252026,
  team_abbrev: 'EDM',
  position: 'C',
  games_played: 60,
  goals: 42,
  assists: 55,
  points: 97,
  plus_minus: 28,
  pim: 18,
  power_play_goals: 15,
  shorthanded_goals: 1,
  game_winning_goals: 8,
  shots: 280,
  shooting_pctg: 0.15,
  avg_toi_per_game: 1320,
  faceoff_win_pctg: 0.52,
};

const mockCareerRow = {
  player_id: 8478402,
  season_totals: [
    { season: 20152016, gamesPlayed: 45, goals: 16, assists: 32, points: 48 },
    { season: 20162017, gamesPlayed: 82, goals: 30, assists: 70, points: 100 },
  ],
  career_totals: {
    regularSeason: { gamesPlayed: 645, goals: 335, assists: 560, points: 895 },
  },
  awards: [
    { trophy: { default: 'Hart Memorial Trophy' }, seasons: [{ seasonId: 20222023 }] },
    { trophy: { default: 'Art Ross Trophy' }, seasons: [{ seasonId: 20222023 }] },
  ],
};

const mockEdgeRow = {
  player_id: 8478402,
  max_skating_speed_mph: 24.57,
  max_skating_speed_rank: 1,
  max_skating_speed_percentile: 99,
  top_shot_speed_mph: 95.3,
  top_shot_speed_rank: 25,
  top_shot_speed_percentile: 85,
  total_distance_miles: 185.4,
  bursts_over_20: 142,
  offensive_zone_pctg: 38.5,
  neutral_zone_pctg: 31.0,
  defensive_zone_pctg: 30.5,
};

const mockRecentGameRows = [
  { game_id: 2025020801, player_id: 8478402, goals: 2, assists: 1, points: 3, plus_minus: 2, toi: '22:15', shots_on_goal: 5, hits: 1, blocked_shots: 0 },
  { game_id: 2025020802, player_id: 8478402, goals: 0, assists: 2, points: 2, plus_minus: 1, toi: '21:30', shots_on_goal: 3, hits: 2, blocked_shots: 1 },
  { game_id: 2025020803, player_id: 8478402, goals: 1, assists: 0, points: 1, plus_minus: -1, toi: '20:45', shots_on_goal: 4, hits: 0, blocked_shots: 0 },
  { game_id: 2025020804, player_id: 8478402, goals: 0, assists: 0, points: 0, plus_minus: -2, toi: '19:00', shots_on_goal: 2, hits: 3, blocked_shots: 2 },
  { game_id: 2025020805, player_id: 8478402, goals: 3, assists: 1, points: 4, plus_minus: 3, toi: '23:10', shots_on_goal: 7, hits: 1, blocked_shots: 0 },
];

// Goalie variant
const mockGoaliePlayerRow = {
  ...mockPlayerRow,
  id: 8477424,
  first_name: 'Connor',
  last_name: 'Hellebuyck',
  full_name: 'Connor Hellebuyck',
  position: 'G',
  current_team_abbrev: 'WPG',
  current_team_id: 52,
  sweater_number: 37,
  headshot_url: 'https://assets.nhle.com/mugs/nhl/20252026/WPG/8477424.png',
};

const mockGoalieSeasonRow = {
  player_id: 8477424,
  season: 20252026,
  team_abbrev: 'WPG',
  games_played: 45,
  games_started: 43,
  wins: 30,
  losses: 10,
  ot_losses: 5,
  goals_against_avg: 2.15,
  save_pctg: 0.925,
  shots_against: 1350,
  saves: 1249,
  shutouts: 4,
};

const mockGoalieRecentGames = [
  { game_id: 2025020901, player_id: 8477424, saves: 32, goals_against: 2, decision: 'W', toi: '60:00' },
];

// Trend view mock data
const mockHotColdRow = {
  player_id: 8478402,
  team_abbrev: 'EDM',
  games_played: 60,
  season_ppg: 1.617,
  recent_ppg: 2.0,
  season_gpg: 0.7,
  recent_gpg: 1.0,
  point_streak: 5,
  hot_cold_score: 1.8,
  trend_label: 'HOT',
  recent_shooting_pct: 18.5,
  season_shooting_pct: 15.0,
};

const mockPaceRow = {
  player_id: 8478402,
  team_abbrev: 'EDM',
  season: 20252026,
  games_played: 60,
  goals: 42,
  assists: 55,
  points: 97,
  shots: 280,
  pim: 18,
  power_play_goals: 15,
  game_winning_goals: 8,
  projected_goals_82: 57,
  projected_assists_82: 75,
  projected_points_82: 133,
  projected_shots_82: 383,
  projected_ppg_82: 21,
  goals_per_game: 0.7,
  points_per_game: 1.62,
  shooting_pctg: 0.15,
};

const mockRollingRow = {
  player_id: 8478402,
  team_abbrev: 'EDM',
  avg_goals_5g: 1.2,
  avg_assists_5g: 0.8,
  avg_points_5g: 2.0,
  avg_shots_5g: 4.2,
  avg_hits_5g: 1.4,
  avg_pm_5g: 0.6,
  total_goals_5g: 6,
  total_points_5g: 10,
  avg_goals_10g: 0.9,
  avg_assists_10g: 1.0,
  avg_points_10g: 1.9,
  avg_shots_10g: 4.0,
  avg_hits_10g: 1.2,
  avg_pm_10g: 0.3,
  total_goals_10g: 9,
  total_points_10g: 19,
  avg_goals_20g: 0.75,
  avg_assists_20g: 0.95,
  avg_points_20g: 1.7,
  avg_shots_20g: 3.8,
  avg_hits_20g: 1.1,
  avg_pm_20g: 0.2,
  total_goals_20g: 15,
  total_points_20g: 34,
  games_played: 60,
  season_goals: 42,
  season_assists: 55,
  season_points: 97,
  season_avg_goals: 0.7,
  season_avg_points: 1.62,
  last_game_date: '2026-02-07',
};

const mockAdvancedRow = {
  player_id: 8478402,
  team_abbrev: 'EDM',
  avg_corsi_pct_5g: 55.2,
  avg_fenwick_pct_5g: 54.8,
  avg_oz_start_5g: 62.1,
  avg_pdo_5g: 102.3,
  avg_corsi_pct_10g: 53.7,
  avg_fenwick_pct_10g: 53.2,
  avg_oz_start_10g: 60.5,
  avg_pdo_10g: 101.1,
  avg_corsi_pct_20g: 52.5,
  avg_fenwick_pct_20g: 52.0,
  avg_oz_start_20g: 59.8,
  avg_pdo_20g: 100.5,
  season_corsi_pct: 52.8,
  season_fenwick_pct: 52.3,
  season_pdo: 100.8,
  games_with_advanced: 58,
};

const mockThreeStarRows = [
  { star_number: 1 },
  { star_number: 1 },
  { star_number: 2 },
  { star_number: 3 },
];

const mockGoalieRollingRow = {
  player_id: 8477424,
  team_abbrev: 'WPG',
  avg_ga_5g: 2.0,
  save_pct_5g: 0.935,
  wins_5g: 4,
  avg_ga_10g: 2.2,
  save_pct_10g: 0.928,
  wins_10g: 7,
  starts: 43,
  season_ga: 92,
  season_sa: 1350,
  season_save_pct: 0.925,
  season_avg_ga: 2.15,
  season_wins: 30,
  season_shutouts: 4,
  last_start_date: '2026-02-06',
};

// ---------------------------------------------------------------------------
// Supabase mock — supports both .single() and list queries per table
// ---------------------------------------------------------------------------

// Track sequential calls per table to differentiate first vs second query
let tableCallCount: Record<string, number> = {};
let mockSingleResults: Record<string, { data: any; error: any }> = {};
let mockListResults: Record<string, { data: any; error: any }> = {};

function buildChain(table: string) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(() => {
      const r = mockSingleResults[table] ?? { data: null, error: null };
      return Promise.resolve(r);
    }),
    then: (resolve: any) => {
      const r = mockListResults[table] ?? { data: [], error: null };
      return resolve(r);
    },
  };
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  clearDetailCache();
  tableCallCount = {};

  // Default: McDavid skater with full data
  mockSingleResults = {
    players: { data: mockPlayerRow, error: null },
    player_career_data: { data: mockCareerRow, error: null },
  };

  mockListResults = {
    skater_season_stats: { data: [mockSkaterSeasonRow], error: null },
    goalie_season_stats: { data: [], error: null },
    edge_skater_stats: { data: [mockEdgeRow], error: null },
    game_skater_stats: { data: mockRecentGameRows, error: null },
    game_goalie_stats: { data: [], error: null },
    skater_hot_cold: { data: [mockHotColdRow], error: null },
    skater_pace_projections: { data: [mockPaceRow], error: null },
    skater_rolling_stats: { data: [mockRollingRow], error: null },
    skater_advanced_trends: { data: [mockAdvancedRow], error: null },
    game_three_stars: { data: mockThreeStarRows, error: null },
    goalie_rolling_stats: { data: [], error: null },
  };

  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    tableCallCount[table] = (tableCallCount[table] || 0) + 1;
    return buildChain(table);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ===========================================================================
// getPlayerDetail — skater
// ===========================================================================

describe('getPlayerDetail — skater', () => {
  it('returns full player detail', async () => {
    const result = await getPlayerDetail(8478402);
    expect(result).not.toBeNull();
    expect(result!.bio).toBeDefined();
    expect(result!.seasonStats).toBeDefined();
    expect(result!.career).toBeDefined();
    expect(result!.edgeStats).toBeDefined();
    expect(result!.recentGames).toBeDefined();
  });

  it('maps bio from players table', async () => {
    const result = await getPlayerDetail(8478402);
    expect(result!.bio.playerId).toBe(8478402);
    expect(result!.bio.firstName).toBe('Connor');
    expect(result!.bio.lastName).toBe('McDavid');
    expect(result!.bio.fullName).toBe('Connor McDavid');
    expect(result!.bio.position).toBe('C');
    expect(result!.bio.teamAbbrev).toBe('EDM');
    expect(result!.bio.sweaterNumber).toBe(97);
    expect(result!.bio.headshotUrl).toContain('8478402');
    expect(result!.bio.birthDate).toBe('1997-01-13');
    expect(result!.bio.birthCity).toBe('Richmond Hill');
    expect(result!.bio.birthCountry).toBe('CAN');
    expect(result!.bio.heightInches).toBe(73);
    expect(result!.bio.weightPounds).toBe(193);
    expect(result!.bio.shootsCatches).toBe('L');
  });

  it('maps draft info', async () => {
    const result = await getPlayerDetail(8478402);
    expect(result!.bio.draftYear).toBe(2015);
    expect(result!.bio.draftRound).toBe(1);
    expect(result!.bio.draftPick).toBe(1);
    expect(result!.bio.draftOverall).toBe(1);
  });

  it('maps skater season stats', async () => {
    const result = await getPlayerDetail(8478402);
    expect(result!.seasonStats.gamesPlayed).toBe(60);
    expect(result!.seasonStats.goals).toBe(42);
    expect(result!.seasonStats.assists).toBe(55);
    expect(result!.seasonStats.points).toBe(97);
    expect(result!.seasonStats.plusMinus).toBe(28);
    expect(result!.seasonStats.shots).toBe(280);
    expect(result!.seasonStats.shootingPctg).toBe(0.15);
    expect(result!.seasonStats.powerPlayGoals).toBe(15);
    expect(result!.seasonStats.gameWinningGoals).toBe(8);
    expect(result!.seasonStats.avgToi).toBe(1320);
    expect(result!.seasonStats.faceoffWinPctg).toBe(0.52);
  });

  it('maps career data', async () => {
    const result = await getPlayerDetail(8478402);
    expect(result!.career).not.toBeNull();
    expect(result!.career!.seasonTotals).toHaveLength(2);
    expect(result!.career!.careerTotals.regularSeason.gamesPlayed).toBe(645);
    expect(result!.career!.awards).toHaveLength(2);
  });

  it('maps Edge IQ stats', async () => {
    const result = await getPlayerDetail(8478402);
    expect(result!.edgeStats).not.toBeNull();
    expect(result!.edgeStats!.topSpeed).toBe(24.57);
    expect(result!.edgeStats!.topSpeedRank).toBe(1);
    expect(result!.edgeStats!.topShotSpeed).toBe(95.3);
    expect(result!.edgeStats!.totalDistance).toBe(185.4);
    expect(result!.edgeStats!.burstsOver20).toBe(142);
    expect(result!.edgeStats!.offensiveZonePctg).toBe(38.5);
  });

  it('maps last 5 games', async () => {
    const result = await getPlayerDetail(8478402);
    expect(result!.recentGames).toHaveLength(5);
    expect(result!.recentGames[0].gameId).toBe(2025020801);
    expect(result!.recentGames[0].goals).toBe(2);
    expect(result!.recentGames[0].assists).toBe(1);
    expect(result!.recentGames[0].toi).toBe('22:15');
    expect(result!.recentGames[0].shots).toBe(5);
  });

  it('queries all required tables including trend views', async () => {
    await getPlayerDetail(8478402);
    expect(supabase.from).toHaveBeenCalledWith('players');
    expect(supabase.from).toHaveBeenCalledWith('skater_season_stats');
    expect(supabase.from).toHaveBeenCalledWith('player_career_data');
    expect(supabase.from).toHaveBeenCalledWith('edge_skater_stats');
    expect(supabase.from).toHaveBeenCalledWith('game_skater_stats');
    expect(supabase.from).toHaveBeenCalledWith('skater_hot_cold');
    expect(supabase.from).toHaveBeenCalledWith('skater_pace_projections');
    expect(supabase.from).toHaveBeenCalledWith('skater_rolling_stats');
    expect(supabase.from).toHaveBeenCalledWith('skater_advanced_trends');
    expect(supabase.from).toHaveBeenCalledWith('game_three_stars');
  });
});

// ===========================================================================
// Graceful fallbacks
// ===========================================================================

describe('getPlayerDetail — graceful fallbacks', () => {
  it('returns null when player not found', async () => {
    mockSingleResults['players'] = { data: null, error: null };
    const result = await getPlayerDetail(99999);
    expect(result).toBeNull();
  });

  it('returns null when players table errors', async () => {
    mockSingleResults['players'] = { data: null, error: { message: 'not found' } };
    const result = await getPlayerDetail(99999);
    expect(result).toBeNull();
  });

  it('returns detail without career when player_career_data is empty', async () => {
    mockSingleResults['player_career_data'] = { data: null, error: null };
    const result = await getPlayerDetail(8478402);
    expect(result).not.toBeNull();
    expect(result!.bio.firstName).toBe('Connor');
    expect(result!.career).toBeNull();
  });

  it('returns detail without career when player_career_data errors', async () => {
    mockSingleResults['player_career_data'] = { data: null, error: { message: 'table missing' } };
    const result = await getPlayerDetail(8478402);
    expect(result).not.toBeNull();
    expect(result!.career).toBeNull();
  });

  it('returns detail without Edge IQ when edge_skater_stats is empty', async () => {
    mockListResults['edge_skater_stats'] = { data: [], error: null };
    const result = await getPlayerDetail(8478402);
    expect(result).not.toBeNull();
    expect(result!.edgeStats).toBeNull();
  });

  it('returns detail without Edge IQ when edge table errors', async () => {
    mockListResults['edge_skater_stats'] = { data: null, error: { message: 'unavailable' } };
    const result = await getPlayerDetail(8478402);
    expect(result).not.toBeNull();
    expect(result!.edgeStats).toBeNull();
  });

  it('returns empty recent games when game_skater_stats is empty', async () => {
    mockListResults['game_skater_stats'] = { data: [], error: null };
    const result = await getPlayerDetail(8478402);
    expect(result).not.toBeNull();
    expect(result!.recentGames).toEqual([]);
  });

  it('returns empty recent games when game_skater_stats errors', async () => {
    mockListResults['game_skater_stats'] = { data: null, error: { message: 'timeout' } };
    const result = await getPlayerDetail(8478402);
    expect(result).not.toBeNull();
    expect(result!.recentGames).toEqual([]);
  });

  it('returns default stats when season stats are empty', async () => {
    mockListResults['skater_season_stats'] = { data: [], error: null };
    const result = await getPlayerDetail(8478402);
    expect(result).not.toBeNull();
    expect(result!.seasonStats.gamesPlayed).toBe(0);
    expect(result!.seasonStats.goals).toBe(0);
    expect(result!.seasonStats.points).toBe(0);
  });
});

// ===========================================================================
// Goalie detail
// ===========================================================================

describe('getPlayerDetail — goalie', () => {
  beforeEach(() => {
    mockSingleResults['players'] = { data: mockGoaliePlayerRow, error: null };
    mockSingleResults['player_career_data'] = { data: null, error: null };
    mockListResults['skater_season_stats'] = { data: [], error: null };
    mockListResults['goalie_season_stats'] = { data: [mockGoalieSeasonRow], error: null };
    mockListResults['edge_skater_stats'] = { data: [], error: null };
    mockListResults['game_skater_stats'] = { data: [], error: null };
    mockListResults['game_goalie_stats'] = { data: mockGoalieRecentGames, error: null };
  });

  it('returns goalie detail', async () => {
    const result = await getPlayerDetail(8477424);
    expect(result).not.toBeNull();
    expect(result!.bio.position).toBe('G');
    expect(result!.bio.firstName).toBe('Connor');
    expect(result!.bio.lastName).toBe('Hellebuyck');
  });

  it('maps goalie season stats', async () => {
    const result = await getPlayerDetail(8477424);
    expect(result!.seasonStats.wins).toBe(30);
    expect(result!.seasonStats.savePctg).toBe(0.925);
    expect(result!.seasonStats.goalsAgainstAvg).toBe(2.15);
    expect(result!.seasonStats.shutouts).toBe(4);
    expect(result!.seasonStats.gamesPlayed).toBe(45);
    expect(result!.seasonStats.gamesStarted).toBe(43);
  });

  it('skips Edge IQ for goalies', async () => {
    const result = await getPlayerDetail(8477424);
    expect(result!.edgeStats).toBeNull();
    // Should NOT query edge_skater_stats for goalies
    expect(supabase.from).not.toHaveBeenCalledWith('edge_skater_stats');
  });

  it('queries game_goalie_stats for recent games', async () => {
    const result = await getPlayerDetail(8477424);
    expect(supabase.from).toHaveBeenCalledWith('game_goalie_stats');
    expect(result!.recentGames).toHaveLength(1);
    expect(result!.recentGames[0].saves).toBe(32);
    expect(result!.recentGames[0].goalsAgainst).toBe(2);
    expect(result!.recentGames[0].decision).toBe('W');
  });
});

// ===========================================================================
// Cache behavior
// ===========================================================================

describe('getPlayerDetail — cache', () => {
  it('returns cached data on second call', async () => {
    const first = await getPlayerDetail(8478402);
    const second = await getPlayerDetail(8478402);
    // players table queried only once (cached on second call)
    expect(tableCallCount['players']).toBe(1);
    expect(first).toEqual(second);
  });

  it('clearDetailCache forces re-fetch', async () => {
    await getPlayerDetail(8478402);
    clearDetailCache();
    await getPlayerDetail(8478402);
    expect(tableCallCount['players']).toBe(2);
  });

  it('different players have separate cache entries', async () => {
    await getPlayerDetail(8478402);

    // Switch to goalie
    mockSingleResults['players'] = { data: mockGoaliePlayerRow, error: null };
    mockSingleResults['player_career_data'] = { data: null, error: null };
    mockListResults['goalie_season_stats'] = { data: [mockGoalieSeasonRow], error: null };
    mockListResults['game_goalie_stats'] = { data: mockGoalieRecentGames, error: null };
    mockListResults['goalie_rolling_stats'] = { data: [mockGoalieRollingRow], error: null };

    await getPlayerDetail(8477424);

    // Both should have been fetched
    expect(tableCallCount['players']).toBe(2);
  });
});

// ===========================================================================
// Skater trends
// ===========================================================================

describe('getPlayerDetail — skater trends', () => {
  it('includes trends in player detail', async () => {
    const result = await getPlayerDetail(8478402);
    expect(result).not.toBeNull();
    expect(result!.trends).not.toBeNull();
  });

  it('maps hot/cold data', async () => {
    const result = await getPlayerDetail(8478402);
    const trends = result!.trends as any;
    expect(trends.hotCold).not.toBeNull();
    expect(trends.hotCold.hotColdScore).toBe(1.8);
    expect(trends.hotCold.trendLabel).toBe('HOT');
    expect(trends.hotCold.pointStreak).toBe(5);
    expect(trends.hotCold.seasonPpg).toBe(1.617);
    expect(trends.hotCold.recentPpg).toBe(2.0);
    expect(trends.hotCold.recentShootingPct).toBe(18.5);
    expect(trends.hotCold.seasonShootingPct).toBe(15.0);
  });

  it('maps pace projections', async () => {
    const result = await getPlayerDetail(8478402);
    const trends = result!.trends as any;
    expect(trends.pace).not.toBeNull();
    expect(trends.pace.projectedGoals82).toBe(57);
    expect(trends.pace.projectedAssists82).toBe(75);
    expect(trends.pace.projectedPoints82).toBe(133);
    expect(trends.pace.goalsPerGame).toBe(0.7);
    expect(trends.pace.pointsPerGame).toBe(1.62);
  });

  it('maps rolling stats (5/10/20 game averages)', async () => {
    const result = await getPlayerDetail(8478402);
    const trends = result!.trends as any;
    expect(trends.rolling).not.toBeNull();
    expect(trends.rolling.avgGoals5g).toBe(1.2);
    expect(trends.rolling.avgPoints5g).toBe(2.0);
    expect(trends.rolling.avgGoals10g).toBe(0.9);
    expect(trends.rolling.avgPoints10g).toBe(1.9);
    expect(trends.rolling.avgGoals20g).toBe(0.75);
    expect(trends.rolling.avgPoints20g).toBe(1.7);
    expect(trends.rolling.seasonAvgGoals).toBe(0.7);
    expect(trends.rolling.lastGameDate).toBe('2026-02-07');
  });

  it('maps advanced trends (Corsi, Fenwick, PDO)', async () => {
    const result = await getPlayerDetail(8478402);
    const trends = result!.trends as any;
    expect(trends.advanced).not.toBeNull();
    expect(trends.advanced.avgCorsiPct5g).toBe(55.2);
    expect(trends.advanced.avgFenwickPct5g).toBe(54.8);
    expect(trends.advanced.avgPdo5g).toBe(102.3);
    expect(trends.advanced.seasonCorsiPct).toBe(52.8);
    expect(trends.advanced.seasonPdo).toBe(100.8);
    expect(trends.advanced.gamesWithAdvanced).toBe(58);
  });

  it('counts three star appearances', async () => {
    const result = await getPlayerDetail(8478402);
    const trends = result!.trends as any;
    expect(trends.threeStarCount).toBe(4);
  });

  it('returns null trends when all views are empty', async () => {
    mockListResults['skater_hot_cold'] = { data: [], error: null };
    mockListResults['skater_pace_projections'] = { data: [], error: null };
    mockListResults['skater_rolling_stats'] = { data: [], error: null };
    mockListResults['skater_advanced_trends'] = { data: [], error: null };
    mockListResults['game_three_stars'] = { data: [], error: null };
    const result = await getPlayerDetail(8478402);
    expect(result).not.toBeNull();
    expect(result!.trends).toBeNull();
  });

  it('returns partial trends when some views error', async () => {
    mockListResults['skater_hot_cold'] = { data: null, error: { message: 'timeout' } };
    mockListResults['skater_advanced_trends'] = { data: null, error: { message: 'timeout' } };
    const result = await getPlayerDetail(8478402);
    expect(result).not.toBeNull();
    // pace + rolling + three stars still present = non-null trends
    const trends = result!.trends as any;
    expect(trends).not.toBeNull();
    expect(trends.hotCold).toBeNull();
    expect(trends.pace).not.toBeNull();
    expect(trends.rolling).not.toBeNull();
    expect(trends.advanced).toBeNull();
  });
});

// ===========================================================================
// Goalie trends
// ===========================================================================

describe('getPlayerDetail — goalie trends', () => {
  beforeEach(() => {
    mockSingleResults['players'] = { data: mockGoaliePlayerRow, error: null };
    mockSingleResults['player_career_data'] = { data: null, error: null };
    mockListResults['skater_season_stats'] = { data: [], error: null };
    mockListResults['goalie_season_stats'] = { data: [mockGoalieSeasonRow], error: null };
    mockListResults['edge_skater_stats'] = { data: [], error: null };
    mockListResults['game_skater_stats'] = { data: [], error: null };
    mockListResults['game_goalie_stats'] = { data: mockGoalieRecentGames, error: null };
    mockListResults['goalie_rolling_stats'] = { data: [mockGoalieRollingRow], error: null };
  });

  it('maps goalie rolling trends', async () => {
    const result = await getPlayerDetail(8477424);
    expect(result).not.toBeNull();
    expect(result!.trends).not.toBeNull();
    const trends = result!.trends as any;
    expect(trends.avgGa5g).toBe(2.0);
    expect(trends.savePct5g).toBe(0.935);
    expect(trends.wins5g).toBe(4);
    expect(trends.avgGa10g).toBe(2.2);
    expect(trends.savePct10g).toBe(0.928);
    expect(trends.wins10g).toBe(7);
    expect(trends.starts).toBe(43);
    expect(trends.seasonSavePct).toBe(0.925);
    expect(trends.seasonAvgGa).toBe(2.15);
    expect(trends.seasonWins).toBe(30);
    expect(trends.seasonShutouts).toBe(4);
    expect(trends.lastStartDate).toBe('2026-02-06');
  });

  it('does NOT query skater trend views for goalies', async () => {
    await getPlayerDetail(8477424);
    expect(supabase.from).not.toHaveBeenCalledWith('skater_hot_cold');
    expect(supabase.from).not.toHaveBeenCalledWith('skater_pace_projections');
    expect(supabase.from).not.toHaveBeenCalledWith('skater_rolling_stats');
    expect(supabase.from).not.toHaveBeenCalledWith('skater_advanced_trends');
  });

  it('queries goalie_rolling_stats for goalies', async () => {
    await getPlayerDetail(8477424);
    expect(supabase.from).toHaveBeenCalledWith('goalie_rolling_stats');
  });

  it('returns null trends when goalie_rolling_stats is empty', async () => {
    mockListResults['goalie_rolling_stats'] = { data: [], error: null };
    const result = await getPlayerDetail(8477424);
    expect(result).not.toBeNull();
    expect(result!.trends).toBeNull();
  });
});
