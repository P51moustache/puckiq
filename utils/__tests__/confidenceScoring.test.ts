/**
 * Tests for confidence scoring algorithm
 *
 * Current weights (BOOSTED for more confident predictions):
 * - standingsDifferential: 80 (season point%)
 * - homeIceAdvantage: 8 (fixed bonus)
 * - streakImpact: 12 (with diminishing returns scaling via 0.8 exponent)
 * - goalDifferentialImpact: 12 (per game)
 * - recentFormImpact: 40 (L5/L10)
 * - backToBackPenalty: 15
 * - restAdvantage: 8
 * - specialTeamsImpact: 25
 * - shotDifferentialImpact: 10
 *
 * Streak calculation uses Math.pow(cappedStreak, 0.8) for diminishing returns:
 * W1=1.0, W2=1.7, W3=2.4, W4=3.0, W5=3.6, W10=6.3
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

      // Base 50 + Home advantage 8 = 58
      expect(score).toBe(58);
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

      // Base 50 + (0.7-0.5)*80 = 50 + 16 = 66
      // + Home advantage 8 = 74
      // + Goal diff: (50/50) - (0/50) = 1.0, * 12 = 12
      // Total = 86
      expect(score).toBe(86);
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

      // Base 50 + (0.3-0.7)*80 = 50 - 32 = 18
      // + Home advantage 8 = 26
      // + Goal diff: (-40/50) - (50/50) = -0.8 - 1.0 = -1.8, * 12 = -21.6
      // Total = 4.4 ≈ 4
      expect(score).toBe(4);
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

      // Base 50 + Home advantage 8 = 58
      // + Streak: W5 scaled = 5^0.8 = 3.62, * 12 = 43.5
      // Total = 100 (capped)
      expect(score).toBe(100);
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

      // Base 50 + Home advantage 8 = 58
      // + Streak: (L4 scaled = -3.03) - (W2 scaled = 1.74) = -4.77, * 12 = -57.2
      // Total = 1 (rounded)
      expect(score).toBe(1);
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
      expect(score).toBe(58);
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

      // Base 50 + Home advantage 8 = 58
      // + Goal diff: (50/50 - 0/50) * 12 = 1.0 * 12 = 12
      // Total = 70
      expect(score).toBe(70);
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
      // Diff: 0.5 - 0.2 = 0.3, * 12 = 3.6 ≈ 4
      // Base 50 + Home 8 + GD 4 = 62
      expect(score).toBe(62);
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
      // Standings: (0.6-0.5) * 80 = 8
      // Home advantage: 8
      // Streaks: (W3 = 2.41) - (L2 = -1.74) = 4.15, * 12 = 49.8
      // Goal diff: (20/50 - (-5/50)) * 12 = (0.4 + 0.1) * 12 = 6
      // Total: 50 + 8 + 8 + 49.8 + 6 = 121.8 → capped at 100
      expect(score).toBe(100);
    });
  });
});
