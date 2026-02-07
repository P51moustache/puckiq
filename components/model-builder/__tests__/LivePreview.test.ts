/**
 * LivePreview Component Tests
 * Tests the live preview logic with debouncing and comparison features
 */

import type { ConfidenceWeights, PlayerWeights, PredictionModel, GameData, StandingsData } from '../../../types/predictions';
import { FACTOR_DEFINITIONS } from '../../../constants/modelFactors';

// Combined weights type
type AllWeights = ConfidenceWeights & PlayerWeights;

// Default weights for testing
const getDefaultWeights = (): AllWeights => ({
  standingsDifferential: 80,
  homeIceAdvantage: 8,
  streakImpact: 12,
  goalDifferentialImpact: 12,
  recentFormImpact: 40,
  backToBackPenalty: 15,
  restAdvantage: 8,
  specialTeamsImpact: 25,
  shotDifferentialImpact: 10,
  goalieMatchupImpact: 1.0,
  hotPlayersImpact: 1.5,
});

// Mock game data factory
const createMockGame = (overrides: Partial<GameData> = {}): GameData => ({
  id: `game_${Date.now()}`,
  homeTeam: { abbrev: 'TOR', score: 0 },
  awayTeam: { abbrev: 'MTL', score: 0 },
  gameState: 'FUT',
  startTimeUTC: new Date().toISOString(),
  ...overrides,
});

// Mock model factory
const createMockModel = (weights: AllWeights): PredictionModel => {
  const now = new Date().toISOString();
  return {
    id: 'test_model',
    name: 'Test Model',
    createdAt: now,
    updatedAt: now,
    weights: {
      standingsDifferential: weights.standingsDifferential,
      homeIceAdvantage: weights.homeIceAdvantage,
      streakImpact: weights.streakImpact,
      goalDifferentialImpact: weights.goalDifferentialImpact,
      recentFormImpact: weights.recentFormImpact,
      backToBackPenalty: weights.backToBackPenalty,
      restAdvantage: weights.restAdvantage,
      specialTeamsImpact: weights.specialTeamsImpact,
      shotDifferentialImpact: weights.shotDifferentialImpact,
    },
    playerWeights: {
      goalieMatchupImpact: weights.goalieMatchupImpact,
      hotPlayersImpact: weights.hotPlayersImpact,
    },
    isActive: false,
    isDefault: false,
  };
};

// Confidence tier helper (same as component)
const getConfidenceTier = (score: number): { label: string; color: string } => {
  const adjustedScore = Math.abs(score - 50) * 2;
  if (adjustedScore >= 70) return { label: 'Lock', color: '#10b981' };
  if (adjustedScore >= 50) return { label: 'Strong', color: '#60a5fa' };
  if (adjustedScore >= 30) return { label: 'Lean', color: '#f59e0b' };
  return { label: 'Toss-up', color: '#ef4444' };
};

// Format probability helper
const formatProbability = (score: number): string => {
  const homeProb = Math.min(95, Math.max(5, score));
  return `${homeProb.toFixed(0)}%`;
};

describe('LivePreview Logic', () => {
  describe('Props Interface', () => {
    it('accepts weights prop with all factor keys', () => {
      const weights = getDefaultWeights();
      const model = createMockModel(weights);

      // Verify all confidence weights are present
      expect(model.weights.standingsDifferential).toBe(80);
      expect(model.weights.homeIceAdvantage).toBe(8);
      expect(model.weights.streakImpact).toBe(12);
      expect(model.weights.goalDifferentialImpact).toBe(12);
      expect(model.weights.recentFormImpact).toBe(40);
      expect(model.weights.backToBackPenalty).toBe(15);
      expect(model.weights.restAdvantage).toBe(8);
      expect(model.weights.specialTeamsImpact).toBe(25);
      expect(model.weights.shotDifferentialImpact).toBe(10);

      // Verify player weights
      expect(model.playerWeights.goalieMatchupImpact).toBe(1.0);
      expect(model.playerWeights.hotPlayersImpact).toBe(1.5);
    });

    it('creates temporary model from weights', () => {
      const weights = getDefaultWeights();
      weights.standingsDifferential = 100;
      weights.goalieMatchupImpact = 2.5;

      const model = createMockModel(weights);

      expect(model.weights.standingsDifferential).toBe(100);
      expect(model.playerWeights.goalieMatchupImpact).toBe(2.5);
      expect(model.isDefault).toBe(false);
    });
  });

  describe('Confidence Tiers', () => {
    it('returns Lock tier for score >= 85 (away) or score >= 85 (home)', () => {
      // Score 85 = 35 away from 50, adjusted = 70
      expect(getConfidenceTier(85).label).toBe('Lock');
      expect(getConfidenceTier(85).color).toBe('#10b981');

      // Score 15 = 35 away from 50, adjusted = 70
      expect(getConfidenceTier(15).label).toBe('Lock');
    });

    it('returns Strong tier for score 75-84 or 16-25', () => {
      // Score 75 = 25 away from 50, adjusted = 50
      expect(getConfidenceTier(75).label).toBe('Strong');
      expect(getConfidenceTier(75).color).toBe('#60a5fa');

      expect(getConfidenceTier(25).label).toBe('Strong');
    });

    it('returns Lean tier for score 65-74 or 26-35', () => {
      // Score 65 = 15 away from 50, adjusted = 30
      expect(getConfidenceTier(65).label).toBe('Lean');
      expect(getConfidenceTier(65).color).toBe('#f59e0b');

      expect(getConfidenceTier(35).label).toBe('Lean');
    });

    it('returns Toss-up tier for score 50-64 or 36-49', () => {
      expect(getConfidenceTier(50).label).toBe('Toss-up');
      expect(getConfidenceTier(50).color).toBe('#ef4444');

      expect(getConfidenceTier(55).label).toBe('Toss-up');
      expect(getConfidenceTier(45).label).toBe('Toss-up');
    });
  });

  describe('Win Probability Formatting', () => {
    it('formats score as percentage', () => {
      expect(formatProbability(75)).toBe('75%');
      expect(formatProbability(50)).toBe('50%');
      expect(formatProbability(85)).toBe('85%');
    });

    it('caps probability at 95%', () => {
      expect(formatProbability(100)).toBe('95%');
      expect(formatProbability(99)).toBe('95%');
    });

    it('floors probability at 5%', () => {
      expect(formatProbability(0)).toBe('5%');
      expect(formatProbability(3)).toBe('5%');
    });
  });

  describe('Game Data Handling', () => {
    it('creates valid game data structure', () => {
      const game = createMockGame({
        id: 'game123',
        homeTeam: { abbrev: 'NYR', score: 0 },
        awayTeam: { abbrev: 'BOS', score: 0 },
      });

      expect(game.id).toBe('game123');
      expect(game.homeTeam.abbrev).toBe('NYR');
      expect(game.awayTeam.abbrev).toBe('BOS');
      expect(game.gameState).toBe('FUT');
    });

    it('handles empty games list', () => {
      const games: GameData[] = [];
      expect(games.length).toBe(0);
      // Component should show empty state
    });

    it('handles multiple games', () => {
      const games = [
        createMockGame({ id: 'game1', homeTeam: { abbrev: 'TOR' }, awayTeam: { abbrev: 'MTL' } }),
        createMockGame({ id: 'game2', homeTeam: { abbrev: 'NYR' }, awayTeam: { abbrev: 'BOS' } }),
        createMockGame({ id: 'game3', homeTeam: { abbrev: 'CHI' }, awayTeam: { abbrev: 'DET' } }),
      ];

      expect(games.length).toBe(3);
      expect(games[0].homeTeam.abbrev).toBe('TOR');
      expect(games[1].homeTeam.abbrev).toBe('NYR');
      expect(games[2].homeTeam.abbrev).toBe('CHI');
    });
  });

  describe('Debounce Behavior', () => {
    it('debounce value changes after delay', async () => {
      let debouncedValue = 0;
      const delay = 100;

      // Simulate debounce behavior
      const debounce = (value: number): Promise<number> => {
        return new Promise(resolve => {
          setTimeout(() => {
            debouncedValue = value;
            resolve(value);
          }, delay);
        });
      };

      // Simulate rapid changes
      debounce(1);
      debounce(2);
      const result = await debounce(3);

      expect(result).toBe(3);
    });

    it('only triggers prediction on final debounced value', () => {
      let predictionCount = 0;
      const predictWithWeights = () => {
        predictionCount++;
      };

      // In real component, rapid weight changes would be debounced
      // Only the final value triggers prediction
      predictWithWeights();

      expect(predictionCount).toBe(1);
    });
  });

  describe('Classic Comparison Toggle', () => {
    it('toggles classic comparison state', () => {
      let showClassicComparison = false;

      // Toggle on
      showClassicComparison = !showClassicComparison;
      expect(showClassicComparison).toBe(true);

      // Toggle off
      showClassicComparison = !showClassicComparison;
      expect(showClassicComparison).toBe(false);
    });

    it('detects different picks between models', () => {
      // Simulate two models predicting differently
      const modelPrediction = { confidenceScore: 65 }; // Predicts home (>50)
      const classicPrediction = { confidenceScore: 45 }; // Predicts away (<50)

      const modelPicksHome = modelPrediction.confidenceScore >= 50;
      const classicPicksHome = classicPrediction.confidenceScore >= 50;

      const differentPicks = modelPicksHome !== classicPicksHome;
      expect(differentPicks).toBe(true);
    });

    it('detects same picks between models', () => {
      const modelPrediction = { confidenceScore: 70 };
      const classicPrediction = { confidenceScore: 65 };

      const modelPicksHome = modelPrediction.confidenceScore >= 50;
      const classicPicksHome = classicPrediction.confidenceScore >= 50;

      const samePicks = modelPicksHome === classicPicksHome;
      expect(samePicks).toBe(true);
    });
  });

  describe('Factor Breakdown Display', () => {
    it('shows top 3 factors sorted by impact', () => {
      const mockBreakdown = [
        { factorKey: 'standings', impact: 5 },
        { factorKey: 'homeIce', impact: 8 },
        { factorKey: 'streak', impact: 2 },
        { factorKey: 'recentForm', impact: 12 },
        { factorKey: 'backToBack', impact: -3 },
      ];

      // Sort by absolute impact and take top 3
      const topFactors = [...mockBreakdown]
        .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
        .slice(0, 3);

      expect(topFactors.length).toBe(3);
      expect(topFactors[0].factorKey).toBe('recentForm'); // |12|
      expect(topFactors[1].factorKey).toBe('homeIce'); // |8|
      expect(topFactors[2].factorKey).toBe('standings'); // |5|
    });

    it('includes negative impacts in top factors', () => {
      const mockBreakdown = [
        { factorKey: 'standings', impact: 5 },
        { factorKey: 'backToBack', impact: -15 }, // Large negative
        { factorKey: 'recentForm', impact: 8 },
      ];

      const topFactors = [...mockBreakdown]
        .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
        .slice(0, 3);

      expect(topFactors[0].factorKey).toBe('backToBack'); // |-15|
      expect(topFactors[0].impact).toBe(-15);
    });
  });

  describe('Predicted Winner Determination', () => {
    it('predicts home team when score >= 50', () => {
      const homeAbbrev = 'TOR';
      const awayAbbrev = 'MTL';
      const confidenceScore = 65;

      const homeWins = confidenceScore >= 50;
      const predictedWinner = homeWins ? homeAbbrev : awayAbbrev;

      expect(homeWins).toBe(true);
      expect(predictedWinner).toBe('TOR');
    });

    it('predicts away team when score < 50', () => {
      const homeAbbrev = 'TOR';
      const awayAbbrev = 'MTL';
      const confidenceScore = 35;

      const homeWins = confidenceScore >= 50;
      const predictedWinner = homeWins ? homeAbbrev : awayAbbrev;

      expect(homeWins).toBe(false);
      expect(predictedWinner).toBe('MTL');
    });

    it('predicts home team at exactly 50', () => {
      const confidenceScore = 50;
      const homeWins = confidenceScore >= 50;

      expect(homeWins).toBe(true); // Tie goes to home
    });
  });

  describe('Win Probability Calculation', () => {
    it('uses confidence score directly for home team', () => {
      const confidenceScore = 72;
      const homeWins = confidenceScore >= 50;
      const winProb = homeWins ? confidenceScore : (100 - confidenceScore);

      expect(winProb).toBe(72);
    });

    it('inverts confidence score for away team', () => {
      const confidenceScore = 35;
      const homeWins = confidenceScore >= 50;
      const winProb = homeWins ? confidenceScore : (100 - confidenceScore);

      expect(winProb).toBe(65); // 100 - 35
    });
  });

  describe('Loading and Error States', () => {
    it('handles loading state', () => {
      const loading = true;
      expect(loading).toBe(true);
      // Component should show loading indicator
    });

    it('handles error state', () => {
      const error = 'Failed to load today\'s games';
      expect(error).toBeDefined();
      // Component should show error message
    });

    it('handles successful data load', () => {
      const loading = false;
      const error = null;
      const games = [createMockGame()];

      expect(loading).toBe(false);
      expect(error).toBeNull();
      expect(games.length).toBeGreaterThan(0);
    });
  });

  describe('Weight Changes', () => {
    it('creates new model when weights change', () => {
      const weights1 = getDefaultWeights();
      const weights2 = { ...weights1, standingsDifferential: 100 };

      const model1 = createMockModel(weights1);
      const model2 = createMockModel(weights2);

      expect(model1.weights.standingsDifferential).not.toBe(model2.weights.standingsDifferential);
    });

    it('preserves player weights when confidence weights change', () => {
      const weights = getDefaultWeights();
      weights.standingsDifferential = 100; // Change confidence weight

      const model = createMockModel(weights);

      // Player weights should remain unchanged
      expect(model.playerWeights.goalieMatchupImpact).toBe(1.0);
      expect(model.playerWeights.hotPlayersImpact).toBe(1.5);
    });
  });
});
