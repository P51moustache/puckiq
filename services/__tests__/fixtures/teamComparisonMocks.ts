/**
 * Shared test fixtures + Supabase mock setup for teamComparison tests.
 *
 * `getTeamComparisonData` is Supabase-only (the NHL API fallback was removed),
 * so these tests prime the global `supabase` mock (from jest.setup.js) rather
 * than `global.fetch`. setupTeamComparisonMocks() installs a chainable query
 * builder that:
 *   - returns all standings rows for `.from('standings')`
 *   - returns the team-specific summary/penalties JSONB from
 *     `.from('team_stat_categories')`, keyed off the recorded `.eq()` filters
 *   - returns skater/goalie season aggregates filtered by team_abbrev
 *
 * Values are chosen so the service produces realistic, non-zero stats
 * (save% in the .90s, PP% in the 20s) matching the assertions.
 *
 * `mockStandings` and `mockTeamSummaryData` keep their public shapes because
 * realDataBug.test.ts reads them directly (e.g. mockTeamSummaryData.data.find
 * by teamId, .powerPlayPct, .shotsForPerGame).
 */

import { supabase } from '../../../lib/supabase';

// Team summary data keyed by teamId — camelCase JSONB shape stored in
// team_stat_categories.data (mirrors the NHL summary endpoint).
export const mockTeamSummaryData = {
  data: [
    {
      teamId: 10,
      teamTriCode: 'TOR',
      shotsForPerGame: 31.5,
      shotsAgainstPerGame: 29.0,
      powerPlayPct: 0.225,
      penaltyKillPct: 0.8,
      goalsFor: 160,
      goalsAgainst: 130,
      gamesPlayed: 50,
    },
    {
      teamId: 6,
      teamTriCode: 'BOS',
      shotsForPerGame: 33.0,
      shotsAgainstPerGame: 28.5,
      powerPlayPct: 0.24,
      penaltyKillPct: 0.82,
      goalsFor: 155,
      goalsAgainst: 120,
      gamesPlayed: 50,
    },
    {
      teamId: 8,
      teamTriCode: 'MTL',
      shotsForPerGame: 28.0,
      shotsAgainstPerGame: 32.0,
      powerPlayPct: 0.19,
      penaltyKillPct: 0.78,
      goalsFor: 130,
      goalsAgainst: 155,
      gamesPlayed: 50,
    },
  ],
};

// Standings rows in Supabase shape (snake_case, flat team_abbrev string).
export const mockStandings = [
  { team_abbrev: 'TOR', team_id: 10, games_played: 50, wins: 28, losses: 16, ot_losses: 6, points: 62, goals_for: 160, goals_against: 130, snapshot_date: '2026-02-20' },
  { team_abbrev: 'BOS', team_id: 6, games_played: 50, wins: 30, losses: 14, ot_losses: 6, points: 66, goals_for: 155, goals_against: 120, snapshot_date: '2026-02-20' },
  { team_abbrev: 'MTL', team_id: 8, games_played: 50, wins: 20, losses: 24, ot_losses: 6, points: 46, goals_for: 130, goals_against: 155, snapshot_date: '2026-02-20' },
];

const summaryByTeam: Record<string, any> = {
  TOR: mockTeamSummaryData.data[0],
  BOS: mockTeamSummaryData.data[1],
  MTL: mockTeamSummaryData.data[2],
};

// Authoritative penalty category (NHL /team/penalties shape).
// Left empty by default: these suites assert the discipline category ties
// because penalty data is "unavailable" (the realistic pre-sync state). With no
// rows, the service yields NaN discipline stats, which determineWinner treats as
// a tie. Tests needing populated penalties can override penaltiesByTeam.
const penaltiesByTeam: Record<string, any> = {};

// Skater/goalie season aggregates per team (only fields the service selects).
const skatersByTeam: Record<string, any[]> = {
  TOR: [{ power_play_goals: 18, pim: 300, games_played: 50 }, { power_play_goals: 14, pim: 120, games_played: 50 }],
  BOS: [{ power_play_goals: 20, pim: 260, games_played: 50 }, { power_play_goals: 12, pim: 110, games_played: 50 }],
  MTL: [{ power_play_goals: 10, pim: 340, games_played: 50 }, { power_play_goals: 8, pim: 200, games_played: 50 }],
};

const goaliesByTeam: Record<string, any[]> = {
  TOR: [{ shutouts: 4, pim: 0 }],
  BOS: [{ shutouts: 5, pim: 2 }],
  MTL: [{ shutouts: 2, pim: 0 }],
};

/** Kept for backward compatibility with any test importing it. */
export const mockClubStats = { skaters: skatersByTeam.TOR };

/**
 * Install a chainable Supabase mock routing results by table and recorded
 * `.eq()` filters. Call in beforeEach().
 */
export function setupTeamComparisonMocks(): void {
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    const filters: Record<string, any> = {};

    const builder: any = {
      select: jest.fn(() => builder),
      eq: jest.fn((col: string, val: any) => {
        filters[col] = val;
        return builder;
      }),
      neq: jest.fn(() => builder),
      in: jest.fn(() => builder),
      gte: jest.fn(() => builder),
      lte: jest.fn(() => builder),
      or: jest.fn(() => builder),
      order: jest.fn(() => builder),
      limit: jest.fn(() => builder),
      then: (resolve: any) => Promise.resolve(resolveResult()).then(resolve),
    };

    function resolveResult() {
      switch (table) {
        case 'standings':
          return { data: mockStandings, error: null };
        case 'team_stat_categories': {
          const team = filters['team_abbrev'];
          const category = filters['stat_category'];
          if (category === 'summary') {
            const d = summaryByTeam[team];
            return { data: d ? [{ data: d }] : [], error: null };
          }
          if (category === 'penalties') {
            const d = penaltiesByTeam[team];
            return { data: d ? [{ data: d }] : [], error: null };
          }
          return { data: [], error: null };
        }
        case 'skater_season_stats':
          return { data: skatersByTeam[filters['team_abbrev']] ?? [], error: null };
        case 'goalie_season_stats':
          return { data: goaliesByTeam[filters['team_abbrev']] ?? [], error: null };
        default:
          return { data: [], error: null };
      }
    }

    return builder;
  });
}
