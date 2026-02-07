// Test to identify which stats are showing as 0, NaN, or undefined
import { getTeamComparisonData } from '../teamComparison';
import { setupTeamComparisonMocks } from './fixtures/teamComparisonMocks';

beforeEach(() => {
  setupTeamComparisonMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Stats Display Issues', () => {
  it('should identify stats that are 0 or undefined', async () => {
    const stats = await getTeamComparisonData('TOR');

    // Check for problem stats
    const problems: string[] = [];

    // Check offense
    if (stats.offense.shotsPerGame === 0) problems.push('Shots/Game is 0');
    if (stats.offense.shootingPct === 0) problems.push('Shooting % is 0');
    if (stats.offense.powerPlayPct === 0) problems.push('Power Play % is 0');

    // Check defense
    if (stats.defense.shotsAgainstPerGame === 0) problems.push('Shots Against/Game is 0');
    if (stats.defense.penaltyKillPct === 0) problems.push('Penalty Kill % is 0');

    // Check goaltending
    if (stats.goaltending.savePct === 0) problems.push('Save % is 0');

    // Check for NaN values
    if (isNaN(stats.offense.shotsPerGame)) problems.push('Shots/Game is NaN');
    if (isNaN(stats.offense.shootingPct)) problems.push('Shooting % is NaN');
    if (isNaN(stats.defense.shotsAgainstPerGame)) problems.push('Shots Against/Game is NaN');
    if (isNaN(stats.goaltending.savePct)) problems.push('Save % is NaN');

    // Fail the test if there are problems
    expect(problems).toEqual([]);
  });

  it('should have valid data for all displayed stats', async () => {
    const stats = await getTeamComparisonData('BOS');

    // Stats that SHOULD have real data
    expect(stats.offense.goalsPerGame).toBeGreaterThan(0);
    expect(stats.offense.shotsPerGame).toBeGreaterThan(0);
    expect(stats.offense.shootingPct).toBeGreaterThan(0);
    expect(stats.offense.powerPlayPct).toBeGreaterThan(0);

    expect(stats.defense.goalsAgainstPerGame).toBeGreaterThan(0);
    expect(stats.defense.shotsAgainstPerGame).toBeGreaterThan(0);
    expect(stats.defense.penaltyKillPct).toBeGreaterThan(0);

    expect(stats.goaltending.savePct).toBeGreaterThan(0);
    expect(stats.goaltending.savePct).toBeLessThan(1); // Should be decimal < 1

    // All these should have rankings
    expect(stats.offense.goalsPerGameRank).toBeDefined();
    expect(stats.defense.goalsAgainstPerGameRank).toBeDefined();
  });
});
