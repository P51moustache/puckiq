/**
 * Tests for prediction helper functions
 */

import { getPredictedWinner } from '../predictionHelpers';

describe('predictionHelpers', () => {
  const mockStandings = {
    standings: [
      {
        teamAbbrev: { default: 'TOR' },
        pointPctg: 0.700,
        wins: 35,
        losses: 10,
        otLosses: 5,
        points: 75,
        goalFor: 150,
        goalAgainst: 100,
        streakCode: 'W5',
      },
      {
        teamAbbrev: { default: 'MTL' },
        pointPctg: 0.500,
        wins: 25,
        losses: 20,
        otLosses: 5,
        points: 55,
        goalFor: 120,
        goalAgainst: 120,
        streakCode: 'L2',
      },
      {
        teamAbbrev: { default: 'BOS' },
        pointPctg: 0.650,
        wins: 32,
        losses: 15,
        otLosses: 3,
        points: 67,
        goalFor: 140,
        goalAgainst: 110,
        streakCode: 'W3',
      },
      {
        teamAbbrev: 'NYR', // Test direct string format
        pointPctg: 0.600,
        wins: 30,
        losses: 18,
        otLosses: 2,
        points: 62,
      },
    ],
  };

  describe('getPredictedWinner', () => {
    it('should predict home team when they have higher point percentage with home advantage', () => {
      const winner = getPredictedWinner('TOR', 'MTL', mockStandings);

      // TOR: 0.700 + 0.1 = 0.8
      // MTL: 0.500
      expect(winner).toBe('TOR');
    });

    it('should predict away team when their advantage overcomes home ice', () => {
      const winner = getPredictedWinner('MTL', 'TOR', mockStandings);

      // MTL: 0.500 + 0.1 = 0.6
      // TOR: 0.700
      expect(winner).toBe('TOR');
    });

    it('should give home team advantage in close matchups', () => {
      const winner = getPredictedWinner('BOS', 'NYR', mockStandings);

      // BOS: 0.650 + 0.1 = 0.75
      // NYR: 0.600
      expect(winner).toBe('BOS');
    });

    it('should default to home team when standings data missing', () => {
      const winner = getPredictedWinner('TOR', 'MTL', null);

      expect(winner).toBe('TOR');
    });

    it('should default to home team when standings.standings missing', () => {
      const winner = getPredictedWinner('TOR', 'MTL', { standings: null });

      expect(winner).toBe('TOR');
    });

    it('should handle missing home team in standings', () => {
      const winner = getPredictedWinner('UNKNOWN', 'TOR', mockStandings);

      // Home team not found, so away team wins
      expect(winner).toBe('TOR');
    });

    it('should handle missing away team in standings', () => {
      const winner = getPredictedWinner('TOR', 'UNKNOWN', mockStandings);

      // Away team not found, so home team wins
      expect(winner).toBe('TOR');
    });

    it('should handle both teams missing from standings', () => {
      const winner = getPredictedWinner('UNKNOWN1', 'UNKNOWN2', mockStandings);

      // Neither found, default to home team
      expect(winner).toBe('UNKNOWN1');
    });

    it('should handle teamAbbrev as direct string (not nested object)', () => {
      const winner = getPredictedWinner('NYR', 'MTL', mockStandings);

      // NYR: 0.600 + 0.1 = 0.7
      // MTL: 0.500
      expect(winner).toBe('NYR');
    });

    it('should handle missing pointPctg (defaults to 0.5)', () => {
      const standings = {
        standings: [
          { teamAbbrev: 'TEAM1' }, // No pointPctg
          { teamAbbrev: 'TEAM2', pointPctg: 0.6 },
        ],
      };

      const winner = getPredictedWinner('TEAM1', 'TEAM2', standings);

      // TEAM1: 0.5 + 0.1 = 0.6
      // TEAM2: 0.6
      // Tie goes to home team
      expect(winner).toBe('TEAM1');
    });

    it('should give tie to home team (>= comparison)', () => {
      const standings = {
        standings: [
          { teamAbbrev: 'TEAM1', pointPctg: 0.5 },
          { teamAbbrev: 'TEAM2', pointPctg: 0.6 },
        ],
      };

      const winner = getPredictedWinner('TEAM1', 'TEAM2', standings);

      // TEAM1: 0.5 + 0.1 = 0.6
      // TEAM2: 0.6
      // Exact tie, home team wins
      expect(winner).toBe('TEAM1');
    });

    it('should handle very close matchups', () => {
      const standings = {
        standings: [
          { teamAbbrev: 'TEAM1', pointPctg: 0.505 },
          { teamAbbrev: 'TEAM2', pointPctg: 0.500 },
        ],
      };

      const winner = getPredictedWinner('TEAM2', 'TEAM1', standings);

      // TEAM2: 0.500 + 0.1 = 0.6
      // TEAM1: 0.505
      // Home advantage tips the scale
      expect(winner).toBe('TEAM2');
    });
  });
});
