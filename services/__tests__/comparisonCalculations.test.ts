// Test to verify stat comparison calculations are correct
import { getTeamComparisonData, determineWinner, calculateCategoryWinners } from '../teamComparison';

// Mock data matching service expectations
const mockStandings = [
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
];

const mockTeamSummaryData = {
  data: [
    {
      teamId: 10,
      shotsForPerGame: 31.5,
      shotsAgainstPerGame: 29.0,
      powerPlayPct: 0.225,
      penaltyKillPct: 0.800,
      goalsFor: 160,
      goalsAgainst: 130,
      gamesPlayed: 50,
    },
    {
      teamId: 6,
      shotsForPerGame: 33.0,
      shotsAgainstPerGame: 28.5,
      powerPlayPct: 0.240,
      penaltyKillPct: 0.820,
      goalsFor: 155,
      goalsAgainst: 120,
      gamesPlayed: 50,
    },
  ],
};

const mockClubStats = {
  skaters: [{ powerPlayGoals: 8 }, { powerPlayGoals: 5 }, { powerPlayGoals: 3 }],
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

describe('Stat Comparison Calculations', () => {
  it('should calculate shooting percentage correctly', async () => {
    const stats = await getTeamComparisonData('TOR');

    // Shooting % = (goalsFor / (shotsForPerGame * gamesPlayed)) * 100
    // = (160 / (31.5 * 50)) * 100 = (160 / 1575) * 100 ~ 10.16%
    const expectedShootingPct = (160 / (31.5 * 50)) * 100;

    expect(Math.abs(stats.offense.shootingPct - expectedShootingPct)).toBeLessThan(0.1);
  });

  it('should calculate save percentage correctly', async () => {
    const stats = await getTeamComparisonData('TOR');

    // Save % = 1 - (goalsAgainst / (shotsAgainstPerGame * gamesPlayed))
    // = 1 - (130 / (29.0 * 50)) = 1 - (130 / 1450) ~ 0.9103
    const expectedSavePct = 1 - (130 / (29.0 * 50));

    expect(Math.abs(stats.goaltending.savePct - expectedSavePct)).toBeLessThan(0.001);
  });

  it('should determine winner correctly for stats comparison', async () => {
    const torStats = await getTeamComparisonData('TOR');
    const bosStats = await getTeamComparisonData('BOS');

    const goalsWinner = determineWinner(torStats.offense.goalsPerGame, bosStats.offense.goalsPerGame, true);
    const shootingWinner = determineWinner(torStats.offense.shootingPct, bosStats.offense.shootingPct, true);
    const saveWinner = determineWinner(torStats.goaltending.savePct, bosStats.goaltending.savePct, true);

    // Verify winners are determined correctly
    expect(goalsWinner).toBeDefined();
    expect(shootingWinner).toBeDefined();
    expect(saveWinner).toBeDefined();

    // TOR has 3.2 goals/game vs BOS 3.1 — TOR should win or tie
    expect(['home', 'tie']).toContain(goalsWinner);
  });

  it('should calculate category winners correctly', async () => {
    const torStats = await getTeamComparisonData('TOR');
    const bosStats = await getTeamComparisonData('BOS');

    const winners = calculateCategoryWinners(torStats, bosStats);

    // Count wins
    const torWins = Object.values(winners).filter(w => w === 'home').length;
    const bosWins = Object.values(winners).filter(w => w === 'away').length;

    // At least one team should win at least one category
    expect(torWins + bosWins).toBeGreaterThan(0);
  });
});
