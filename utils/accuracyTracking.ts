/**
 * Track prediction accuracy over time
 * Monitors daily accuracy and calculates trends
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DailyAccuracy, AccuracyTrend } from '../types/predictions';

const STORAGE_KEY = 'puckiq_prediction_accuracy_history';

/**
 * Save daily accuracy stats to history
 */
export async function saveDailyAccuracy(accuracy: DailyAccuracy): Promise<void> {
  try {
    const history = await getAccuracyHistory();
    history[accuracy.date] = accuracy;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('[Accuracy Tracking] Error saving daily accuracy:', error);
    throw error;
  }
}

/**
 * Get all accuracy history from storage
 */
export async function getAccuracyHistory(): Promise<Record<string, DailyAccuracy>> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : {};
  } catch (error) {
    console.error('[Accuracy Tracking] Error loading accuracy history:', error);
    return {};
  }
}

/**
 * Calculate trend direction based on current vs historical averages
 */
export function calculateTrendDirection(
  current: number,
  last7Days: number,
  last30Days: number
): 'improving' | 'declining' | 'stable' {
  const threshold = 5; // 5% threshold for stability

  // Compare current to 7-day average
  const diff7 = current - last7Days;

  // If within threshold, consider stable
  if (Math.abs(diff7) <= threshold) {
    return 'stable';
  }

  // Improving if current is better than recent average
  if (diff7 > 0) {
    return 'improving';
  }

  return 'declining';
}

/**
 * Get accuracy trends over specified days
 */
export async function getAccuracyTrends(days: number): Promise<AccuracyTrend> {
  const history = await getAccuracyHistory();
  const dates = Object.keys(history).sort().reverse(); // Most recent first

  // Limit to requested days
  const recentDates = dates.slice(0, days);

  if (recentDates.length === 0) {
    return {
      currentAccuracy: 0,
      last7DaysAvg: 0,
      last30DaysAvg: 0,
      trend: 'stable',
      history: [],
    };
  }

  // Get history array
  const historyArray = recentDates.map(date => history[date]);

  // Calculate current accuracy (most recent day)
  const currentAccuracy = historyArray[0].overallAccuracy;

  // Calculate 7-day average
  const last7Days = recentDates.slice(0, 7);
  const last7DaysAvg = last7Days.length > 0
    ? Math.round(
        last7Days.reduce((sum, date) => sum + history[date].overallAccuracy, 0) / last7Days.length
      )
    : 0;

  // Calculate 30-day average
  const last30Days = recentDates.slice(0, 30);
  const last30DaysAvg = last30Days.length > 0
    ? Math.round(
        last30Days.reduce((sum, date) => sum + history[date].overallAccuracy, 0) / last30Days.length
      )
    : 0;

  // Determine trend
  const trend = calculateTrendDirection(currentAccuracy, last7DaysAvg, last30DaysAvg);

  return {
    currentAccuracy,
    last7DaysAvg,
    last30DaysAvg,
    trend,
    history: historyArray,
  };
}

/**
 * Create daily accuracy record from pick results
 */
export function createDailyAccuracyRecord(
  date: string,
  lockCorrect: boolean | null,
  smartPicksCorrect: number,
  smartPicksTotal: number
): DailyAccuracy {
  // Calculate overall accuracy
  let totalCorrect = smartPicksCorrect;
  let totalPicks = smartPicksTotal;

  if (lockCorrect !== null) {
    totalCorrect += lockCorrect ? 1 : 0;
    totalPicks += 1;
  }

  const overallAccuracy = totalPicks > 0
    ? Math.round((totalCorrect / totalPicks) * 100)
    : 0;

  return {
    date,
    lockCorrect,
    smartPicksCorrect,
    smartPicksTotal,
    overallAccuracy,
  };
}
