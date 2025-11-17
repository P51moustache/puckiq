// Test to verify all displayed stats are populated (not 0, NaN, or undefined)
import { getTeamComparisonData } from '../teamComparison';

describe('Verify All Stats Populated', () => {
  it('should have all offense stats populated', async () => {
    const stats = await getTeamComparisonData('TOR');

    console.log('\n=== OFFENSE STATS ===');
    console.log('Goals/Game:', stats.offense.goalsPerGame);
    console.log('Shots/Game:', stats.offense.shotsPerGame);
    console.log('Shooting %:', stats.offense.shootingPct);
    console.log('PP %:', stats.offense.powerPlayPct);

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
  }, 30000);

  it('should have all defense stats populated', async () => {
    const stats = await getTeamComparisonData('BOS');

    console.log('\n=== DEFENSE STATS ===');
    console.log('GA/Game:', stats.defense.goalsAgainstPerGame);
    console.log('SA/Game:', stats.defense.shotsAgainstPerGame);
    console.log('PK %:', stats.defense.penaltyKillPct);

    expect(stats.defense.goalsAgainstPerGame).toBeGreaterThan(0);
    expect(stats.defense.shotsAgainstPerGame).toBeGreaterThan(0);
    expect(stats.defense.penaltyKillPct).toBeGreaterThan(0);

    expect(isNaN(stats.defense.goalsAgainstPerGame)).toBe(false);
    expect(isNaN(stats.defense.shotsAgainstPerGame)).toBe(false);
    expect(isNaN(stats.defense.penaltyKillPct)).toBe(false);
  }, 30000);

  it('should have all goaltending stats populated', async () => {
    const stats = await getTeamComparisonData('TOR');

    console.log('\n=== GOALTENDING STATS ===');
    console.log('Save % (decimal):', stats.goaltending.savePct);
    console.log('Save % (as displayed):', stats.goaltending.savePct * 100);
    console.log('GAA:', stats.goaltending.goalsAgainstAverage);

    expect(stats.goaltending.savePct).toBeGreaterThan(0);
    expect(stats.goaltending.savePct).toBeLessThan(1); // Should be decimal
    expect(stats.goaltending.goalsAgainstAverage).toBeGreaterThan(0);

    expect(isNaN(stats.goaltending.savePct)).toBe(false);
    expect(isNaN(stats.goaltending.goalsAgainstAverage)).toBe(false);
  }, 30000);

  it('should handle comparison between two teams correctly', async () => {
    const [tor, bos] = await Promise.all([
      getTeamComparisonData('TOR'),
      getTeamComparisonData('BOS'),
    ]);

    console.log('\n=== TOR vs BOS COMPARISON ===');
    console.log('TOR PP%:', tor.specialTeams.powerPlayPct.toFixed(1));
    console.log('BOS PP%:', bos.specialTeams.powerPlayPct.toFixed(1));
    console.log('TOR PK%:', tor.specialTeams.penaltyKillPct.toFixed(1));
    console.log('BOS PK%:', bos.specialTeams.penaltyKillPct.toFixed(1));
    console.log('TOR Save%:', (tor.goaltending.savePct * 100).toFixed(1));
    console.log('BOS Save%:', (bos.goaltending.savePct * 100).toFixed(1));

    // Both teams should have valid stats
    expect(tor.specialTeams.powerPlayPct).toBeGreaterThan(0);
    expect(bos.specialTeams.powerPlayPct).toBeGreaterThan(0);
    expect(tor.goaltending.savePct).toBeGreaterThan(0.8); // Most teams are > 80%
    expect(bos.goaltending.savePct).toBeGreaterThan(0.8);
  }, 30000);
});
