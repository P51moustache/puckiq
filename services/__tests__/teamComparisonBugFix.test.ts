// Test file to reproduce stats display bugs in GameDeepDiveModal
import { getTeamComparisonData, formatStatValue } from '../teamComparison';

// Mock standings and team summary for tests that call getTeamComparisonData
const mockStandings = [
  {
    teamAbbrev: { default: 'TOR' },
    gamesPlayed: 20,
    goalFor: 70,
    goalsFor: 70,
    goalAgainst: 56,
    goalsAgainst: 56,
    wins: 12,
    losses: 6,
    otLosses: 2,
    points: 26,
  },
];

const mockTeamSummaryData = {
  data: [
    {
      teamId: 10,
      shotsForPerGame: 31.5,
      shotsAgainstPerGame: 29.0,
      powerPlayPct: 0.225,
      penaltyKillPct: 0.800,
    },
  ],
};

const mockClubStats = {
  skaters: [{ powerPlayGoals: 8 }, { powerPlayGoals: 5 }],
};

beforeEach(() => {
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
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('teamComparison bug fixes', () => {
  describe('formatStatValue', () => {
    it('should not double-format save percentage', () => {
      // Save % from API is decimal (e.g., 0.905 for 90.5%)
      const savePct = 0.905;

      // When we multiply by 100 and use 'percentage' format
      const formatted = formatStatValue(savePct * 100, 'percentage', 1);

      // Bug: This will show "90.5%%" instead of "90.5%"
      // Expected: Should show "90.5%" not "90.5%%"
      expect(formatted).toBe('90.5%');
      expect(formatted).not.toContain('%%');
    });

    it('should handle decimal save percentage correctly', () => {
      // If we don't multiply by 100 first
      const savePct = 0.905;
      const formatted = formatStatValue(savePct, 'decimal', 3);

      // Should show as decimal
      expect(formatted).toBe('0.905');
    });

    it('should format percentage without multiplication', () => {
      // PP% from API is already a percentage (e.g., 22.5)
      const powerPlayPct = 22.5;
      const formatted = formatStatValue(powerPlayPct, 'percentage', 1);

      // Should show "22.5%"
      expect(formatted).toBe('22.5%');
    });
  });

  describe('getTeamComparisonData with pre-provided standings', () => {
    it('should handle pre-provided standings data correctly', async () => {
      // Mock standings data (what GameDeepDiveModal might pass)
      const mockStandings = [
        {
          teamAbbrev: { default: 'TOR' },
          gamesPlayed: 20,
          goalFor: 70,
          goalsFor: 70,
          goalAgainst: 56,
          goalsAgainst: 56,
          wins: 12,
          losses: 6,
          otLosses: 2,
          points: 26,
        },
      ];

      // This should work without throwing an error
      const stats = await getTeamComparisonData('TOR', mockStandings);

      expect(stats.offense.goalsPerGame).toBeCloseTo(3.5, 1);
      expect(stats.defense.goalsAgainstPerGame).toBeCloseTo(2.8, 1);
    });

    it('should handle standings wrapped in object', async () => {
      // Sometimes standings comes wrapped
      const mockStandingsWrapped = {
        standings: [
          {
            teamAbbrev: { default: 'TOR' },
            gamesPlayed: 20,
            goalFor: 70,
            goalAgainst: 56,
            wins: 12,
            losses: 6,
            otLosses: 2,
            points: 26,
          },
        ],
      };

      const stats = await getTeamComparisonData('TOR', mockStandingsWrapped);

      expect(stats.offense.goalsPerGame).toBeCloseTo(3.5, 1);
    });
  });

  describe('power play percentage display', () => {
    it('should have powerPlayPct in offense stats', async () => {
      const stats = await getTeamComparisonData('TOR');

      // Power Play % should exist in offense
      expect(stats.offense.powerPlayPct).toBeDefined();
      expect(stats.offense.powerPlayPct).toBeGreaterThanOrEqual(0);
    });

    it('should have same powerPlayPct in specialTeams as offense', async () => {
      const stats = await getTeamComparisonData('TOR');

      // PP% should be the same in both places
      expect(stats.specialTeams.powerPlayPct).toBe(stats.offense.powerPlayPct);
    });

    it('should have penaltyKillPct in both defense and specialTeams', async () => {
      const stats = await getTeamComparisonData('TOR');

      // PK% should be the same in both places
      expect(stats.defense.penaltyKillPct).toBe(stats.specialTeams.penaltyKillPct);
    });
  });
});
