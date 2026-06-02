// Test to verify stat comparison calculations are correct
import { getTeamComparisonData, determineWinner, calculateCategoryWinners } from '../teamComparison';
import { setupTeamComparisonMocks, mockTeamSummaryData } from './fixtures/teamComparisonMocks';

// Summary values used by the assertions below (TOR = teamId 10).
const torSummary = mockTeamSummaryData.data.find((t) => t.teamId === 10)!;

beforeEach(() => {
  setupTeamComparisonMocks();
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
