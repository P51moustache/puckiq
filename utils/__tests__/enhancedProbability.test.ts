/**
 * Tests for enhanced win probability calculation with player factors
 *
 * This ensures that:
 * 1. Player factors (goalie matchup, hot players) affect displayed probability
 * 2. Enhanced probability works without player data (graceful degradation)
 * 3. Results are consistent across different screens
 */

import {
  calculateWinProbability,
  calculateWinProbabilityEnhanced,
  CONFIDENCE_WEIGHTS,
  PLAYER_WEIGHTS,
} from '../predictionUtils';
import type { StandingsData, PlayerPredictionFactors } from '../../types/predictions';

describe('Enhanced Win Probability with Player Factors', () => {
  // Mock standings data - moderate differences to allow room for player factor adjustments
  const mockStandings: StandingsData = {
    standings: [
      {
        teamAbbrev: { default: 'TOR' },
        pointPctg: 0.55,
        points: 55,
        wins: 27,
        losses: 23,
        otLosses: 5,
        gamesPlayed: 55,
        goalFor: 150,
        goalAgainst: 145,
        streakCode: 'W1',
      },
      {
        teamAbbrev: { default: 'MTL' },
        pointPctg: 0.50,
        points: 50,
        wins: 25,
        losses: 25,
        otLosses: 5,
        gamesPlayed: 55,
        goalFor: 145,
        goalAgainst: 150,
        streakCode: 'L1',
      },
    ],
  };

  // Mock player prediction factors with strong home goalie advantage
  const mockPlayerFactorsHomeAdvantage: PlayerPredictionFactors = {
    goalieMatchup: {
      homeGoalie: {
        id: 1,
        name: 'Home Starter',
        seasonStats: {
          gamesPlayed: 40,
          gamesStarted: 38,
          wins: 25,
          losses: 10,
          otLosses: 5,
          savePercentage: 0.920,
          goalsAgainstAverage: 2.30,
          shutouts: 4,
          shotsAgainst: 1200,
          saves: 1104,
          avgTimeOnIce: '58:30',
        },
        recentForm: null,
        isConfirmed: false,
      },
      awayGoalie: {
        id: 2,
        name: 'Away Starter',
        seasonStats: {
          gamesPlayed: 35,
          gamesStarted: 33,
          wins: 15,
          losses: 15,
          otLosses: 5,
          savePercentage: 0.890,
          goalsAgainstAverage: 3.20,
          shutouts: 1,
          shotsAgainst: 1000,
          saves: 890,
          avgTimeOnIce: '57:00',
        },
        recentForm: null,
        isConfirmed: false,
      },
      advantage: 'home',
      confidenceImpact: 12, // Strong advantage for home
    },
    homeHotPlayers: {
      teamAbbrev: 'TOR',
      hotPlayers: [
        { playerId: 101, playerName: 'Hot Scorer 1', position: 'C', gamesPlayed: 5, isHot: true, isCold: false },
        { playerId: 102, playerName: 'Hot Scorer 2', position: 'RW', gamesPlayed: 5, isHot: true, isCold: false },
      ],
      coldPlayers: [],
      injuredStars: [],
      overallHeatIndex: 2,
    },
    awayHotPlayers: {
      teamAbbrev: 'MTL',
      hotPlayers: [],
      coldPlayers: [
        { playerId: 201, playerName: 'Cold Player', position: 'C', gamesPlayed: 5, isHot: false, isCold: true },
      ],
      injuredStars: [],
      overallHeatIndex: -1,
    },
    totalImpact: 15, // Goalie (12) + hot players diff (3)
  };

  // Mock player factors with away goalie advantage
  const mockPlayerFactorsAwayAdvantage: PlayerPredictionFactors = {
    goalieMatchup: {
      homeGoalie: {
        id: 1,
        name: 'Home Backup',
        seasonStats: {
          gamesPlayed: 15,
          gamesStarted: 12,
          wins: 5,
          losses: 8,
          otLosses: 2,
          savePercentage: 0.880,
          goalsAgainstAverage: 3.50,
          shutouts: 0,
          shotsAgainst: 400,
          saves: 352,
          avgTimeOnIce: '55:00',
        },
        recentForm: null,
        isConfirmed: false,
      },
      awayGoalie: {
        id: 2,
        name: 'Away Starter',
        seasonStats: {
          gamesPlayed: 45,
          gamesStarted: 43,
          wins: 30,
          losses: 10,
          otLosses: 5,
          savePercentage: 0.925,
          goalsAgainstAverage: 2.10,
          shutouts: 6,
          shotsAgainst: 1350,
          saves: 1249,
          avgTimeOnIce: '59:00',
        },
        recentForm: null,
        isConfirmed: false,
      },
      advantage: 'away',
      confidenceImpact: -15, // Strong advantage for away
    },
    homeHotPlayers: {
      teamAbbrev: 'TOR',
      hotPlayers: [],
      coldPlayers: [],
      injuredStars: [],
      overallHeatIndex: 0,
    },
    awayHotPlayers: {
      teamAbbrev: 'MTL',
      hotPlayers: [
        { playerId: 201, playerName: 'Hot Player', position: 'C', gamesPlayed: 5, isHot: true, isCold: false },
      ],
      coldPlayers: [],
      injuredStars: [],
      overallHeatIndex: 1,
    },
    totalImpact: -16, // Goalie (-15) + hot players diff (-1)
  };

  describe('Basic calculateWinProbability (without player factors)', () => {
    it('should return valid probability range', () => {
      const result = calculateWinProbability('TOR', 'MTL', mockStandings);

      expect(result.homeWinProb).toBeGreaterThanOrEqual(15);
      expect(result.homeWinProb).toBeLessThanOrEqual(85);
      expect(result.awayWinProb).toBe(100 - result.homeWinProb);
    });

    it('should favor home team with better standings', () => {
      const result = calculateWinProbability('TOR', 'MTL', mockStandings);

      // TOR has better standings, home ice, so should be favored
      expect(result.homeWinProb).toBeGreaterThan(50);
    });
  });

  describe('calculateWinProbabilityEnhanced (with player factors)', () => {
    it('should increase home probability when home has goalie advantage', () => {
      const basicResult = calculateWinProbability('TOR', 'MTL', mockStandings);
      const enhancedResult = calculateWinProbabilityEnhanced(
        'TOR',
        'MTL',
        mockStandings,
        mockPlayerFactorsHomeAdvantage
      );

      // Enhanced should give home team higher probability due to goalie + hot players
      // If basic is already at cap (85), enhanced should also be at cap
      // If basic is below cap, enhanced should be higher
      if (basicResult.homeWinProb < 85) {
        expect(enhancedResult.homeWinProb).toBeGreaterThan(basicResult.homeWinProb);
      } else {
        expect(enhancedResult.homeWinProb).toBe(85);
      }
      // Player factors should be applied regardless
      expect(enhancedResult.playerFactorsApplied).toBe(true);
      expect(enhancedResult.goalieAdvantage).toBe('home');
    });

    it('should decrease home probability when away has goalie advantage', () => {
      const basicResult = calculateWinProbability('TOR', 'MTL', mockStandings);
      const enhancedResult = calculateWinProbabilityEnhanced(
        'TOR',
        'MTL',
        mockStandings,
        mockPlayerFactorsAwayAdvantage
      );

      // Enhanced should give home team lower probability due to away goalie advantage
      expect(enhancedResult.homeWinProb).toBeLessThan(basicResult.homeWinProb);
    });

    it('should fall back to basic calculation when no player factors provided', () => {
      const basicResult = calculateWinProbability('TOR', 'MTL', mockStandings);
      const enhancedResult = calculateWinProbabilityEnhanced('TOR', 'MTL', mockStandings, null);

      expect(enhancedResult.homeWinProb).toBe(basicResult.homeWinProb);
      expect(enhancedResult.awayWinProb).toBe(basicResult.awayWinProb);
    });

    it('should handle neutral goalie matchup', () => {
      const neutralFactors: PlayerPredictionFactors = {
        goalieMatchup: {
          homeGoalie: null,
          awayGoalie: null,
          advantage: 'neutral',
          confidenceImpact: 0,
        },
        homeHotPlayers: null,
        awayHotPlayers: null,
        totalImpact: 0,
      };

      const basicResult = calculateWinProbability('TOR', 'MTL', mockStandings);
      const enhancedResult = calculateWinProbabilityEnhanced(
        'TOR',
        'MTL',
        mockStandings,
        neutralFactors
      );

      // Should be same as basic when no advantage
      expect(enhancedResult.homeWinProb).toBe(basicResult.homeWinProb);
    });

    it('should clamp probability to valid range (15-85)', () => {
      // Create extreme player factors
      const extremeFactors: PlayerPredictionFactors = {
        goalieMatchup: {
          homeGoalie: null,
          awayGoalie: null,
          advantage: 'home',
          confidenceImpact: 50, // Extreme value
        },
        homeHotPlayers: {
          teamAbbrev: 'TOR',
          hotPlayers: [],
          coldPlayers: [],
          injuredStars: [],
          overallHeatIndex: 10,
        },
        awayHotPlayers: {
          teamAbbrev: 'MTL',
          hotPlayers: [],
          coldPlayers: [],
          injuredStars: [],
          overallHeatIndex: -10,
        },
        totalImpact: 70,
      };

      const result = calculateWinProbabilityEnhanced(
        'TOR',
        'MTL',
        mockStandings,
        extremeFactors
      );

      expect(result.homeWinProb).toBeLessThanOrEqual(85);
      expect(result.awayWinProb).toBeGreaterThanOrEqual(15);
    });

    it('should return additional player context in result', () => {
      const result = calculateWinProbabilityEnhanced(
        'TOR',
        'MTL',
        mockStandings,
        mockPlayerFactorsHomeAdvantage
      );

      // Should include player-related info
      expect(result).toHaveProperty('goalieAdvantage');
      expect(result).toHaveProperty('hotPlayersImpact');
      expect(result.goalieAdvantage).toBe('home');
    });
  });

  describe('Consistency between screens', () => {
    it('should produce same result when called with same inputs', () => {
      const result1 = calculateWinProbabilityEnhanced(
        'TOR',
        'MTL',
        mockStandings,
        mockPlayerFactorsHomeAdvantage
      );
      const result2 = calculateWinProbabilityEnhanced(
        'TOR',
        'MTL',
        mockStandings,
        mockPlayerFactorsHomeAdvantage
      );

      expect(result1.homeWinProb).toBe(result2.homeWinProb);
      expect(result1.awayWinProb).toBe(result2.awayWinProb);
    });

    it('should produce consistent predictions across Today and Picks tabs', () => {
      // Simulate Today Tab call (with player factors)
      const todayTabResult = calculateWinProbabilityEnhanced(
        'TOR',
        'MTL',
        mockStandings,
        mockPlayerFactorsHomeAdvantage
      );

      // Simulate Picks Tab call (with same player factors)
      const picksTabResult = calculateWinProbabilityEnhanced(
        'TOR',
        'MTL',
        mockStandings,
        mockPlayerFactorsHomeAdvantage
      );

      // Predictions should be identical
      expect(todayTabResult.homeWinProb).toBe(picksTabResult.homeWinProb);
      expect(todayTabResult.awayWinProb).toBe(picksTabResult.awayWinProb);
      expect(todayTabResult.goalieAdvantage).toBe(picksTabResult.goalieAdvantage);
      expect(todayTabResult.playerFactorsApplied).toBe(picksTabResult.playerFactorsApplied);
    });

    it('should derive same predicted winner across both tabs', () => {
      const todayTabResult = calculateWinProbabilityEnhanced(
        'TOR',
        'MTL',
        mockStandings,
        mockPlayerFactorsHomeAdvantage
      );
      const picksTabResult = calculateWinProbabilityEnhanced(
        'TOR',
        'MTL',
        mockStandings,
        mockPlayerFactorsHomeAdvantage
      );

      // Both tabs should predict the same winner
      const todayWinner = todayTabResult.homeWinProb > todayTabResult.awayWinProb ? 'TOR' : 'MTL';
      const picksWinner = picksTabResult.homeWinProb > picksTabResult.awayWinProb ? 'TOR' : 'MTL';

      expect(todayWinner).toBe(picksWinner);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing standings data', () => {
      const result = calculateWinProbabilityEnhanced(
        'TOR',
        'MTL',
        null,
        mockPlayerFactorsHomeAdvantage
      );

      expect(result.homeWinProb).toBe(50);
      expect(result.awayWinProb).toBe(50);
    });

    it('should handle team not found in standings', () => {
      const result = calculateWinProbabilityEnhanced(
        'XXX',
        'YYY',
        mockStandings,
        mockPlayerFactorsHomeAdvantage
      );

      expect(result.homeWinProb).toBe(50);
      expect(result.awayWinProb).toBe(50);
    });

    it('should handle empty standings array', () => {
      const emptyStandings: StandingsData = { standings: [] };
      const result = calculateWinProbabilityEnhanced(
        'TOR',
        'MTL',
        emptyStandings,
        mockPlayerFactorsHomeAdvantage
      );

      expect(result.homeWinProb).toBe(50);
      expect(result.awayWinProb).toBe(50);
    });
  });
});
