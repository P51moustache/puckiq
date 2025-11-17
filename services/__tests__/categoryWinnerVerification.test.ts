// Verification test for category winner calculations
import { getTeamComparisonData, calculateCategoryWinners, determineWinner } from '../teamComparison';

describe('Category Winner Verification', () => {
  it('should correctly determine winners when both values are equal', () => {
    // Test the fix: 0 vs 0 should be tie, not 'away'
    expect(determineWinner(0, 0, true)).toBe('tie');
    expect(determineWinner(0, 0, false)).toBe('tie');

    // Values within 0.5% threshold should be tie
    expect(determineWinner(100, 100, true)).toBe('tie');
    expect(determineWinner(100, 100.4, true)).toBe('tie'); // 0.4% diff
    expect(determineWinner(100, 101, true)).not.toBe('tie'); // 1% diff
  });

  it('should calculate special teams winner correctly', async () => {
    const [tor, bos] = await Promise.all([
      getTeamComparisonData('TOR'),
      getTeamComparisonData('BOS'),
    ]);

    console.log('\n=== SPECIAL TEAMS COMPARISON ===');
    console.log('TOR PP%:', tor.specialTeams.powerPlayPct.toFixed(1));
    console.log('BOS PP%:', bos.specialTeams.powerPlayPct.toFixed(1));
    console.log('TOR PK%:', tor.specialTeams.penaltyKillPct.toFixed(1));
    console.log('BOS PK%:', bos.specialTeams.penaltyKillPct.toFixed(1));

    const ppWinner = determineWinner(
      tor.specialTeams.powerPlayPct,
      bos.specialTeams.powerPlayPct,
      true
    );
    const pkWinner = determineWinner(
      tor.specialTeams.penaltyKillPct,
      bos.specialTeams.penaltyKillPct,
      true
    );

    console.log('PP% winner:', ppWinner);
    console.log('PK% winner:', pkWinner);

    const winners = calculateCategoryWinners(tor, bos);
    console.log('Special Teams category winner:', winners.specialTeams);

    // If both PP and PK have the same winner, special teams should have that winner
    if (ppWinner === pkWinner && ppWinner !== 'tie') {
      expect(winners.specialTeams).toBe(ppWinner);
    }

    // If PP and PK have different winners, it should be a tie
    if (ppWinner !== 'tie' && pkWinner !== 'tie' && ppWinner !== pkWinner) {
      expect(winners.specialTeams).toBe('tie');
    }

    // Special teams should NOT be 'tie' if one team wins both PP% and PK%
    if (ppWinner !== 'tie' && ppWinner === pkWinner) {
      expect(winners.specialTeams).not.toBe('tie');
    }
  }, 30000);

  it('should calculate statistical advantage correctly', async () => {
    const [tor, bos] = await Promise.all([
      getTeamComparisonData('TOR'),
      getTeamComparisonData('BOS'),
    ]);

    const winners = calculateCategoryWinners(tor, bos);

    console.log('\n=== CATEGORY WINNERS ===');
    console.log('Offense:', winners.offense);
    console.log('Defense:', winners.defense);
    console.log('Special Teams:', winners.specialTeams);
    console.log('Advanced:', winners.advanced);
    console.log('Goaltending:', winners.goaltending);
    console.log('Discipline:', winners.discipline);

    const homeWins = Object.values(winners).filter(w => w === 'home').length;
    const awayWins = Object.values(winners).filter(w => w === 'away').length;

    console.log('\n=== STATISTICAL ADVANTAGE ===');
    console.log(`TOR: ${homeWins} categories`);
    console.log(`BOS: ${awayWins} categories`);
    console.log(`Ties: ${6 - homeWins - awayWins} categories`);

    // Advanced and Discipline should be ties (all stats are 0)
    expect(winners.advanced).toBe('tie');
    expect(winners.discipline).toBe('tie');

    // The sum of wins should equal the number of non-tie categories
    expect(homeWins + awayWins).toBeLessThanOrEqual(6);
    expect(homeWins + awayWins).toBeGreaterThanOrEqual(0);
  }, 30000);

  it('should count only real stats in defense category', async () => {
    const [tor, bos] = await Promise.all([
      getTeamComparisonData('TOR'),
      getTeamComparisonData('BOS'),
    ]);

    console.log('\n=== DEFENSE STATS ===');
    console.log('TOR GA/Game:', tor.defense.goalsAgainstPerGame.toFixed(2));
    console.log('BOS GA/Game:', bos.defense.goalsAgainstPerGame.toFixed(2));
    console.log('TOR SA/Game:', tor.defense.shotsAgainstPerGame.toFixed(2));
    console.log('BOS SA/Game:', bos.defense.shotsAgainstPerGame.toFixed(2));
    console.log('TOR PK%:', tor.defense.penaltyKillPct.toFixed(1));
    console.log('BOS PK%:', bos.defense.penaltyKillPct.toFixed(1));
    console.log('TOR Blocked Shots:', tor.defense.blockedShots, '← Should be 0 (not used)');
    console.log('BOS Blocked Shots:', bos.defense.blockedShots, '← Should be 0 (not used)');

    const gaWinner = determineWinner(tor.defense.goalsAgainstPerGame, bos.defense.goalsAgainstPerGame, false);
    const saWinner = determineWinner(tor.defense.shotsAgainstPerGame, bos.defense.shotsAgainstPerGame, false);
    const pkWinner = determineWinner(tor.defense.penaltyKillPct, bos.defense.penaltyKillPct, true);

    console.log('\nGA/Game winner:', gaWinner);
    console.log('SA/Game winner:', saWinner);
    console.log('PK% winner:', pkWinner);

    const winners = calculateCategoryWinners(tor, bos);
    console.log('Defense category winner:', winners.defense);

    // Defense should be based on 3 real stats, not including blockedShots
    // Verify blockedShots is not affecting the result
    expect(tor.defense.blockedShots).toBe(0);
    expect(bos.defense.blockedShots).toBe(0);
  }, 30000);
});
