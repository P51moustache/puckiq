/**
 * Helper function to calculate predicted winner based on standings
 * Uses team point percentage with home ice advantage factor
 *
 * NOTE: This is now a re-export from predictionUtils for backward compatibility
 * New code should import from predictionUtils directly
 */
export { getPredictedWinner } from './predictionUtils';

// Re-export other useful utilities
export {
  calculateConfidenceScore,
  calculateWinProbability,
  getLockOfTheDay,
  getSmartPicks,
  createStandingsMap,
  CONFIDENCE_WEIGHTS,
  HOME_ICE_ADVANTAGE,
} from './predictionUtils';
