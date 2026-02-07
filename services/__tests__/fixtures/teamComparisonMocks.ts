/**
 * Shared mock data for teamComparison service tests.
 * Call setupTeamComparisonMocks() in beforeEach to mock fetch()
 * with realistic NHL standings, club stats, and team summary data.
 */

export const mockStandings = [
  {
    teamAbbrev: { default: 'TOR' },
    gamesPlayed: 50,
    goalFor: 160,
    goalAgainst: 130,
    wins: 28,
    losses: 16,
    otLosses: 6,
    points: 62,
  },
  {
    teamAbbrev: { default: 'BOS' },
    gamesPlayed: 50,
    goalFor: 155,
    goalAgainst: 120,
    wins: 30,
    losses: 14,
    otLosses: 6,
    points: 66,
  },
  {
    teamAbbrev: { default: 'MTL' },
    gamesPlayed: 50,
    goalFor: 130,
    goalAgainst: 155,
    wins: 20,
    losses: 24,
    otLosses: 6,
    points: 46,
  },
];

export const mockTeamSummaryData = {
  data: [
    {
      teamId: 10,
      teamTriCode: 'TOR',
      shotsForPerGame: 31.5,
      shotsAgainstPerGame: 29.0,
      powerPlayPct: 0.225,
      penaltyKillPct: 0.800,
    },
    {
      teamId: 6,
      teamTriCode: 'BOS',
      shotsForPerGame: 33.0,
      shotsAgainstPerGame: 28.5,
      powerPlayPct: 0.240,
      penaltyKillPctRank: 5,
      penaltyKillPct: 0.820,
    },
    {
      teamId: 8,
      teamTriCode: 'MTL',
      shotsForPerGame: 28.0,
      shotsAgainstPerGame: 32.0,
      powerPlayPct: 0.190,
      penaltyKillPct: 0.780,
    },
  ],
};

export const mockClubStats = {
  skaters: [
    { powerPlayGoals: 8 },
    { powerPlayGoals: 5 },
    { powerPlayGoals: 3 },
  ],
};

/**
 * Set up global.fetch mock to return mock NHL API data.
 * Call in beforeEach().
 */
export function setupTeamComparisonMocks() {
  (global.fetch as jest.Mock) = jest.fn((url: string) => {
    if (url.includes('standings')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ standings: mockStandings }),
      });
    }
    if (url.includes('club-stats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockClubStats),
      });
    }
    if (url.includes('team/summary')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTeamSummaryData),
      });
    }
    return Promise.resolve({ ok: false });
  });
}
