// Test to reproduce category winner calculation bug
import { getTeamComparisonData, calculateCategoryWinners } from '../teamComparison';

describe('Category Winner Bug', () => {
  it('should calculate category winners correctly (not including unavailable stats)', async () => {
    const [tor, bos] = await Promise.all([
      getTeamComparisonData('TOR'),
      getTeamComparisonData('BOS'),
    ]);

    console.log('\n=== TOR STATS ===');
    console.log('Offense - Goals/Game:', tor.offense.goalsPerGame);
    console.log('Offense - Shots/Game:', tor.offense.shotsPerGame);
    console.log('Offense - Shooting %:', tor.offense.shootingPct);
    console.log('Offense - PP%:', tor.offense.powerPlayPct);
    console.log('');
    console.log('Defense - GA/Game:', tor.defense.goalsAgainstPerGame);
    console.log('Defense - SA/Game:', tor.defense.shotsAgainstPerGame);
    console.log('Defense - PK%:', tor.defense.penaltyKillPct);
    console.log('Defense - Blocked Shots:', tor.defense.blockedShots, '← PROBLEM: Always 0');
    console.log('');
    console.log('Special Teams - PP%:', tor.specialTeams.powerPlayPct);
    console.log('Special Teams - PK%:', tor.specialTeams.penaltyKillPct);
    console.log('');
    console.log('Goaltending - Save%:', tor.goaltending.savePct);
    console.log('Goaltending - GAA:', tor.goaltending.goalsAgainstAverage);

    console.log('\n=== BOS STATS ===');
    console.log('Offense - Goals/Game:', bos.offense.goalsPerGame);
    console.log('Offense - Shots/Game:', bos.offense.shotsPerGame);
    console.log('Offense - Shooting %:', bos.offense.shootingPct);
    console.log('Offense - PP%:', bos.offense.powerPlayPct);
    console.log('');
    console.log('Defense - GA/Game:', bos.defense.goalsAgainstPerGame);
    console.log('Defense - SA/Game:', bos.defense.shotsAgainstPerGame);
    console.log('Defense - PK%:', bos.defense.penaltyKillPct);
    console.log('Defense - Blocked Shots:', bos.defense.blockedShots, '← PROBLEM: Always 0');
    console.log('');
    console.log('Special Teams - PP%:', bos.specialTeams.powerPlayPct);
    console.log('Special Teams - PK%:', bos.specialTeams.penaltyKillPct);
    console.log('');
    console.log('Goaltending - Save%:', bos.goaltending.savePct);
    console.log('Goaltending - GAA:', bos.goaltending.goalsAgainstAverage);

    const winners = calculateCategoryWinners(tor, bos);

    console.log('\n=== CATEGORY WINNERS (CURRENT) ===');
    console.log('Offense:', winners.offense);
    console.log('Defense:', winners.defense);
    console.log('Special Teams:', winners.specialTeams);
    console.log('Advanced:', winners.advanced);
    console.log('Goaltending:', winners.goaltending);
    console.log('Discipline:', winners.discipline);

    // Count the wins
    const homeWins = Object.values(winners).filter(w => w === 'home').length;
    const awayWins = Object.values(winners).filter(w => w === 'away').length;
    const ties = Object.values(winners).filter(w => w === 'tie').length;

    console.log('\n=== WIN COUNTS ===');
    console.log('TOR (home) wins:', homeWins);
    console.log('BOS (away) wins:', awayWins);
    console.log('Ties:', ties);

    // The problem: Defense category includes blockedShots (0 vs 0)
    // This makes defense calculation include a tie, affecting the result

    // Special Teams should NOT be a tie (PP% and PK% are both real stats)
    console.log('\n=== SPECIAL TEAMS ANALYSIS ===');
    if (tor.specialTeams.powerPlayPct !== bos.specialTeams.powerPlayPct) {
      console.log('PP% are different, so there should be a winner');
    }
    if (tor.specialTeams.penaltyKillPct !== bos.specialTeams.penaltyKillPct) {
      console.log('PK% are different, so there should be a winner');
    }

    // If both PP% and PK% are different, Special Teams should NOT be a tie
    // unless one team wins PP% and the other wins PK%
    const ppWinner = tor.specialTeams.powerPlayPct > bos.specialTeams.powerPlayPct ? 'home' : 'away';
    const pkWinner = tor.specialTeams.penaltyKillPct > bos.specialTeams.penaltyKillPct ? 'home' : 'away';
    console.log('PP% winner:', ppWinner);
    console.log('PK% winner:', pkWinner);

    if (ppWinner === pkWinner) {
      console.log('Expected Special Teams winner:', ppWinner);
      console.log('Actual Special Teams winner:', winners.specialTeams);

      // This should NOT be a tie
      expect(winners.specialTeams).toBe(ppWinner);
    } else {
      console.log('PP and PK winners are different, so Special Teams should be tie');
      expect(winners.specialTeams).toBe('tie');
    }
  }, 30000);

  it('should not count unavailable stats (0 values) in category winners', async () => {
    const [tor, bos] = await Promise.all([
      getTeamComparisonData('TOR'),
      getTeamComparisonData('BOS'),
    ]);

    // Advanced stats are all 0, so advanced category should be 'tie'
    // But it shouldn't affect other categories
    expect(tor.advanced.corsiForPct).toBe(0);
    expect(bos.advanced.corsiForPct).toBe(0);

    const winners = calculateCategoryWinners(tor, bos);

    // Advanced should be tie (all stats are 0)
    expect(winners.advanced).toBe('tie');

    // Discipline should be tie (all stats are 0)
    expect(winners.discipline).toBe('tie');

    // But these should have winners or ties based on REAL stats only
    console.log('Defense winner:', winners.defense);
    console.log('Special Teams winner:', winners.specialTeams);
    console.log('Goaltending winner:', winners.goaltending);
  }, 30000);
});
