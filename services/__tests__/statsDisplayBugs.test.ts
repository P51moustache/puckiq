// Test to identify which stats are showing as 0, NaN, or undefined
import { getTeamComparisonData } from '../teamComparison';

describe('Stats Display Issues', () => {
  it('should identify stats that are 0 or undefined', async () => {
    const stats = await getTeamComparisonData('TOR');

    console.log('\n=== OFFENSE STATS ===');
    console.log('Goals/Game:', stats.offense.goalsPerGame, '(rank:', stats.offense.goalsPerGameRank, ')');
    console.log('Shots/Game:', stats.offense.shotsPerGame, '(rank:', stats.offense.shotsPerGameRank, ')');
    console.log('Shooting %:', stats.offense.shootingPct, '(rank:', stats.offense.shootingPctRank, ')');
    console.log('PP %:', stats.offense.powerPlayPct, '(rank:', stats.offense.powerPlayPctRank, ')');

    console.log('\n=== DEFENSE STATS ===');
    console.log('GA/Game:', stats.defense.goalsAgainstPerGame, '(rank:', stats.defense.goalsAgainstPerGameRank, ')');
    console.log('SA/Game:', stats.defense.shotsAgainstPerGame, '(rank:', stats.defense.shotsAgainstPerGameRank, ')');
    console.log('PK %:', stats.defense.penaltyKillPct, '(rank:', stats.defense.penaltyKillPctRank, ')');

    console.log('\n=== SPECIAL TEAMS STATS ===');
    console.log('PP %:', stats.specialTeams.powerPlayPct, '(rank:', stats.specialTeams.powerPlayPctRank, ')');
    console.log('PK %:', stats.specialTeams.penaltyKillPct, '(rank:', stats.specialTeams.penaltyKillPctRank, ')');
    console.log('PP Goals:', stats.specialTeams.powerPlayGoalsFor, '(rank:', stats.specialTeams.powerPlayGoalsForRank, ')');

    console.log('\n=== GOALTENDING STATS ===');
    console.log('Save %:', stats.goaltending.savePct, '(rank:', stats.goaltending.savePctRank, ')');
    console.log('GAA:', stats.goaltending.goalsAgainstAverage, '(rank:', stats.goaltending.goalsAgainstAverageRank, ')');

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

    console.log('\n=== PROBLEMS FOUND ===');
    if (problems.length > 0) {
      problems.forEach(p => console.log('⚠️', p));
    } else {
      console.log('✅ No obvious problems found');
    }

    // Fail the test if there are problems
    expect(problems).toEqual([]);
  }, 30000);

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
  }, 30000);
});
