// Test to reproduce category winner calculation bug
import { getTeamComparisonData, calculateCategoryWinners, determineWinner } from '../teamComparison';
import { setupTeamComparisonMocks } from './fixtures/teamComparisonMocks';

beforeEach(() => {
  setupTeamComparisonMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Category Winner Bug', () => {
  it('should calculate category winners correctly (not including unavailable stats)', async () => {
    const [tor, bos] = await Promise.all([
      getTeamComparisonData('TOR'),
      getTeamComparisonData('BOS'),
    ]);

    const winners = calculateCategoryWinners(tor, bos);

    // Count the wins
    const homeWins = Object.values(winners).filter(w => w === 'home').length;
    const awayWins = Object.values(winners).filter(w => w === 'away').length;

    // Special Teams should reflect PP% and PK% comparisons
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

    if (ppWinner === pkWinner && ppWinner !== 'tie') {
      // If both PP% and PK% are won by the same team, special teams should match
      expect(winners.specialTeams).toBe(ppWinner);
    } else if (ppWinner !== 'tie' && pkWinner !== 'tie' && ppWinner !== pkWinner) {
      // If PP and PK have different winners, it should be a tie
      expect(winners.specialTeams).toBe('tie');
    }
  });

  it('should not count unavailable stats (0 values) in category winners', async () => {
    const [tor, bos] = await Promise.all([
      getTeamComparisonData('TOR'),
      getTeamComparisonData('BOS'),
    ]);

    // Advanced stats are all 0, so advanced category should be 'tie'
    expect(tor.advanced.corsiForPct).toBe(0);
    expect(bos.advanced.corsiForPct).toBe(0);

    const winners = calculateCategoryWinners(tor, bos);

    // Advanced should be tie (all stats are 0)
    expect(winners.advanced).toBe('tie');

    // Discipline should be tie (all stats are 0)
    expect(winners.discipline).toBe('tie');
  });
});
