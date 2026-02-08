/**
 * Tests for services/playerLeaders.ts
 *
 * Covers:
 * - getLeagueLeaders: skater leaders by category with position/team filtering
 * - getGoalieLeaders: goalie leaders by category with team filtering
 * - Cache behavior (5-minute TTL)
 * - Error handling and empty results
 * - Column mapping for all stat categories
 */

import { supabase } from '../../lib/supabase';
import {
  getLeagueLeaders,
  getGoalieLeaders,
  searchPlayers,
  getTeamRoster,
  clearLeadersCache,
} from '../playerLeaders';

// ---------------------------------------------------------------------------
// Mock data — realistic NHL rows matching Supabase column naming
// ---------------------------------------------------------------------------

const mockSkaterRows = [
  {
    player_id: 8478402,
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
  },
  {
    player_id: 8479318,
    team_abbrev: 'TOR',
    position: 'C',
    games_played: 58,
    goals: 38,
    assists: 40,
    points: 78,
    plus_minus: 15,
    pim: 14,
    power_play_goals: 12,
    shorthanded_goals: 0,
    game_winning_goals: 6,
    shots: 260,
    shooting_pctg: 0.146,
    avg_toi_per_game: 1280,
    faceoff_win_pctg: 0.55,
  },
  {
    player_id: 8478483,
    team_abbrev: 'TOR',
    position: 'RW',
    games_played: 60,
    goals: 18,
    assists: 62,
    points: 80,
    plus_minus: 20,
    pim: 10,
    power_play_goals: 5,
    shorthanded_goals: 0,
    game_winning_goals: 3,
    shots: 150,
    shooting_pctg: 0.12,
    avg_toi_per_game: 1200,
    faceoff_win_pctg: 0.0,
  },
  {
    player_id: 8477934,
    team_abbrev: 'COL',
    position: 'D',
    games_played: 55,
    goals: 20,
    assists: 55,
    points: 75,
    plus_minus: 18,
    pim: 22,
    power_play_goals: 10,
    shorthanded_goals: 0,
    game_winning_goals: 5,
    shots: 200,
    shooting_pctg: 0.10,
    avg_toi_per_game: 1500,
    faceoff_win_pctg: 0.0,
  },
];

const mockPlayerRows = [
  { id: 8478402, first_name: 'Connor', last_name: 'McDavid', headshot_url: 'https://assets.nhle.com/mugs/nhl/20252026/EDM/8478402.png' },
  { id: 8479318, first_name: 'Auston', last_name: 'Matthews', headshot_url: 'https://assets.nhle.com/mugs/nhl/20252026/TOR/8479318.png' },
  { id: 8478483, first_name: 'Mitch', last_name: 'Marner', headshot_url: 'https://assets.nhle.com/mugs/nhl/20252026/TOR/8478483.png' },
  { id: 8477934, first_name: 'Cale', last_name: 'Makar', headshot_url: 'https://assets.nhle.com/mugs/nhl/20252026/COL/8477934.png' },
];

const mockGoalieRows = [
  {
    player_id: 8477424,
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
  },
  {
    player_id: 8480382,
    team_abbrev: 'NYR',
    games_played: 48,
    games_started: 47,
    wins: 28,
    losses: 14,
    ot_losses: 6,
    goals_against_avg: 2.35,
    save_pctg: 0.918,
    shots_against: 1500,
    saves: 1377,
    shutouts: 3,
  },
];

const mockGoaliePlayerRows = [
  { id: 8477424, first_name: 'Connor', last_name: 'Hellebuyck', headshot_url: 'https://assets.nhle.com/mugs/nhl/20252026/WPG/8477424.png' },
  { id: 8480382, first_name: 'Igor', last_name: 'Shesterkin', headshot_url: 'https://assets.nhle.com/mugs/nhl/20252026/NYR/8480382.png' },
];

const mockSearchResults = [
  { id: 8478402, first_name: 'Connor', last_name: 'McDavid', full_name: 'Connor McDavid', position: 'C', current_team_abbrev: 'EDM', headshot_url: 'https://assets.nhle.com/mugs/nhl/20252026/EDM/8478402.png', sweater_number: 97 },
  { id: 8477424, first_name: 'Connor', last_name: 'Hellebuyck', full_name: 'Connor Hellebuyck', position: 'G', current_team_abbrev: 'WPG', headshot_url: 'https://assets.nhle.com/mugs/nhl/20252026/WPG/8477424.png', sweater_number: 37 },
];

const mockRosterPlayers = [
  { id: 8478402, first_name: 'Connor', last_name: 'McDavid', position: 'C', current_team_abbrev: 'EDM', headshot_url: 'https://assets.nhle.com/mugs/nhl/20252026/EDM/8478402.png', sweater_number: 97 },
  { id: 8478001, first_name: 'Leon', last_name: 'Draisaitl', position: 'C', current_team_abbrev: 'EDM', headshot_url: null, sweater_number: 29 },
  { id: 8479999, first_name: 'Zach', last_name: 'Hyman', position: 'L', current_team_abbrev: 'EDM', headshot_url: null, sweater_number: 18 },
  { id: 8480001, first_name: 'Evan', last_name: 'Bouchard', position: 'D', current_team_abbrev: 'EDM', headshot_url: null, sweater_number: 75 },
  { id: 8480002, first_name: 'Stuart', last_name: 'Skinner', position: 'G', current_team_abbrev: 'EDM', headshot_url: null, sweater_number: 74 },
];

const mockRosterSkaterStats = [
  { player_id: 8478402, games_played: 60, goals: 42, assists: 55, points: 97 },
  { player_id: 8478001, games_played: 58, goals: 35, assists: 50, points: 85 },
  { player_id: 8479999, games_played: 55, goals: 25, assists: 15, points: 40 },
  { player_id: 8480001, games_played: 60, goals: 12, assists: 40, points: 52 },
];

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

let mockResults: Record<string, { data: any; error: any }> = {};

function buildChain(table: string) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(() => {
      const r = mockResults[table] ?? { data: null, error: null };
      return Promise.resolve(r);
    }),
    then: (resolve: any) => {
      const r = mockResults[table] ?? { data: [], error: null };
      return resolve(r);
    },
  };
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  clearLeadersCache();

  mockResults = {
    skater_season_stats: { data: mockSkaterRows, error: null },
    goalie_season_stats: { data: mockGoalieRows, error: null },
    players: { data: mockPlayerRows, error: null },
  };

  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    return buildChain(table);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ===========================================================================
// getLeagueLeaders
// ===========================================================================

describe('getLeagueLeaders', () => {
  it('returns skater leaders for points category', async () => {
    const result = await getLeagueLeaders('points');
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(4);
    expect(supabase.from).toHaveBeenCalledWith('skater_season_stats');
    expect(supabase.from).toHaveBeenCalledWith('players');
  });

  it('maps Supabase columns to SkaterLeader interface', async () => {
    const result = await getLeagueLeaders('points');
    const mcdavid = result.find((p) => p.playerId === 8478402);
    expect(mcdavid).toBeDefined();
    expect(mcdavid!.firstName).toBe('Connor');
    expect(mcdavid!.lastName).toBe('McDavid');
    expect(mcdavid!.headshotUrl).toContain('8478402');
    expect(mcdavid!.teamAbbrev).toBe('EDM');
    expect(mcdavid!.position).toBe('C');
    expect(mcdavid!.gamesPlayed).toBe(60);
    expect(mcdavid!.goals).toBe(42);
    expect(mcdavid!.assists).toBe(55);
    expect(mcdavid!.points).toBe(97);
    expect(mcdavid!.plusMinus).toBe(28);
    expect(mcdavid!.shots).toBe(280);
    expect(mcdavid!.shootingPctg).toBe(0.15);
    expect(mcdavid!.powerPlayGoals).toBe(15);
    expect(mcdavid!.gameWinningGoals).toBe(8);
    expect(mcdavid!.avgToi).toBe(1320);
    expect(mcdavid!.faceoffWinPctg).toBe(0.52);
  });

  it('returns leaders for goals category', async () => {
    expect((await getLeagueLeaders('goals')).length).toBeGreaterThan(0);
  });

  it('returns leaders for assists category', async () => {
    expect((await getLeagueLeaders('assists')).length).toBeGreaterThan(0);
  });

  it('returns leaders for plusMinus category', async () => {
    expect((await getLeagueLeaders('plusMinus')).length).toBeGreaterThan(0);
  });

  it('returns leaders for powerPlayGoals category', async () => {
    expect((await getLeagueLeaders('powerPlayGoals')).length).toBeGreaterThan(0);
  });

  it('returns leaders for gameWinningGoals category', async () => {
    expect((await getLeagueLeaders('gameWinningGoals')).length).toBeGreaterThan(0);
  });

  it('returns leaders for shootingPctg category', async () => {
    expect((await getLeagueLeaders('shootingPctg')).length).toBeGreaterThan(0);
  });

  it('returns leaders for avgToi category', async () => {
    expect((await getLeagueLeaders('avgToi')).length).toBeGreaterThan(0);
  });

  it('returns leaders for faceoffWinPctg category', async () => {
    expect((await getLeagueLeaders('faceoffWinPctg')).length).toBeGreaterThan(0);
  });

  it('filters by position', async () => {
    mockResults['skater_season_stats'] = {
      data: mockSkaterRows.filter((r) => r.position === 'D'),
      error: null,
    };
    const result = await getLeagueLeaders('points', 'D');
    expect(result.length).toBe(1);
    expect(result[0].playerId).toBe(8477934);
  });

  it('filters by team', async () => {
    mockResults['skater_season_stats'] = {
      data: mockSkaterRows.filter((r) => r.team_abbrev === 'TOR'),
      error: null,
    };
    const result = await getLeagueLeaders('points', null, 'TOR');
    expect(result.length).toBe(2);
    expect(result.every((p) => p.teamAbbrev === 'TOR')).toBe(true);
  });

  it('filters by both position and team', async () => {
    mockResults['skater_season_stats'] = {
      data: mockSkaterRows.filter(
        (r) => r.position === 'C' && r.team_abbrev === 'TOR',
      ),
      error: null,
    };
    const result = await getLeagueLeaders('points', 'C', 'TOR');
    expect(result.length).toBe(1);
    expect(result[0].playerId).toBe(8479318);
  });

  it('respects limit parameter', async () => {
    mockResults['skater_season_stats'] = {
      data: mockSkaterRows.slice(0, 2),
      error: null,
    };
    const result = await getLeagueLeaders('points', null, null, 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('returns empty array when no data', async () => {
    mockResults['skater_season_stats'] = { data: [], error: null };
    expect(await getLeagueLeaders('points')).toEqual([]);
  });

  it('returns empty array on Supabase error', async () => {
    mockResults['skater_season_stats'] = {
      data: null,
      error: { message: 'connection timeout' },
    };
    expect(await getLeagueLeaders('points')).toEqual([]);
  });

  it('uses fallback names when players table is empty', async () => {
    mockResults['players'] = { data: [], error: null };
    const result = await getLeagueLeaders('points');
    expect(result.length).toBe(4);
    expect(result[0].firstName).toBe('Unknown');
    expect(result[0].lastName).toContain('#');
  });

  it('returns empty array for unknown category', async () => {
    expect(await getLeagueLeaders('nonexistent' as any)).toEqual([]);
  });

  // Cache -------------------------------------------------------------------

  describe('cache behavior', () => {
    it('returns cached data on second call', async () => {
      const first = await getLeagueLeaders('points');
      const second = await getLeagueLeaders('points');
      expect(supabase.from).toHaveBeenCalledTimes(2);
      expect(first).toEqual(second);
    });

    it('separate categories have separate cache entries', async () => {
      await getLeagueLeaders('points');
      await getLeagueLeaders('goals');
      expect(supabase.from).toHaveBeenCalledTimes(4);
    });

    it('clearLeadersCache forces re-fetch', async () => {
      await getLeagueLeaders('points');
      clearLeadersCache();
      await getLeagueLeaders('points');
      expect(supabase.from).toHaveBeenCalledTimes(4);
    });

    it('different position filters have different cache keys', async () => {
      mockResults['skater_season_stats'] = {
        data: mockSkaterRows.filter((r) => r.position === 'C'),
        error: null,
      };
      await getLeagueLeaders('points', 'C');
      mockResults['skater_season_stats'] = {
        data: mockSkaterRows.filter((r) => r.position === 'D'),
        error: null,
      };
      await getLeagueLeaders('points', 'D');
      expect(supabase.from).toHaveBeenCalledTimes(4);
    });

    it('different team filters have different cache keys', async () => {
      mockResults['skater_season_stats'] = {
        data: mockSkaterRows.filter((r) => r.team_abbrev === 'TOR'),
        error: null,
      };
      await getLeagueLeaders('points', null, 'TOR');
      mockResults['skater_season_stats'] = {
        data: mockSkaterRows.filter((r) => r.team_abbrev === 'EDM'),
        error: null,
      };
      await getLeagueLeaders('points', null, 'EDM');
      expect(supabase.from).toHaveBeenCalledTimes(4);
    });
  });
});

// ===========================================================================
// getGoalieLeaders
// ===========================================================================

describe('getGoalieLeaders', () => {
  beforeEach(() => {
    mockResults['players'] = { data: mockGoaliePlayerRows, error: null };
  });

  it('returns goalie leaders for wins category', async () => {
    const result = await getGoalieLeaders('wins');
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(supabase.from).toHaveBeenCalledWith('goalie_season_stats');
  });

  it('maps Supabase columns to GoalieLeader interface', async () => {
    const result = await getGoalieLeaders('wins');
    const hellebuyck = result.find((g) => g.playerId === 8477424);
    expect(hellebuyck).toBeDefined();
    expect(hellebuyck!.firstName).toBe('Connor');
    expect(hellebuyck!.lastName).toBe('Hellebuyck');
    expect(hellebuyck!.headshotUrl).toContain('8477424');
    expect(hellebuyck!.teamAbbrev).toBe('WPG');
    expect(hellebuyck!.gamesPlayed).toBe(45);
    expect(hellebuyck!.wins).toBe(30);
    expect(hellebuyck!.losses).toBe(10);
    expect(hellebuyck!.otLosses).toBe(5);
    expect(hellebuyck!.goalsAgainstAvg).toBe(2.15);
    expect(hellebuyck!.savePctg).toBe(0.925);
    expect(hellebuyck!.shutouts).toBe(4);
  });

  it('returns leaders for savePctg', async () => {
    expect((await getGoalieLeaders('savePctg')).length).toBeGreaterThan(0);
  });

  it('returns leaders for goalsAgainstAvg', async () => {
    expect((await getGoalieLeaders('goalsAgainstAvg')).length).toBeGreaterThan(0);
  });

  it('returns leaders for shutouts', async () => {
    expect((await getGoalieLeaders('shutouts')).length).toBeGreaterThan(0);
  });

  it('returns leaders for gamesPlayed', async () => {
    expect((await getGoalieLeaders('gamesPlayed')).length).toBeGreaterThan(0);
  });

  it('filters by team', async () => {
    mockResults['goalie_season_stats'] = {
      data: mockGoalieRows.filter((r) => r.team_abbrev === 'WPG'),
      error: null,
    };
    const result = await getGoalieLeaders('wins', 'WPG');
    expect(result.length).toBe(1);
    expect(result[0].teamAbbrev).toBe('WPG');
  });

  it('respects limit parameter', async () => {
    mockResults['goalie_season_stats'] = {
      data: mockGoalieRows.slice(0, 1),
      error: null,
    };
    const result = await getGoalieLeaders('wins', null, 1);
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it('returns empty array when no data', async () => {
    mockResults['goalie_season_stats'] = { data: [], error: null };
    expect(await getGoalieLeaders('wins')).toEqual([]);
  });

  it('returns empty array on Supabase error', async () => {
    mockResults['goalie_season_stats'] = {
      data: null,
      error: { message: 'permission denied' },
    };
    expect(await getGoalieLeaders('wins')).toEqual([]);
  });

  it('returns empty array for unknown category', async () => {
    expect(await getGoalieLeaders('nonexistent' as any)).toEqual([]);
  });

  it('uses fallback names when players table is empty', async () => {
    mockResults['players'] = { data: [], error: null };
    const result = await getGoalieLeaders('wins');
    expect(result.length).toBe(2);
    expect(result[0].firstName).toBe('Unknown');
    expect(result[0].lastName).toContain('#');
  });

  describe('cache behavior', () => {
    it('returns cached data on second call', async () => {
      const first = await getGoalieLeaders('wins');
      const second = await getGoalieLeaders('wins');
      expect(supabase.from).toHaveBeenCalledTimes(2);
      expect(first).toEqual(second);
    });

    it('clearLeadersCache clears goalie cache too', async () => {
      await getGoalieLeaders('wins');
      clearLeadersCache();
      await getGoalieLeaders('wins');
      expect(supabase.from).toHaveBeenCalledTimes(4);
    });

    it('separate categories have separate cache entries', async () => {
      await getGoalieLeaders('wins');
      await getGoalieLeaders('savePctg');
      expect(supabase.from).toHaveBeenCalledTimes(4);
    });
  });
});

// ===========================================================================
// searchPlayers
// ===========================================================================

describe('searchPlayers', () => {
  beforeEach(() => {
    mockResults['players'] = { data: mockSearchResults, error: null };
  });

  it('returns matching players by name', async () => {
    const result = await searchPlayers('Connor');
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(supabase.from).toHaveBeenCalledWith('players');
  });

  it('maps Supabase columns to PlayerSearchResult', async () => {
    const result = await searchPlayers('Connor');
    const mcdavid = result.find((p) => p.playerId === 8478402);
    expect(mcdavid).toBeDefined();
    expect(mcdavid!.firstName).toBe('Connor');
    expect(mcdavid!.lastName).toBe('McDavid');
    expect(mcdavid!.fullName).toBe('Connor McDavid');
    expect(mcdavid!.position).toBe('C');
    expect(mcdavid!.teamAbbrev).toBe('EDM');
    expect(mcdavid!.headshotUrl).toContain('8478402');
    expect(mcdavid!.sweaterNumber).toBe(97);
  });

  it('returns empty array for short queries (< 2 chars)', async () => {
    expect(await searchPlayers('C')).toEqual([]);
    expect(await searchPlayers('')).toEqual([]);
    // Should not hit Supabase at all
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('trims whitespace from query', async () => {
    expect(await searchPlayers(' ')).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns empty array when no matches', async () => {
    mockResults['players'] = { data: [], error: null };
    const result = await searchPlayers('Zzzzz');
    expect(result).toEqual([]);
  });

  it('returns empty array on Supabase error', async () => {
    mockResults['players'] = { data: null, error: { message: 'timeout' } };
    const result = await searchPlayers('Connor');
    expect(result).toEqual([]);
  });

  it('handles missing optional fields gracefully', async () => {
    mockResults['players'] = {
      data: [{ id: 9999, first_name: 'Test', last_name: 'Player', full_name: null, position: null, current_team_abbrev: null, headshot_url: null, sweater_number: null }],
      error: null,
    };
    const result = await searchPlayers('Test');
    expect(result.length).toBe(1);
    expect(result[0].fullName).toBe('Test Player');
    expect(result[0].position).toBe('');
    expect(result[0].teamAbbrev).toBe('');
    expect(result[0].headshotUrl).toBeUndefined();
    expect(result[0].sweaterNumber).toBeUndefined();
  });
});

// ===========================================================================
// getTeamRoster
// ===========================================================================

describe('getTeamRoster', () => {
  beforeEach(() => {
    mockResults['players'] = { data: mockRosterPlayers, error: null };
    mockResults['skater_season_stats'] = { data: mockRosterSkaterStats, error: null };
  });

  it('returns roster grouped by position', async () => {
    const result = await getTeamRoster('EDM');
    expect(result).toBeDefined();
    expect(result.forwards.length).toBe(3); // McDavid (C), Draisaitl (C), Hyman (L)
    expect(result.defense.length).toBe(1);  // Bouchard (D)
    expect(result.goalies.length).toBe(1);  // Skinner (G)
  });

  it('maps player info correctly for forwards', async () => {
    const result = await getTeamRoster('EDM');
    const mcdavid = result.forwards.find((p) => p.playerId === 8478402);
    expect(mcdavid).toBeDefined();
    expect(mcdavid!.firstName).toBe('Connor');
    expect(mcdavid!.lastName).toBe('McDavid');
    expect(mcdavid!.position).toBe('C');
    expect(mcdavid!.teamAbbrev).toBe('EDM');
    expect(mcdavid!.sweaterNumber).toBe(97);
  });

  it('includes season stats when available', async () => {
    const result = await getTeamRoster('EDM');
    const mcdavid = result.forwards.find((p) => p.playerId === 8478402);
    expect(mcdavid!.gamesPlayed).toBe(60);
    expect(mcdavid!.goals).toBe(42);
    expect(mcdavid!.assists).toBe(55);
    expect(mcdavid!.points).toBe(97);
  });

  it('includes defense stats', async () => {
    const result = await getTeamRoster('EDM');
    const bouchard = result.defense.find((p) => p.playerId === 8480001);
    expect(bouchard).toBeDefined();
    expect(bouchard!.goals).toBe(12);
    expect(bouchard!.assists).toBe(40);
    expect(bouchard!.points).toBe(52);
  });

  it('goalie stats are undefined (no skater stats)', async () => {
    const result = await getTeamRoster('EDM');
    const skinner = result.goalies.find((p) => p.playerId === 8480002);
    expect(skinner).toBeDefined();
    expect(skinner!.position).toBe('G');
    // Goalie won't have skater stats
    expect(skinner!.gamesPlayed).toBeUndefined();
    expect(skinner!.goals).toBeUndefined();
  });

  it('returns empty groups for empty team', async () => {
    mockResults['players'] = { data: [], error: null };
    const result = await getTeamRoster('XXX');
    expect(result.forwards).toEqual([]);
    expect(result.defense).toEqual([]);
    expect(result.goalies).toEqual([]);
  });

  it('returns empty groups when teamAbbrev is empty', async () => {
    const result = await getTeamRoster('');
    expect(result.forwards).toEqual([]);
    expect(result.defense).toEqual([]);
    expect(result.goalies).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns empty groups on Supabase error', async () => {
    mockResults['players'] = { data: null, error: { message: 'network error' } };
    const result = await getTeamRoster('EDM');
    expect(result.forwards).toEqual([]);
    expect(result.defense).toEqual([]);
    expect(result.goalies).toEqual([]);
  });

  it('handles missing headshot_url gracefully', async () => {
    const result = await getTeamRoster('EDM');
    const draisaitl = result.forwards.find((p) => p.playerId === 8478001);
    expect(draisaitl).toBeDefined();
    expect(draisaitl!.headshotUrl).toBeUndefined();
  });
});
