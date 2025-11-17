// Test to verify we're using REAL NHL data, not estimated/fake data
import { getTeamComparisonData } from '../teamComparison';

describe('Real NHL API Data (not estimated)', () => {
  it('should use real Power Play % from NHL API, not estimated from assumed opportunities', async () => {
    const stats = await getTeamComparisonData('TOR');

    // Fetch the REAL PP% from the correct API endpoint
    const response = await fetch('https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=seasonId=20252026%20and%20gameTypeId=2');
    const data = await response.json();
    const torData = data.data.find((t: any) => t.teamId === 10); // TOR team ID

    const realPowerPlayPct = torData.powerPlayPct * 100; // Convert to percentage

    // Our service should return the REAL PP%, not an estimated value
    // Current bug: It calculates from estimated 3.5 PP opportunities/game
    // Fix: Should fetch from team/summary API

    console.log('Real PP% from API:', realPowerPlayPct);
    console.log('Our calculated PP%:', stats.offense.powerPlayPct);
    console.log('Difference:', Math.abs(realPowerPlayPct - stats.offense.powerPlayPct));

    // Should match within 1% (allowing for small rounding differences)
    expect(Math.abs(stats.offense.powerPlayPct - realPowerPlayPct)).toBeLessThan(1);
  }, 30000);

  it('should use real Penalty Kill % from NHL API, not estimated', async () => {
    const stats = await getTeamComparisonData('BOS');

    // Fetch the REAL PK% from the correct API endpoint
    const response = await fetch('https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=seasonId=20252026%20and%20gameTypeId=2');
    const data = await response.json();
    const bosData = data.data.find((t: any) => t.teamId === 6); // BOS team ID

    const realPenaltyKillPct = bosData.penaltyKillPct * 100; // Convert to percentage

    // Our service should return the REAL PK%, not an estimated value
    // Current bug: It estimates from assumed 20% of goals are on PP
    // Fix: Should fetch from team/summary API

    console.log('Real PK% from API:', realPenaltyKillPct);
    console.log('Our calculated PK%:', stats.defense.penaltyKillPct);
    console.log('Difference:', Math.abs(realPenaltyKillPct - stats.defense.penaltyKillPct));

    // Should match within 1%
    expect(Math.abs(stats.defense.penaltyKillPct - realPenaltyKillPct)).toBeLessThan(1);
  }, 30000);

  it('should use real Shots Per Game from NHL API, not aggregated from incomplete player data', async () => {
    const stats = await getTeamComparisonData('TOR');

    // Fetch the REAL shots/game from the correct API endpoint
    const response = await fetch('https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=seasonId=20252026%20and%20gameTypeId=2');
    const data = await response.json();
    const torData = data.data.find((t: any) => t.teamId === 10);

    const realShotsPerGame = torData.shotsForPerGame;
    const realShotsAgainstPerGame = torData.shotsAgainstPerGame;

    console.log('Real Shots/Game from API:', realShotsPerGame);
    console.log('Our calculated Shots/Game:', stats.offense.shotsPerGame);
    console.log('Difference:', Math.abs(realShotsPerGame - stats.offense.shotsPerGame));

    // Should match within 0.5 shots/game
    expect(Math.abs(stats.offense.shotsPerGame - realShotsPerGame)).toBeLessThan(0.5);
    expect(Math.abs(stats.defense.shotsAgainstPerGame - realShotsAgainstPerGame)).toBeLessThan(0.5);
  }, 30000);
});
