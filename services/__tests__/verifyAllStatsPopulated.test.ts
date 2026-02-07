// Test to verify all displayed stats are populated (not 0, NaN, or undefined)
import { getTeamComparisonData } from '../teamComparison';
import { setupTeamComparisonMocks } from './fixtures/teamComparisonMocks';

beforeEach(() => {
  setupTeamComparisonMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Verify All Stats Populated', () => {
  it('should have all offense stats populated', async () => {
    const stats = await getTeamComparisonData('TOR');

    // All these should be > 0
    expect(stats.offense.goalsPerGame).toBeGreaterThan(0);
    expect(stats.offense.shotsPerGame).toBeGreaterThan(0);
    expect(stats.offense.shootingPct).toBeGreaterThan(0);
    expect(stats.offense.powerPlayPct).toBeGreaterThan(0);

    // None should be NaN
    expect(isNaN(stats.offense.goalsPerGame)).toBe(false);
    expect(isNaN(stats.offense.shotsPerGame)).toBe(false);
    expect(isNaN(stats.offense.shootingPct)).toBe(false);
    expect(isNaN(stats.offense.powerPlayPct)).toBe(false);
  });

  it('should have all defense stats populated', async () => {
    const stats = await getTeamComparisonData('BOS');

    expect(stats.defense.goalsAgainstPerGame).toBeGreaterThan(0);
    expect(stats.defense.shotsAgainstPerGame).toBeGreaterThan(0);
    expect(stats.defense.penaltyKillPct).toBeGreaterThan(0);

    expect(isNaN(stats.defense.goalsAgainstPerGame)).toBe(false);
    expect(isNaN(stats.defense.shotsAgainstPerGame)).toBe(false);
    expect(isNaN(stats.defense.penaltyKillPct)).toBe(false);
  });

  it('should have all goaltending stats populated', async () => {
    const stats = await getTeamComparisonData('TOR');

    expect(stats.goaltending.savePct).toBeGreaterThan(0);
    expect(stats.goaltending.savePct).toBeLessThan(1); // Should be decimal
    expect(stats.goaltending.goalsAgainstAverage).toBeGreaterThan(0);

    expect(isNaN(stats.goaltending.savePct)).toBe(false);
    expect(isNaN(stats.goaltending.goalsAgainstAverage)).toBe(false);
  });

  it('should handle comparison between two teams correctly', async () => {
    const [tor, bos] = await Promise.all([
      getTeamComparisonData('TOR'),
      getTeamComparisonData('BOS'),
    ]);

    // Both teams should have valid stats
    expect(tor.specialTeams.powerPlayPct).toBeGreaterThan(0);
    expect(bos.specialTeams.powerPlayPct).toBeGreaterThan(0);
    expect(tor.goaltending.savePct).toBeGreaterThan(0.8); // Most teams are > 80%
    expect(bos.goaltending.savePct).toBeGreaterThan(0.8);
  });
});
