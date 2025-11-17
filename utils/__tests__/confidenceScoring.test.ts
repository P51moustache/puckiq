/**
 * Tests for confidence scoring algorithm
 */

import { calculateConfidenceScore } from '../predictionUtils';
import type { TeamStandings, GameData } from '../../types/predictions';

describe('Confidence Scoring Algorithm', () => {

  const mockGame: GameData = {
    id: 12345,
    homeTeam: { abbrev: 'TOR' },
    awayTeam: { abbrev: 'MTL' },
  };

  describe('Base Cases', () => {
    it('should return 50 when no team data available', () => {
      const score = calculateConfidenceScore(mockGame, null, null);
      expect(score).toBe(50);
    });

    it('should return 50 when home team data missing', () => {
      const awayTeam = { pointPctg: 0.5 };
      const score = calculateConfidenceScore(mockGame, null, awayTeam);
      expect(score).toBe(50);
    });

    it('should return 50 when away team data missing', () => {
      const homeTeam = { pointPctg: 0.5 };
      const score = calculateConfidenceScore(mockGame, homeTeam, null);
      expect(score).toBe(50);
    });

    it('should give home ice advantage when teams are equal', () => {
      const homeTeam = {
        pointPctg: 0.5,
        goalFor: 100,
        goalAgainst: 100,
        gamesPlayed: 50,
      };
      const awayTeam = {
        pointPctg: 0.5,
        goalFor: 100,
        goalAgainst: 100,
        gamesPlayed: 50,
      };

      const score = calculateConfidenceScore(mockGame, homeTeam, awayTeam);

      // Base 50 + Home advantage 5 = 55
      expect(score).toBe(55);
    });
  });

  describe('Standings Differential Factor', () => {
    it('should increase confidence when home team has better record', () => {
      const homeTeam = {
        pointPctg: 0.7,
        goalFor: 150,
        goalAgainst: 100,
        gamesPlayed: 50,
      };
      const awayTeam = {
        pointPctg: 0.5,
        goalFor: 100,
        goalAgainst: 100,
        gamesPlayed: 50,
      };

      const score = calculateConfidenceScore(mockGame, homeTeam, awayTeam);

      // Base 50 + (0.7-0.5)*30 = 50 + 6 = 56
      // + Home advantage 5 = 61
      // + Goal diff: (50/50) - (0/50) = 1.0, * 3 = 3
      // Total = 64
      expect(score).toBe(64);
    });

    it('should decrease confidence when away team is significantly better', () => {
      const homeTeam = {
        pointPctg: 0.3,
        goalFor: 80,
        goalAgainst: 120,
        gamesPlayed: 50,
      };
      const awayTeam = {
        pointPctg: 0.7,
        goalFor: 150,
        goalAgainst: 100,
        gamesPlayed: 50,
      };

      const score = calculateConfidenceScore(mockGame, homeTeam, awayTeam);

      // Base 50 + (0.3-0.7)*30 = 50 - 12 = 38
      // + Home advantage 5 = 43
      // + Goal diff: (-40/50) - (50/50) = -0.8 - 1.0 = -1.8, * 3 = -5.4 ≈ -5
      // Total = 38
      expect(score).toBe(38);
    });
  });

  describe('Streak Factor', () => {
    it('should boost confidence for home team on winning streak', () => {
      const homeTeam = {
        pointPctg: 0.5,
        streakCode: 'W5',
        goalFor: 100,
        goalAgainst: 100,
        gamesPlayed: 50,
      };
      const awayTeam = {
        pointPctg: 0.5,
        goalFor: 100,
        goalAgainst: 100,
        gamesPlayed: 50,
      };

      const score = calculateConfidenceScore(mockGame, homeTeam, awayTeam);

      // Base 50 + Home advantage 5 = 55
      // + Streak: (5 - 0) * 2 = 10
      // Total = 65
      expect(score).toBe(65);
    });

    it('should reduce confidence for home team on losing streak', () => {
      const homeTeam = {
        pointPctg: 0.5,
        streakCode: 'L4',
        goalFor: 100,
        goalAgainst: 100,
        gamesPlayed: 50,
      };
      const awayTeam = {
        pointPctg: 0.5,
        streakCode: 'W2',
        goalFor: 100,
        goalAgainst: 100,
        gamesPlayed: 50,
      };

      const score = calculateConfidenceScore(mockGame, homeTeam, awayTeam);

      // Base 50 + Home advantage 5 = 55
      // + Streak: (-4 - 2) * 2 = -12
      // Total = 43
      expect(score).toBe(43);
    });

    it('should handle missing streak codes', () => {
      const homeTeam = {
        pointPctg: 0.5,
        goalFor: 100,
        goalAgainst: 100,
        gamesPlayed: 50,
      };
      const awayTeam = {
        pointPctg: 0.5,
        goalFor: 100,
        goalAgainst: 100,
        gamesPlayed: 50,
      };

      const score = calculateConfidenceScore(mockGame, homeTeam, awayTeam);

      // No streaks, so just base + home advantage
      expect(score).toBe(55);
    });
  });

  describe('Goal Differential Factor', () => {
    it('should boost confidence for strong offensive home team', () => {
      const homeTeam = {
        pointPctg: 0.5,
        goalFor: 150,
        goalAgainst: 100,
        gamesPlayed: 50,
      };
      const awayTeam = {
        pointPctg: 0.5,
        goalFor: 100,
        goalAgainst: 100,
        gamesPlayed: 50,
      };

      const score = calculateConfidenceScore(mockGame, homeTeam, awayTeam);

      // Base 50 + Home advantage 5 = 55
      // + Goal diff: (50/50 - 0/50) * 3 = 1.0 * 3 = 3
      // Total = 58
      expect(score).toBe(58);
    });

    it('should handle teams with different games played', () => {
      const homeTeam = {
        pointPctg: 0.5,
        goalFor: 100,
        goalAgainst: 80,
        gamesPlayed: 40,
      };
      const awayTeam = {
        pointPctg: 0.5,
        goalFor: 150,
        goalAgainst: 140,
        gamesPlayed: 50,
      };

      const score = calculateConfidenceScore(mockGame, homeTeam, awayTeam);

      // Home GD per game: 20/40 = 0.5
      // Away GD per game: 10/50 = 0.2
      // Diff: 0.5 - 0.2 = 0.3, * 3 = 0.9 ≈ 1
      // Base 50 + Home 5 + GD 1 = 56
      expect(score).toBe(56);
    });
  });

  describe('Normalization', () => {
    it('should cap score at 100', () => {
      const homeTeam = {
        pointPctg: 0.9,
        streakCode: 'W10',
        goalFor: 250,
        goalAgainst: 80,
        gamesPlayed: 50,
      };
      const awayTeam = {
        pointPctg: 0.2,
        streakCode: 'L8',
        goalFor: 80,
        goalAgainst: 200,
        gamesPlayed: 50,
      };

      const score = calculateConfidenceScore(mockGame, homeTeam, awayTeam);

      expect(score).toBe(100);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should floor score at 0', () => {
      const homeTeam = {
        pointPctg: 0.1,
        streakCode: 'L10',
        goalFor: 50,
        goalAgainst: 200,
        gamesPlayed: 50,
      };
      const awayTeam = {
        pointPctg: 0.9,
        streakCode: 'W8',
        goalFor: 200,
        goalAgainst: 80,
        gamesPlayed: 50,
      };

      const score = calculateConfidenceScore(mockGame, homeTeam, awayTeam);

      expect(score).toBe(0);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Multi-Factor Integration', () => {
    it('should combine all factors correctly', () => {
      const homeTeam = {
        pointPctg: 0.6,
        streakCode: 'W3',
        goalFor: 130,
        goalAgainst: 110,
        gamesPlayed: 50,
      };
      const awayTeam = {
        pointPctg: 0.5,
        streakCode: 'L2',
        goalFor: 100,
        goalAgainst: 105,
        gamesPlayed: 50,
      };

      const score = calculateConfidenceScore(mockGame, homeTeam, awayTeam);

      // Base: 50
      // Standings: (0.6-0.5) * 30 = 3
      // Home advantage: 5
      // Streaks: (3 - (-2)) * 2 = 10
      // Goal diff: (20/50 - (-5/50)) * 3 = (0.4 + 0.1) * 3 = 1.5 ≈ 2
      // Total: 50 + 3 + 5 + 10 + 2 = 70
      expect(score).toBe(70);
    });
  });
});
