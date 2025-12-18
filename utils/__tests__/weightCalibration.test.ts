/**
 * Tests for weight calibration using historical accuracy
 */

import {
  analyzeAccuracyByRange,
  suggestWeightAdjustments,
  analyzeHistoricalAccuracy,
} from '../weightCalibration';
import type { Pick } from '../../services/pickTracking';
import type { AccuracyByRange, WeightAnalysis, ConfidenceWeights } from '../../types/predictions';

describe('weightCalibration', () => {
  const mockPicks: Pick[] = [
    // High confidence (80+) - should be very accurate
    {
      gameId: '1',
      date: '2024-11-01',
      type: 'lock',
      predictedWinner: 'TOR',
      homeTeam: 'TOR',
      awayTeam: 'MTL',
      confidenceScore: 85,
      outcome: 'win',
      actualWinner: 'TOR',
    },
    {
      gameId: '2',
      date: '2024-11-02',
      type: 'smart-pick',
      predictedWinner: 'BOS',
      homeTeam: 'BOS',
      awayTeam: 'NYR',
      confidenceScore: 82,
      outcome: 'win',
      actualWinner: 'BOS',
    },
    // Medium-high confidence (70-79) - should be fairly accurate
    {
      gameId: '3',
      date: '2024-11-03',
      type: 'smart-pick',
      predictedWinner: 'TOR',
      homeTeam: 'OTT',
      awayTeam: 'TOR',
      confidenceScore: 75,
      outcome: 'loss',
      actualWinner: 'OTT',
    },
    {
      gameId: '4',
      date: '2024-11-04',
      type: 'smart-pick',
      predictedWinner: 'EDM',
      homeTeam: 'EDM',
      awayTeam: 'CGY',
      confidenceScore: 72,
      outcome: 'win',
      actualWinner: 'EDM',
    },
    // Medium confidence (60-69) - moderate accuracy
    {
      gameId: '5',
      date: '2024-11-05',
      type: 'smart-pick',
      predictedWinner: 'VAN',
      homeTeam: 'VAN',
      awayTeam: 'SEA',
      confidenceScore: 65,
      outcome: 'win',
      actualWinner: 'VAN',
    },
    {
      gameId: '6',
      date: '2024-11-06',
      type: 'smart-pick',
      predictedWinner: 'WSH',
      homeTeam: 'WSH',
      awayTeam: 'PIT',
      confidenceScore: 62,
      outcome: 'loss',
      actualWinner: 'PIT',
    },
    // Low confidence (50-59) - coin flip
    {
      gameId: '7',
      date: '2024-11-07',
      type: 'smart-pick',
      predictedWinner: 'CHI',
      homeTeam: 'CHI',
      awayTeam: 'DET',
      confidenceScore: 55,
      outcome: 'loss',
      actualWinner: 'DET',
    },
    {
      gameId: '8',
      date: '2024-11-08',
      type: 'smart-pick',
      predictedWinner: 'ARI',
      homeTeam: 'ARI',
      awayTeam: 'SJS',
      confidenceScore: 52,
      outcome: 'win',
      actualWinner: 'ARI',
    },
  ];

  describe('analyzeAccuracyByRange', () => {
    it('should categorize predictions by confidence ranges', () => {
      const analysis = analyzeAccuracyByRange(mockPicks);

      expect(analysis).toHaveLength(4);

      // Check 80-100 range
      const highRange = analysis.find(r => r.range === '80-100');
      expect(highRange).toBeDefined();
      expect(highRange!.predictions).toBe(2);
      expect(highRange!.correct).toBe(2);
      expect(highRange!.accuracy).toBe(100);

      // Check 70-79 range
      const medHighRange = analysis.find(r => r.range === '70-79');
      expect(medHighRange).toBeDefined();
      expect(medHighRange!.predictions).toBe(2);
      expect(medHighRange!.correct).toBe(1);
      expect(medHighRange!.accuracy).toBe(50);

      // Check 60-69 range
      const medRange = analysis.find(r => r.range === '60-69');
      expect(medRange).toBeDefined();
      expect(medRange!.predictions).toBe(2);
      expect(medRange!.correct).toBe(1);
      expect(medRange!.accuracy).toBe(50);

      // Check 50-59 range
      const lowRange = analysis.find(r => r.range === '50-59');
      expect(lowRange).toBeDefined();
      expect(lowRange!.predictions).toBe(2);
      expect(lowRange!.correct).toBe(1);
      expect(lowRange!.accuracy).toBe(50);
    });

    it('should handle empty picks array', () => {
      const analysis = analyzeAccuracyByRange([]);

      expect(analysis).toHaveLength(4);
      analysis.forEach(range => {
        expect(range.predictions).toBe(0);
        expect(range.correct).toBe(0);
        expect(range.accuracy).toBe(0);
      });
    });

    it('should ignore picks without outcomes', () => {
      const picksWithoutOutcomes: Pick[] = [
        {
          gameId: '1',
          date: '2024-11-01',
          type: 'lock',
          predictedWinner: 'TOR',
          homeTeam: 'TOR',
          awayTeam: 'MTL',
          confidenceScore: 85,
        },
      ];

      const analysis = analyzeAccuracyByRange(picksWithoutOutcomes);

      analysis.forEach(range => {
        expect(range.predictions).toBe(0);
      });
    });

    it('should exclude pushes from accuracy calculation', () => {
      const picksWithPush: Pick[] = [
        {
          gameId: '1',
          date: '2024-11-01',
          type: 'lock',
          predictedWinner: 'TOR',
          homeTeam: 'TOR',
          awayTeam: 'MTL',
          confidenceScore: 85,
          outcome: 'win',
          actualWinner: 'TOR',
        },
        {
          gameId: '2',
          date: '2024-11-02',
          type: 'smart-pick',
          predictedWinner: 'BOS',
          homeTeam: 'BOS',
          awayTeam: 'NYR',
          confidenceScore: 82,
          outcome: 'push',
          actualWinner: 'tie',
        },
      ];

      const analysis = analyzeAccuracyByRange(picksWithPush);

      const highRange = analysis.find(r => r.range === '80-100');
      expect(highRange!.predictions).toBe(1); // Push excluded
      expect(highRange!.correct).toBe(1);
      expect(highRange!.accuracy).toBe(100);
    });
  });

  describe('suggestWeightAdjustments', () => {
    const currentWeights: ConfidenceWeights = {
      standingsDifferential: 80,
      homeIceAdvantage: 8,
      streakImpact: 12,
      goalDifferentialImpact: 12,
      recentFormImpact: 40,
      backToBackPenalty: 15,
      restAdvantage: 8,
      specialTeamsImpact: 25,
      shotDifferentialImpact: 10,
    };

    it('should suggest increasing weights when overall accuracy is high', () => {
      const accuracyAnalysis: AccuracyByRange[] = [
        { range: '50-59', predictions: 10, correct: 5, accuracy: 50 },
        { range: '60-69', predictions: 10, correct: 7, accuracy: 70 },
        { range: '70-79', predictions: 10, correct: 8, accuracy: 80 },
        { range: '80-100', predictions: 10, correct: 9, accuracy: 90 },
      ];

      const suggestions = suggestWeightAdjustments(currentWeights, accuracyAnalysis);

      const hasCorrelationMessage = suggestions.improvements.some(msg =>
        /confidence.*correlates well|well-calibrated|performing well/i.test(msg)
      );
      expect(hasCorrelationMessage).toBe(true);
    });

    it('should suggest decreasing weights when confidence scores are miscalibrated', () => {
      // High confidence range is not accurate
      const accuracyAnalysis: AccuracyByRange[] = [
        { range: '50-59', predictions: 10, correct: 5, accuracy: 50 },
        { range: '60-69', predictions: 10, correct: 5, accuracy: 50 },
        { range: '70-79', predictions: 10, correct: 5, accuracy: 50 },
        { range: '80-100', predictions: 10, correct: 5, accuracy: 50 },
      ];

      const suggestions = suggestWeightAdjustments(currentWeights, accuracyAnalysis);

      expect(suggestions.improvements.length).toBeGreaterThan(0);
      const hasReductionMessage = suggestions.improvements.some(msg =>
        /reduce|lower|decrease/i.test(msg)
      );
      expect(hasReductionMessage).toBe(true);
    });

    it('should return current weights if data is insufficient', () => {
      const accuracyAnalysis: AccuracyByRange[] = [
        { range: '50-59', predictions: 1, correct: 0, accuracy: 0 },
        { range: '60-69', predictions: 0, correct: 0, accuracy: 0 },
        { range: '70-79', predictions: 0, correct: 0, accuracy: 0 },
        { range: '80-100', predictions: 0, correct: 0, accuracy: 0 },
      ];

      const suggestions = suggestWeightAdjustments(currentWeights, accuracyAnalysis);

      expect(suggestions.suggestedWeights).toEqual(currentWeights);
      const hasInsufficientDataMessage = suggestions.improvements.some(msg =>
        /insufficient data/i.test(msg)
      );
      expect(hasInsufficientDataMessage).toBe(true);
    });
  });

  describe('analyzeHistoricalAccuracy', () => {
    it('should return complete weight analysis', async () => {
      const analysis = await analyzeHistoricalAccuracy(mockPicks);

      expect(analysis).toHaveProperty('currentWeights');
      expect(analysis).toHaveProperty('accuracyByRange');
      expect(analysis).toHaveProperty('suggestedWeights');
      expect(analysis).toHaveProperty('improvements');

      expect(analysis.accuracyByRange).toHaveLength(4);
      expect(Array.isArray(analysis.improvements)).toBe(true);
    });

    it('should handle empty picks gracefully', async () => {
      const analysis = await analyzeHistoricalAccuracy([]);

      const hasInsufficientDataMessage = analysis.improvements.some(msg =>
        /insufficient data/i.test(msg)
      );
      expect(hasInsufficientDataMessage).toBe(true);
    });
  });
});
