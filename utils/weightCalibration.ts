/**
 * Weight calibration using historical prediction accuracy
 * Analyzes past predictions to suggest better confidence weights
 */

import type { Pick } from '../services/pickTracking';
import type { AccuracyByRange, WeightAnalysis, ConfidenceWeights } from '../types/predictions';
import { CONFIDENCE_WEIGHTS } from './predictionUtils';

/**
 * Analyze accuracy by confidence score ranges
 */
export function analyzeAccuracyByRange(picks: Pick[]): AccuracyByRange[] {
  const ranges = [
    { range: '50-59', min: 50, max: 59 },
    { range: '60-69', min: 60, max: 69 },
    { range: '70-79', min: 70, max: 79 },
    { range: '80-100', min: 80, max: 100 },
  ];

  return ranges.map(({ range, min, max }) => {
    // Filter picks in this range with completed outcomes
    const picksInRange = picks.filter(
      p =>
        p.confidenceScore !== undefined &&
        p.confidenceScore >= min &&
        p.confidenceScore <= max &&
        p.outcome &&
        p.outcome !== 'push' // Exclude pushes
    );

    const correct = picksInRange.filter(p => p.outcome === 'win').length;
    const total = picksInRange.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    return {
      range,
      predictions: total,
      correct,
      accuracy,
    };
  });
}

/**
 * Suggest weight adjustments based on accuracy analysis
 */
export function suggestWeightAdjustments(
  currentWeights: ConfidenceWeights,
  accuracyAnalysis: AccuracyByRange[]
): WeightAnalysis {
  const improvements: string[] = [];
  const suggestedWeights: ConfidenceWeights = { ...currentWeights };

  // Check if we have enough data
  const totalPredictions = accuracyAnalysis.reduce((sum, r) => sum + r.predictions, 0);

  if (totalPredictions < 20) {
    improvements.push(
      `Insufficient data for calibration (${totalPredictions} predictions). Need at least 20 completed picks.`
    );
    return {
      currentWeights,
      accuracyByRange: accuracyAnalysis,
      suggestedWeights: currentWeights,
      improvements,
    };
  }

  // Analyze if confidence scores correlate with actual accuracy
  const highConfRange = accuracyAnalysis.find(r => r.range === '80-100');
  const medHighRange = accuracyAnalysis.find(r => r.range === '70-79');
  const medRange = accuracyAnalysis.find(r => r.range === '60-69');
  const lowRange = accuracyAnalysis.find(r => r.range === '50-59');

  // Expected accuracies for well-calibrated system
  const expectedAccuracies = {
    '80-100': 85,
    '70-79': 75,
    '60-69': 65,
    '50-59': 55,
  };

  // Check high confidence range
  if (highConfRange && highConfRange.predictions >= 5) {
    if (highConfRange.accuracy >= expectedAccuracies['80-100']) {
      improvements.push(
        `✅ High confidence predictions (80-100) are ${highConfRange.accuracy}% accurate. System is well-calibrated at high confidence levels.`
      );
    } else if (highConfRange.accuracy < 70) {
      improvements.push(
        `⚠️ High confidence predictions (80-100) are only ${highConfRange.accuracy}% accurate. Consider reducing overall weight multipliers by 10-15% to lower confidence scores.`
      );

      // Suggest reducing weights
      suggestedWeights.standingsDifferential = Math.round(currentWeights.standingsDifferential * 0.85);
      suggestedWeights.recentFormImpact = Math.round(currentWeights.recentFormImpact * 0.85);
      suggestedWeights.goalDifferentialImpact = Math.round(currentWeights.goalDifferentialImpact * 0.85);
    }
  }

  // Check medium confidence range
  if (medRange && medRange.predictions >= 5) {
    if (medRange.accuracy >= expectedAccuracies['60-69']) {
      improvements.push(
        `✅ Medium confidence predictions (60-69) are ${medRange.accuracy}% accurate. Good calibration.`
      );
    }
  }

  // Check if system is too conservative (high accuracy at all levels)
  const avgAccuracy =
    accuracyAnalysis.reduce((sum, r) => {
      if (r.predictions > 0) {
        return sum + r.accuracy * r.predictions;
      }
      return sum;
    }, 0) / totalPredictions;

  if (avgAccuracy > 70) {
    improvements.push(
      `📈 Overall accuracy is ${Math.round(avgAccuracy)}%. System is performing well. Consider increasing weight multipliers by 5-10% to generate higher confidence scores for strong predictions.`
    );

    // Suggest increasing weights slightly
    suggestedWeights.standingsDifferential = Math.round(currentWeights.standingsDifferential * 1.05);
    suggestedWeights.recentFormImpact = Math.round(currentWeights.recentFormImpact * 1.05);
  } else if (avgAccuracy < 55) {
    improvements.push(
      `⚠️ Overall accuracy is ${Math.round(avgAccuracy)}%. Predictions are barely better than coin flips. Consider reviewing factor calculations or reducing weight multipliers significantly.`
    );

    // Suggest significant reduction
    suggestedWeights.standingsDifferential = Math.round(currentWeights.standingsDifferential * 0.7);
    suggestedWeights.recentFormImpact = Math.round(currentWeights.recentFormImpact * 0.7);
  } else {
    improvements.push(
      `📊 Overall accuracy is ${Math.round(avgAccuracy)}%. System confidence scores correlate well with actual outcomes.`
    );
  }

  return {
    currentWeights,
    accuracyByRange: accuracyAnalysis,
    suggestedWeights,
    improvements,
  };
}

/**
 * Main function to analyze historical accuracy and suggest calibrations
 */
export async function analyzeHistoricalAccuracy(picks: Pick[]): Promise<WeightAnalysis> {
  const accuracyByRange = analyzeAccuracyByRange(picks);
  return suggestWeightAdjustments(CONFIDENCE_WEIGHTS, accuracyByRange);
}
