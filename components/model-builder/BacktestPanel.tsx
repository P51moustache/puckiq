/**
 * BacktestPanel Component
 * Allows users to run backtests on prediction models
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PredictionModel, ModelBacktestResults } from '../../types/predictions';
import {
  runBacktest,
  getReplayWeightsKey,
  type BacktestResults,
  type BacktestProgressCallback,
} from '../../services/backtesting';
import { checkReplayAvailability, type ReplayDateRange } from '../../services/replayAvailability';
import { createReplayRunGuard } from './replayRunGuard';
import { useArena } from '../arena/ArenaProvider';
import type { ArenaPalette } from '../../constants/arenaTheme';
import { getCurrentSeason, formatSeasonLabel } from '../../utils/season';

/**
 * Date range options for backtesting
 */
type DateRangeOption = 'last30' | 'last90' | 'season';

interface DateRange {
  start: string;
  end: string;
  label: string;
}

interface BacktestPanelProps {
  model: PredictionModel;
  onSaveResults?: (results: ModelBacktestResults) => void;
  onSeedPrompt?: (range: ReplayDateRange) => void;
}

/**
 * Get date range based on selected option
 */
function getDateRange(option: DateRangeOption): DateRange {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  switch (option) {
    case 'last30': {
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      return {
        start: formatDate(start),
        end: formatDate(today),
        label: 'Last 30 Days',
      };
    }
    case 'last90': {
      const start = new Date(today);
      start.setDate(start.getDate() - 90);
      return {
        start: formatDate(start),
        end: formatDate(today),
        label: 'Last 3 Months',
      };
    }
    case 'season': {
      const seasonId = String(getCurrentSeason());
      const startYear = parseInt(seasonId.substring(0, 4), 10);
      return {
        start: `${startYear}-10-01`,
        end: formatDate(today),
        label: `${formatSeasonLabel(Number(seasonId))} season`,
      };
    }
  }
}

export default function BacktestPanel({
  model,
  onSaveResults,
  onSeedPrompt,
}: BacktestPanelProps) {
  const { palette: p } = useArena();
  const styles = React.useMemo(() => createStyles(p), [p]);
  // State
  const [isSeeded, setIsSeeded] = useState<boolean | null>(null);
  const [selectedRange, setSelectedRange] = useState<DateRangeOption>('last30');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{
    currentGame: number;
    totalGames: number;
    percentComplete: number;
  } | null>(null);
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultsSaved, setResultsSaved] = useState(false);

  // Track if weights have changed since last backtest to show "outdated" indicator
  const [lastTestedWeightsHash, setLastTestedWeightsHash] = useState<string | null>(null);
  const availabilityRequestRef = useRef(0);
  const replayRunGuardRef = useRef(createReplayRunGuard());

  const checkSeeding = useCallback(async () => {
    const requestId = ++availabilityRequestRef.current;
    try {
      setIsSeeded(null);
      const range = getDateRange(selectedRange);
      const availability = await checkReplayAvailability({ start: range.start, end: range.end });
      if (requestId === availabilityRequestRef.current) setIsSeeded(availability.available);
    } catch (err) {
      console.error('[BacktestPanel] Error checking seeding:', err);
      if (requestId === availabilityRequestRef.current) setIsSeeded(false);
    }
  }, [selectedRange]);

  // Check if data is seeded on mount
  useEffect(() => {
    checkSeeding();
    return () => { availabilityRequestRef.current += 1; };
  }, [checkSeeding]);

  // Clear results when model weights change (so user knows to re-run backtest)
  useEffect(() => {
    // Create a simple hash of weights to detect changes
    const weightsString = getReplayWeightsKey(model.weights);
    const currentHash = weightsString;

    if (lastTestedWeightsHash !== null && lastTestedWeightsHash !== currentHash) {
      // Weights changed since last test - clear old results
      setResults(null);
      setResultsSaved(false);
      console.log('[BacktestPanel] Weights changed - cleared old results');
    }
  }, [model.weights, model.playerWeights, lastTestedWeightsHash]);

  const replayKey = `${getReplayWeightsKey(model.weights)}|${selectedRange}`;
  useEffect(() => {
    replayRunGuardRef.current.invalidate();
    setIsRunning(false);
    setProgress(null);
    const guard = replayRunGuardRef.current;
    return () => guard.invalidate();
  }, [replayKey]);



  // Handle running backtest
  const handleRunBacktest = useCallback(async () => {
    const launchKey = `${getReplayWeightsKey(model.weights)}|${selectedRange}`;
    const token = replayRunGuardRef.current.begin(launchKey);
    if (!token) return;
    setIsRunning(true);
    setError(null);
    setResults(null);
    setProgress(null);
    setResultsSaved(false);

    const dateRange = getDateRange(selectedRange);

    try {
      const progressCallback: BacktestProgressCallback = (prog) => {
        if (!replayRunGuardRef.current.isCurrent(token, launchKey)) return;
        setProgress({
          currentGame: prog.currentGame,
          totalGames: prog.totalGames,
          percentComplete: prog.percentComplete,
        });
      };

      // Always skip cache during editing so weight changes produce fresh results
      const backtestResults = await runBacktest(
        model,
        { start: dateRange.start, end: dateRange.end },
        progressCallback,
        true // skipCache - always run fresh during model editing
      );

      if (!replayRunGuardRef.current.isCurrent(token, launchKey)) return;
      setResults(backtestResults);

      // Save the weights hash so we can detect if weights change later
      const weightsString = getReplayWeightsKey(model.weights);
      setLastTestedWeightsHash(weightsString);

      // Auto-save results when backtest completes (better UX than requiring manual save)
      if (onSaveResults && backtestResults.totalGames > 0) {
        const modelBacktestResults: ModelBacktestResults = {
          replayVersion: backtestResults.replayVersion,
          period: {
            start: backtestResults.dateRange.start,
            end: backtestResults.dateRange.end,
          },
          totalGames: backtestResults.totalGames,
          correctPicks: backtestResults.correctPicks,
          accuracy: backtestResults.accuracy,
          baselineAccuracy: backtestResults.baselineAccuracy,
          ranAt: backtestResults.ranAt,
        };
        onSaveResults(modelBacktestResults);
        setResultsSaved(true);
      }
    } catch (err) {
      if (!replayRunGuardRef.current.isCurrent(token, launchKey)) return;
      console.error('[BacktestPanel] Backtest error:', err);
      setError(err instanceof Error ? err.message : 'Failed to run backtest');
    } finally {
      if (replayRunGuardRef.current.isCurrent(token, launchKey)) {
        replayRunGuardRef.current.finish(token);
        setIsRunning(false);
        setProgress(null);
      }
    }
  }, [model, selectedRange, onSaveResults]);


  // Handle seed prompt
  const handleSeedPrompt = useCallback(() => {
    const range = getDateRange(selectedRange);
    onSeedPrompt?.({ start: range.start, end: range.end });
  }, [onSeedPrompt, selectedRange]);

  // Render date range selector
  const renderDateRangeSelector = () => (
    <View style={styles.rangeSelector}>
      <TouchableOpacity
        style={[
          styles.rangeOption,
          selectedRange === 'last30' && styles.rangeOptionSelected,
        ]}
        onPress={() => setSelectedRange('last30')}
        disabled={isRunning}
        accessibilityRole="button"
        accessibilityLabel="Replay last 30 days"
        accessibilityState={{ selected: selectedRange === 'last30', disabled: isRunning }}
      >
        <Text
          style={[
            styles.rangeOptionText,
            selectedRange === 'last30' && styles.rangeOptionTextSelected,
          ]}
        >
          30 Days
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.rangeOption,
          selectedRange === 'last90' && styles.rangeOptionSelected,
        ]}
        onPress={() => setSelectedRange('last90')}
        disabled={isRunning}
        accessibilityRole="button"
        accessibilityLabel="Replay last 3 months"
        accessibilityState={{ selected: selectedRange === 'last90', disabled: isRunning }}
      >
        <Text
          style={[
            styles.rangeOptionText,
            selectedRange === 'last90' && styles.rangeOptionTextSelected,
          ]}
        >
          3 Months
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.rangeOption,
          selectedRange === 'season' && styles.rangeOptionSelected,
        ]}
        onPress={() => setSelectedRange('season')}
        disabled={isRunning}
        accessibilityRole="button"
        accessibilityLabel="Replay current season"
        accessibilityState={{ selected: selectedRange === 'season', disabled: isRunning }}
      >
        <Text
          style={[
            styles.rangeOptionText,
            selectedRange === 'season' && styles.rangeOptionTextSelected,
          ]}
        >
          Season
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Render results
  const renderResults = () => {
    if (results?.totalGames === 0) return <Text style={styles.headerSubtitle}>No completed games have usable pregame standings in this period. Try another date range.</Text>;
    if (!results) return null;

    const improvement = results.improvement;
    const improvementColor = improvement > 0 ? '#10b981' : improvement < 0 ? '#ef4444' : p.muted;
    const improvementPrefix = improvement > 0 ? '+' : '';

    return (
      <View style={styles.resultsContainer}>
        {/* Games Tested */}
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Games Tested</Text>
          <Text style={styles.resultValue}>{results.totalGames.toLocaleString()}</Text>
        </View>

        {/* Model Accuracy */}
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Your four-factor weights</Text>
          <Text style={[styles.resultValue, styles.resultValueHighlight]}>
            {results.accuracy}%
          </Text>
        </View>

        {/* Classic Accuracy */}
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Classic four-factor weights</Text>
          <Text style={styles.resultValue}>{results.baselineAccuracy}%</Text>
        </View>

        {/* Improvement */}
        <View style={[styles.resultRow, styles.resultRowLast]}>
          <Text style={styles.resultLabel}>Difference</Text>
          <View style={styles.improvementContainer}>
            <Text style={[styles.resultValue, { color: improvementColor }]}>
              {improvementPrefix}{improvement} pp
            </Text>
            {improvement !== 0 && (
              <Ionicons
                name={improvement > 0 ? 'arrow-up' : 'arrow-down'}
                size={16}
                color={improvementColor}
                style={styles.improvementIcon}
              />
            )}
          </View>
        </View>

        {/* Duration */}
        <Text style={styles.durationText}>
          Completed in {(results.durationMs / 1000).toFixed(1)}s
        </Text>

        {/* Auto-saved indicator */}
        {resultsSaved && (
          <View style={styles.autoSavedIndicator}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={styles.autoSavedText}>
              Results ready - tap Save above to keep them
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Render not seeded state
  if (isSeeded === false) {
    return (
      <View style={styles.container}>
        <View style={styles.notSeededContainer}>
          <Ionicons name="warning-outline" size={32} color="#f59e0b" />
          <Text style={styles.notSeededTitle}>Replay data unavailable</Text>
          <Text style={styles.notSeededText}>
            No completed regular-season games are available for this selected period.
          </Text>
          {onSeedPrompt && (
            <TouchableOpacity
              style={styles.seedButton}
              onPress={handleSeedPrompt}
              accessibilityRole="button"
              accessibilityLabel="Check replay data availability"
            >
              <Ionicons name="refresh-outline" size={18} color={p.actionInk} />
              <Text style={styles.seedButtonText}>Check availability</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Render loading state for seeding check
  if (isSeeded === null) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={p.action} />
          <Text style={styles.loadingText}>Checking data availability...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="analytics-outline" size={20} color={p.action} />
          <Text style={styles.headerTitle}>Four-factor replay</Text>
        </View>
        <Text style={styles.headerSubtitle}>Historical pick accuracy · limited replay</Text>
      </View>

      <Text style={styles.headerSubtitle}>
        This historical subset includes standings, home ice, streak, and goal differential. Recent form, rest,
        back-to-back, special teams, shots, goalie and hot-player sliders do not affect
        this replay. It does not validate the complete model or its probabilities.
      </Text>

      {/* Date Range Selector */}
      <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>Date Range</Text>
        {renderDateRangeSelector()}
      </View>

      {/* Run Button or Progress */}
      {isRunning ? (
        <View style={styles.progressContainer}>
          <ActivityIndicator size="small" color={p.action} />
          <Text style={styles.progressText}>
            {progress
              ? `Testing game ${progress.currentGame} of ${progress.totalGames} (${progress.percentComplete}%)`
              : 'Starting backtest...'}
          </Text>
          {progress && (
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress.percentComplete}%` },
                ]}
              />
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.runButton}
          onPress={handleRunBacktest}
          accessibilityRole="button"
          accessibilityLabel="Run four-factor replay"
        >
          <Ionicons name="play-circle-outline" size={20} color={p.actionInk} />
          <Text style={styles.runButtonText}>Run replay</Text>
        </TouchableOpacity>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={18} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Results */}
      {results && renderResults()}
    </View>
  );
}

const createStyles = (p: ArenaPalette) => StyleSheet.create({
  container: {
    backgroundColor: p.paper,
    borderRadius: 14,
    overflow: 'hidden',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: p.edge,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: p.ink,
  },
  headerSubtitle: {
    fontSize: 13,
    color: p.muted,
  },
  selectorContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: p.edge,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: p.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  rangeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  rangeOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: p.soft,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  rangeOptionSelected: {
    backgroundColor: p.action,
  },
  rangeOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: p.muted,
  },
  rangeOptionTextSelected: {
    color: p.actionInk,
  },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: p.action,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 10,
    minHeight: 48,
  },
  runButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: p.actionInk,
  },
  progressContainer: {
    padding: 16,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 13,
    color: p.muted,
    marginTop: 10,
    marginBottom: 12,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: p.soft,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: p.action,
    borderRadius: 3,
  },
  resultsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: p.edge,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: p.edge,
  },
  resultRowLast: {
    borderBottomWidth: 0,
  },
  resultLabel: {
    fontSize: 14,
    color: p.muted,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '700',
    color: p.ink,
  },
  resultValueHighlight: {
    color: p.link,
    fontSize: 18,
  },
  improvementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  improvementIcon: {
    marginLeft: 4,
  },
  durationText: {
    fontSize: 11,
    color: p.muted,
    textAlign: 'center',
    marginTop: 12,
  },
  autoSavedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b98115',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  autoSavedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    flex: 1,
  },
  notSeededContainer: {
    padding: 24,
    alignItems: 'center',
  },
  notSeededTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: p.ink,
    marginTop: 12,
    marginBottom: 6,
  },
  notSeededText: {
    fontSize: 13,
    color: p.muted,
    textAlign: 'center',
    marginBottom: 16,
  },
  seedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: p.action,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  seedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: p.actionInk,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: p.muted,
    marginTop: 10,
  },
});
