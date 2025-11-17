import { getPredictedWinner } from '../../../utils/predictionHelpers';

describe('MyPicks AI Predictions', () => {
  describe('getPredictedWinner', () => {
    it('should return home team when home win probability is higher', () => {
      const standings = {
        standings: [
          {
            teamAbbrev: { default: 'TOR' },
            pointPctg: 0.65,
            points: 80,
            wins: 35,
            losses: 15,
            otLosses: 5,
            streakCode: 'W3',
          },
          {
            teamAbbrev: { default: 'MTL' },
            pointPctg: 0.45,
            points: 55,
            wins: 25,
            losses: 25,
            otLosses: 5,
            streakCode: 'L2',
          },
        ],
      };

      const prediction = getPredictedWinner('TOR', 'MTL', standings);

      // Home team (TOR) has 0.65 + 0.1 (home advantage) = 0.75
      // Away team (MTL) has 0.45
      // TOR should win
      expect(prediction).toBe('TOR');
    });

    it('should return away team when away win probability is significantly higher despite home advantage', () => {
      const standings = {
        standings: [
          {
            teamAbbrev: { default: 'CHI' },
            pointPctg: 0.35,
            points: 45,
            wins: 20,
            losses: 30,
            otLosses: 5,
            streakCode: 'L5',
          },
          {
            teamAbbrev: { default: 'BOS' },
            pointPctg: 0.75,
            points: 95,
            wins: 42,
            losses: 10,
            otLosses: 3,
            streakCode: 'W7',
          },
        ],
      };

      const prediction = getPredictedWinner('CHI', 'BOS', standings);

      // Home team (CHI) has 0.35 + 0.1 (home advantage) = 0.45
      // Away team (BOS) has 0.75
      // BOS should win despite being away
      expect(prediction).toBe('BOS');
    });

    it('should return home team when probabilities are equal (home advantage wins tiebreak)', () => {
      const standings = {
        standings: [
          {
            teamAbbrev: { default: 'NYR' },
            pointPctg: 0.55,
            points: 70,
            wins: 30,
            losses: 20,
            otLosses: 5,
            streakCode: 'W1',
          },
          {
            teamAbbrev: { default: 'NYI' },
            pointPctg: 0.65,
            points: 80,
            wins: 35,
            losses: 18,
            otLosses: 2,
            streakCode: 'W2',
          },
        ],
      };

      const prediction = getPredictedWinner('NYR', 'NYI', standings);

      // Home team (NYR) has 0.55 + 0.1 = 0.65
      // Away team (NYI) has 0.65
      // Tie goes to home team due to home advantage
      expect(prediction).toBe('NYR');
    });

    it('should handle missing standings data gracefully', () => {
      const standings = {
        standings: [
          {
            teamAbbrev: { default: 'TOR' },
            pointPctg: 0.60,
          },
        ],
      };

      const prediction = getPredictedWinner('TOR', 'MTL', standings);

      // MTL not in standings, should use default 0.5
      // TOR has 0.60 + 0.1 = 0.70, MTL has 0.50
      expect(prediction).toBe('TOR');
    });

    it('should handle teamAbbrev as string (not object)', () => {
      const standings = {
        standings: [
          {
            teamAbbrev: 'TOR',
            pointPctg: 0.65,
          },
          {
            teamAbbrev: 'MTL',
            pointPctg: 0.45,
          },
        ],
      };

      const prediction = getPredictedWinner('TOR', 'MTL', standings);
      expect(prediction).toBe('TOR');
    });
  });
});
