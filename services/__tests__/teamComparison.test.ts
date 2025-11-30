import { getTeamComparisonData, calculateCategoryWinners, determineWinner } from '../teamComparison';

describe('teamComparison', () => {
  describe('getTeamComparisonData', () => {
    it('should return real team stats from NHL API', async () => {
      // Test with a real team (Toronto Maple Leafs)
      const stats = await getTeamComparisonData('TOR');

      // Should have real goals per game data
      expect(stats.offense.goalsPerGame).toBeGreaterThan(0);
      expect(stats.offense.goalsPerGameRank).toBeDefined();

      // Should have real goals against data
      expect(stats.defense.goalsAgainstPerGame).toBeGreaterThan(0);
      expect(stats.defense.goalsAgainstPerGameRank).toBeDefined();

      // Should have real shots data (aggregated from players)
      expect(stats.offense.shotsPerGame).toBeGreaterThan(0);

      // Should have real shooting percentage
      expect(stats.offense.shootingPct).toBeGreaterThan(0);
      expect(stats.offense.shootingPct).toBeLessThan(100);
    }, 30000);

    it('should calculate category winners correctly with real data', () => {
      const homeStats = {
        teamId: 10,
        teamAbbrev: 'TOR',
        offense: {
          goalsPerGame: 3.5,
          goalsPerGameRank: 5,
          shotsPerGame: 32.0,
          shotsPerGameRank: 10,
          shootingPct: 10.9,
          shootingPctRank: 8,
          powerPlayGoals: 20,
          powerPlayGoalsRank: 12,
          powerPlayPct: 22.5,
          powerPlayPctRank: 15,
          scoringFirst: 0,
          scoringFirstRank: undefined,
        },
        defense: {
          goalsAgainstPerGame: 2.8,
          goalsAgainstPerGameRank: 12,
          shotsAgainstPerGame: 30.0,
          shotsAgainstPerGameRank: 15,
          penaltyKillPct: 80.0,
          penaltyKillPctRank: 10,
          blockedShots: 0,
          blockedShotsRank: undefined,
          takeaways: 0,
          takeawaysRank: undefined,
          hits: 0,
          hitsRank: undefined,
        },
        specialTeams: {
          powerPlayOpportunities: 0,
          powerPlayOpportunitiesRank: undefined,
          powerPlayPct: 22.5,
          powerPlayPctRank: 15,
          penaltyKillPct: 80.0,
          penaltyKillPctRank: 10,
          shorthandedGoals: 0,
          shorthandedGoalsRank: undefined,
          powerPlayGoalsFor: 20,
          powerPlayGoalsForRank: 12,
          powerPlayGoalsAgainst: 0,
          powerPlayGoalsAgainstRank: undefined,
        },
        advanced: { corsiForPct: 0, corsiForPctRank: undefined, fenwickForPct: 0, fenwickForPctRank: undefined, pdo: 0, pdoRank: undefined, expectedGoalsFor: 0, expectedGoalsForRank: undefined, expectedGoalsAgainst: 0, expectedGoalsAgainstRank: undefined, highDangerChancesFor: 0, highDangerChancesForRank: undefined, highDangerChancesAgainst: 0, highDangerChancesAgainstRank: undefined, shotQuality: 0, shotQualityRank: undefined },
        goaltending: { savePct: 0, savePctRank: undefined, goalsAgainstAverage: 2.8, goalsAgainstAverageRank: 12, shutouts: 0, shutoutsRank: undefined, qualityStarts: 0, qualityStartsRank: undefined, highDangerSavePct: 0, highDangerSavePctRank: undefined, reboundControl: 0, reboundControlRank: undefined },
        discipline: { penaltiesPerGame: 0, penaltiesPerGameRank: undefined, penaltyMinutes: 0, penaltyMinutesRank: undefined, minorPenalties: 0, minorPenaltiesRank: undefined, majorPenalties: 0, majorPenaltiesRank: undefined },
      };

      const awayStats = {
        teamId: 6,
        teamAbbrev: 'BOS',
        offense: {
          goalsPerGame: 3.0,
          goalsPerGameRank: 15,
          shotsPerGame: 28.0,
          shotsPerGameRank: 20,
          shootingPct: 10.7,
          shootingPctRank: 10,
          powerPlayGoals: 15,
          powerPlayGoalsRank: 20,
          powerPlayPct: 20.0,
          powerPlayPctRank: 20,
          scoringFirst: 0,
          scoringFirstRank: undefined,
        },
        defense: {
          goalsAgainstPerGame: 3.2,
          goalsAgainstPerGameRank: 20,
          shotsAgainstPerGame: 32.0,
          shotsAgainstPerGameRank: 25,
          penaltyKillPct: 78.0,
          penaltyKillPctRank: 18,
          blockedShots: 0,
          blockedShotsRank: undefined,
          takeaways: 0,
          takeawaysRank: undefined,
          hits: 0,
          hitsRank: undefined,
        },
        specialTeams: {
          powerPlayOpportunities: 0,
          powerPlayOpportunitiesRank: undefined,
          powerPlayPct: 20.0,
          powerPlayPctRank: 20,
          penaltyKillPct: 78.0,
          penaltyKillPctRank: 18,
          shorthandedGoals: 0,
          shorthandedGoalsRank: undefined,
          powerPlayGoalsFor: 15,
          powerPlayGoalsForRank: 20,
          powerPlayGoalsAgainst: 0,
          powerPlayGoalsAgainstRank: undefined,
        },
        advanced: { corsiForPct: 0, corsiForPctRank: undefined, fenwickForPct: 0, fenwickForPctRank: undefined, pdo: 0, pdoRank: undefined, expectedGoalsFor: 0, expectedGoalsForRank: undefined, expectedGoalsAgainst: 0, expectedGoalsAgainstRank: undefined, highDangerChancesFor: 0, highDangerChancesForRank: undefined, highDangerChancesAgainst: 0, highDangerChancesAgainstRank: undefined, shotQuality: 0, shotQualityRank: undefined },
        goaltending: { savePct: 0, savePctRank: undefined, goalsAgainstAverage: 3.2, goalsAgainstAverageRank: 20, shutouts: 0, shutoutsRank: undefined, qualityStarts: 0, qualityStartsRank: undefined, highDangerSavePct: 0, highDangerSavePctRank: undefined, reboundControl: 0, reboundControlRank: undefined },
        discipline: { penaltiesPerGame: 0, penaltiesPerGameRank: undefined, penaltyMinutes: 0, penaltyMinutesRank: undefined, minorPenalties: 0, minorPenaltiesRank: undefined, majorPenalties: 0, majorPenaltiesRank: undefined },
      };

      const winners = calculateCategoryWinners(homeStats, awayStats);

      // Home should win offense (better goals/game, shots/game, shooting%)
      expect(winners.offense).toBe('home');

      // Home should win defense (lower goals against)
      expect(winners.defense).toBe('home');

      // Home should win special teams (better PP% and PK%)
      expect(winners.specialTeams).toBe('home');

      // Win counts should not be 0-0
      const winCounts = {
        home: Object.values(winners).filter(w => w === 'home').length,
        away: Object.values(winners).filter(w => w === 'away').length,
      };

      expect(winCounts.home).toBeGreaterThan(0);
    });
  });

  describe('determineWinner', () => {
    it('should determine winner correctly for higher is better stats', () => {
      expect(determineWinner(3.5, 3.0, true)).toBe('home');
      expect(determineWinner(3.0, 3.5, true)).toBe('away');
    });

    it('should determine winner correctly for lower is better stats', () => {
      expect(determineWinner(2.5, 3.0, false)).toBe('home');
      expect(determineWinner(3.0, 2.5, false)).toBe('away');
    });

    it('should return tie for very close values', () => {
      expect(determineWinner(3.0, 3.01, true)).toBe('tie');
    });
  });
});
