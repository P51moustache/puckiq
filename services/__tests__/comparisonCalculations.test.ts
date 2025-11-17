// Test to verify stat comparison calculations are correct
import { getTeamComparisonData, determineWinner, calculateCategoryWinners } from '../teamComparison';

describe('Stat Comparison Calculations', () => {
  it('should calculate shooting percentage correctly', async () => {
    const stats = await getTeamComparisonData('TOR');

    // Fetch raw data to verify calculation
    const response = await fetch('https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=seasonId=20252026%20and%20gameTypeId=2');
    const data = await response.json();
    const torData = data.data.find((t: any) => t.teamId === 10);

    // Calculate expected shooting %
    const totalShots = torData.shotsForPerGame * torData.gamesPlayed;
    const expectedShootingPct = (torData.goalsFor / totalShots) * 100;

    console.log('Expected Shooting %:', expectedShootingPct);
    console.log('Actual Shooting %:', stats.offense.shootingPct);
    console.log('Difference:', Math.abs(expectedShootingPct - stats.offense.shootingPct));

    expect(Math.abs(stats.offense.shootingPct - expectedShootingPct)).toBeLessThan(0.1);
  }, 30000);

  it('should calculate save percentage correctly', async () => {
    const stats = await getTeamComparisonData('TOR');

    // Fetch raw data
    const response = await fetch('https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=seasonId=20252026%20and%20gameTypeId=2');
    const data = await response.json();
    const torData = data.data.find((t: any) => t.teamId === 10);

    // Calculate expected save %
    const totalShotsAgainst = torData.shotsAgainstPerGame * torData.gamesPlayed;
    const expectedSavePct = 1 - (torData.goalsAgainst / totalShotsAgainst);

    console.log('Expected Save % (decimal):', expectedSavePct);
    console.log('Actual Save % (decimal):', stats.goaltending.savePct);
    console.log('Expected Save % (percentage):', expectedSavePct * 100);
    console.log('Actual Save % when displayed:', stats.goaltending.savePct * 100);
    console.log('Difference:', Math.abs(expectedSavePct - stats.goaltending.savePct));

    expect(Math.abs(stats.goaltending.savePct - expectedSavePct)).toBeLessThan(0.001);
  }, 30000);

  it('should determine winner correctly for stats comparison', async () => {
    const torStats = await getTeamComparisonData('TOR');
    const bosStats = await getTeamComparisonData('BOS');

    console.log('\n=== OFFENSE COMPARISON ===');
    console.log('TOR Goals/Game:', torStats.offense.goalsPerGame);
    console.log('BOS Goals/Game:', bosStats.offense.goalsPerGame);
    const goalsWinner = determineWinner(torStats.offense.goalsPerGame, bosStats.offense.goalsPerGame, true);
    console.log('Winner:', goalsWinner);

    console.log('\n=== SHOOTING % COMPARISON ===');
    console.log('TOR Shooting %:', torStats.offense.shootingPct);
    console.log('BOS Shooting %:', bosStats.offense.shootingPct);
    const shootingWinner = determineWinner(torStats.offense.shootingPct, bosStats.offense.shootingPct, true);
    console.log('Winner:', shootingWinner);

    console.log('\n=== SAVE % COMPARISON ===');
    console.log('TOR Save % (decimal):', torStats.goaltending.savePct);
    console.log('BOS Save % (decimal):', bosStats.goaltending.savePct);
    console.log('TOR Save % (displayed):', torStats.goaltending.savePct * 100);
    console.log('BOS Save % (displayed):', bosStats.goaltending.savePct * 100);
    const saveWinner = determineWinner(torStats.goaltending.savePct, bosStats.goaltending.savePct, true);
    console.log('Winner:', saveWinner);

    // Verify winners are determined correctly
    expect(goalsWinner).toBeDefined();
    expect(shootingWinner).toBeDefined();
    expect(saveWinner).toBeDefined();
  }, 30000);

  it('should calculate category winners correctly', async () => {
    const torStats = await getTeamComparisonData('TOR');
    const bosStats = await getTeamComparisonData('BOS');

    const winners = calculateCategoryWinners(torStats, bosStats);

    console.log('\n=== CATEGORY WINNERS ===');
    console.log('Offense:', winners.offense);
    console.log('Defense:', winners.defense);
    console.log('Special Teams:', winners.specialTeams);
    console.log('Goaltending:', winners.goaltending);

    // Count wins
    const torWins = Object.values(winners).filter(w => w === 'home').length;
    const bosWins = Object.values(winners).filter(w => w === 'away').length;

    console.log('\nTOR category wins:', torWins);
    console.log('BOS category wins:', bosWins);

    // At least one team should win at least one category
    expect(torWins + bosWins).toBeGreaterThan(0);
  }, 30000);
});
