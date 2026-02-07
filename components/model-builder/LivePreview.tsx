/**
 * LivePreview Component
 * Shows live predictions for today's games as weights are edited
 * Includes comparison with Classic model
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import type {
  ConfidenceWeights,
  PlayerWeights,
  PredictionModel,
  GameData,
  StandingsData,
} from '../../types/predictions';
import {
  predictWithModelAndBreakdown,
  getTopFactors,
  createClassicModel,
  type PredictionWithBreakdown,
} from '../../services/modelPrediction';

// Combined weights type
type AllWeights = ConfidenceWeights & PlayerWeights;

interface LivePreviewProps {
  weights: AllWeights;
}

// Confidence tier thresholds
const getConfidenceTier = (score: number): { label: string; color: string } => {
  const adjustedScore = Math.abs(score - 50) * 2; // Convert 50-100 to 0-100 scale
  if (adjustedScore >= 70) return { label: 'Lock', color: '#10b981' };
  if (adjustedScore >= 50) return { label: 'Strong', color: '#60a5fa' };
  if (adjustedScore >= 30) return { label: 'Lean', color: '#f59e0b' };
  return { label: 'Toss-up', color: '#ef4444' };
};

// Format win probability
const formatProbability = (score: number): string => {
  // Score represents home team confidence
  // Convert to win probability (50 = 50/50, higher = more likely home wins)
  const homeProb = Math.min(95, Math.max(5, score));
  return `${homeProb.toFixed(0)}%`;
};

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function LivePreview({ weights }: LivePreviewProps) {
  const [games, setGames] = useState<GameData[]>([]);
  const [standings, setStandings] = useState<StandingsData | null>(null);
  const [predictions, setPredictions] = useState<PredictionWithBreakdown[]>([]);
  const [classicPredictions, setClassicPredictions] = useState<PredictionWithBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClassicComparison, setShowClassicComparison] = useState(false);

  // Track if initial data has been loaded
  const dataLoadedRef = useRef(false);
  // Track if classic predictions have been loaded
  const classicLoadedRef = useRef(false);

  // Debounce weights changes (500ms delay)
  const debouncedWeights = useDebounce(weights, 500);

  // Create temporary model from current weights
  const tempModel = useMemo((): PredictionModel => {
    const now = new Date().toISOString();
    return {
      id: 'temp_preview',
      name: 'Preview Model',
      createdAt: now,
      updatedAt: now,
      weights: {
        standingsDifferential: debouncedWeights.standingsDifferential,
        homeIceAdvantage: debouncedWeights.homeIceAdvantage,
        streakImpact: debouncedWeights.streakImpact,
        goalDifferentialImpact: debouncedWeights.goalDifferentialImpact,
        recentFormImpact: debouncedWeights.recentFormImpact,
        backToBackPenalty: debouncedWeights.backToBackPenalty,
        restAdvantage: debouncedWeights.restAdvantage,
        specialTeamsImpact: debouncedWeights.specialTeamsImpact,
        shotDifferentialImpact: debouncedWeights.shotDifferentialImpact,
      },
      playerWeights: {
        goalieMatchupImpact: debouncedWeights.goalieMatchupImpact,
        hotPlayersImpact: debouncedWeights.hotPlayersImpact,
      },
      isActive: false,
      isDefault: false,
    };
  }, [debouncedWeights]);

  // Fetch today's games and standings on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const [gamesRes, standingsRes] = await Promise.all([
          fetch(`https://api-web.nhle.com/v1/score/${todayStr}`),
          fetch('https://api-web.nhle.com/v1/standings/now'),
        ]);

        if (!gamesRes.ok || !standingsRes.ok) {
          throw new Error('Failed to fetch NHL data');
        }

        const gamesData = await gamesRes.json();
        const standingsData = await standingsRes.json();

        const todaysGames: GameData[] = gamesData.games || [];
        setGames(todaysGames);
        setStandings({ standings: standingsData.standings || [] });
        dataLoadedRef.current = true;
      } catch (err) {
        console.error('[LIVE_PREVIEW] Error fetching data:', err);
        setError('Failed to load today\'s games');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate predictions when weights change (debounced)
  useEffect(() => {
    if (!dataLoadedRef.current || games.length === 0 || !standings) {
      return;
    }

    const calculatePredictions = async () => {
      try {
        setPredicting(true);

        // Calculate predictions with current weights
        const predictionPromises = games.map(game =>
          predictWithModelAndBreakdown(tempModel, game, standings)
        );
        const results = await Promise.all(predictionPromises);
        const validPredictions = results.filter((p): p is PredictionWithBreakdown => p !== null);
        setPredictions(validPredictions);
      } catch (err) {
        console.error('[LIVE_PREVIEW] Error calculating predictions:', err);
      } finally {
        setPredicting(false);
      }
    };

    calculatePredictions();
  }, [tempModel, games, standings]);

  // Calculate Classic predictions when toggle is turned on
  useEffect(() => {
    if (!showClassicComparison || classicLoadedRef.current || games.length === 0 || !standings) {
      return;
    }

    const calculateClassicPredictions = async () => {
      try {
        const classicModel = createClassicModel();
        const classicPromises = games.map(game =>
          predictWithModelAndBreakdown(classicModel, game, standings)
        );
        const classicResults = await Promise.all(classicPromises);
        const validClassic = classicResults.filter((p): p is PredictionWithBreakdown => p !== null);
        setClassicPredictions(validClassic);
        classicLoadedRef.current = true;
      } catch (err) {
        console.error('[LIVE_PREVIEW] Error calculating classic predictions:', err);
      }
    };

    calculateClassicPredictions();
  }, [showClassicComparison, games, standings]);

  // Toggle classic comparison
  const toggleClassicComparison = useCallback(() => {
    setShowClassicComparison(prev => !prev);
  }, []);

  // Find classic prediction for a game
  const getClassicPrediction = useCallback((gameId: string | number): PredictionWithBreakdown | undefined => {
    return classicPredictions.find(p => p.id === gameId);
  }, [classicPredictions]);

  // Render a single game prediction card
  const renderGameCard = (prediction: PredictionWithBreakdown) => {
    const homeAbbrev = typeof prediction.homeTeam?.abbrev === 'string'
      ? prediction.homeTeam.abbrev
      : prediction.homeTeam?.teamAbbrev?.toString() || '???';
    const awayAbbrev = typeof prediction.awayTeam?.abbrev === 'string'
      ? prediction.awayTeam.abbrev
      : prediction.awayTeam?.teamAbbrev?.toString() || '???';

    const tier = getConfidenceTier(prediction.confidenceScore);
    const topFactors = getTopFactors(prediction.factorBreakdown, 3);
    const classicPred = showClassicComparison ? getClassicPrediction(prediction.id) : undefined;

    // Determine predicted winner
    const homeWins = prediction.confidenceScore >= 50;
    const predictedWinner = homeWins ? homeAbbrev : awayAbbrev;
    const winProb = homeWins ? prediction.confidenceScore : (100 - prediction.confidenceScore);

    return (
      <View key={prediction.id} style={styles.gameCard}>
        {/* Teams Row */}
        <View style={styles.teamsRow}>
          <View style={styles.teamContainer}>
            <Text style={[
              styles.teamAbbrev,
              homeWins && styles.predictedLoser
            ]}>
              {awayAbbrev}
            </Text>
            <Text style={styles.atSymbol}>@</Text>
            <Text style={[
              styles.teamAbbrev,
              !homeWins && styles.predictedLoser
            ]}>
              {homeAbbrev}
            </Text>
          </View>

          {/* Prediction Badge */}
          <View style={[styles.tierBadge, { backgroundColor: tier.color }]}>
            <Text style={styles.tierText}>{tier.label}</Text>
          </View>
        </View>

        {/* Prediction Details */}
        <View style={styles.predictionDetails}>
          <View style={styles.predictionRow}>
            <Text style={styles.predictedWinnerLabel}>Predicted:</Text>
            <Text style={styles.predictedWinner}>{predictedWinner}</Text>
            <Text style={styles.winProbability}>{formatProbability(winProb)}</Text>
          </View>

          {/* Classic Comparison */}
          {showClassicComparison && classicPred && (
            <View style={styles.classicComparison}>
              <Text style={styles.classicLabel}>Classic:</Text>
              <Text style={styles.classicWinner}>
                {classicPred.confidenceScore >= 50 ? homeAbbrev : awayAbbrev}
              </Text>
              <Text style={styles.classicProbability}>
                {formatProbability(
                  classicPred.confidenceScore >= 50
                    ? classicPred.confidenceScore
                    : (100 - classicPred.confidenceScore)
                )}
              </Text>
              {/* Difference indicator */}
              {(prediction.confidenceScore >= 50) !== (classicPred.confidenceScore >= 50) && (
                <View style={styles.differentPickBadge}>
                  <Text style={styles.differentPickText}>Different</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Top 3 Factors */}
        <View style={styles.factorsContainer}>
          <Text style={styles.factorsTitle}>Top Factors:</Text>
          {topFactors.map((factor, index) => (
            <View key={factor.factorKey} style={styles.factorRow}>
              <Text style={styles.factorName}>{factor.factorName}</Text>
              <View style={styles.factorValues}>
                <Text style={[
                  styles.factorValue,
                  factor.favoredTeam === 'away' && styles.favoredValue
                ]}>
                  {factor.awayValue}
                </Text>
                <Text style={styles.factorSeparator}>vs</Text>
                <Text style={[
                  styles.factorValue,
                  factor.favoredTeam === 'home' && styles.favoredValue
                ]}>
                  {factor.homeValue}
                </Text>
              </View>
              <Text style={[
                styles.factorImpact,
                factor.impact > 0 ? styles.positiveImpact : factor.impact < 0 ? styles.negativeImpact : {}
              ]}>
                {factor.impact > 0 ? '+' : ''}{factor.impact.toFixed(1)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={48} color={theme.subtext} />
      <Text style={styles.emptyTitle}>No Games Today</Text>
      <Text style={styles.emptyDescription}>
        Check back when games are scheduled to see live predictions.
      </Text>
    </View>
  );

  // Render loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading today's games...</Text>
      </View>
    );
  }

  // Render error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Live Preview</Text>
        {predicting && (
          <ActivityIndicator size="small" color={theme.accent} style={styles.predictingIndicator} />
        )}
      </View>

      {/* Classic Comparison Toggle */}
      <TouchableOpacity
        style={styles.toggleContainer}
        onPress={toggleClassicComparison}
        activeOpacity={0.7}
      >
        <View style={[
          styles.toggleSwitch,
          showClassicComparison && styles.toggleSwitchActive
        ]}>
          <View style={[
            styles.toggleKnob,
            showClassicComparison && styles.toggleKnobActive
          ]} />
        </View>
        <Text style={styles.toggleLabel}>Compare vs Classic</Text>
      </TouchableOpacity>

      {/* Games List */}
      {games.length === 0 ? (
        renderEmptyState()
      ) : (
        <ScrollView
          style={styles.gamesList}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          {predictions.map(renderGameCard)}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.card,
    borderRadius: 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  predictingIndicator: {
    marginLeft: 8,
  },
  loadingContainer: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.subtext,
  },
  errorContainer: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.subtle,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchActive: {
    backgroundColor: theme.accent,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.subtext,
  },
  toggleKnobActive: {
    backgroundColor: '#ffffff',
    alignSelf: 'flex-end',
  },
  toggleLabel: {
    marginLeft: 10,
    fontSize: 14,
    color: theme.subtext,
  },
  gamesList: {
    maxHeight: 400,
  },
  gameCard: {
    backgroundColor: theme.factbox,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 10,
    padding: 12,
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  teamContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamAbbrev: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  predictedLoser: {
    opacity: 0.5,
  },
  atSymbol: {
    fontSize: 14,
    color: theme.subtext,
    marginHorizontal: 8,
  },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  predictionDetails: {
    marginBottom: 10,
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  predictedWinnerLabel: {
    fontSize: 12,
    color: theme.subtext,
    marginRight: 6,
  },
  predictedWinner: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent,
    marginRight: 8,
  },
  winProbability: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  classicComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  classicLabel: {
    fontSize: 12,
    color: theme.subtext,
    marginRight: 6,
  },
  classicWinner: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.subtext,
    marginRight: 8,
  },
  classicProbability: {
    fontSize: 13,
    color: theme.subtext,
  },
  differentPickBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  differentPickText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  factorsContainer: {
    borderTopWidth: 1,
    borderTopColor: theme.subtle,
    paddingTop: 10,
  },
  factorsTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  factorName: {
    flex: 1,
    fontSize: 12,
    color: theme.text,
  },
  factorValues: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  factorValue: {
    fontSize: 11,
    color: theme.subtext,
    minWidth: 40,
    textAlign: 'center',
  },
  favoredValue: {
    color: theme.accent,
    fontWeight: '600',
  },
  factorSeparator: {
    fontSize: 10,
    color: theme.subtext,
    marginHorizontal: 4,
  },
  factorImpact: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
    color: theme.subtext,
  },
  positiveImpact: {
    color: '#10b981',
  },
  negativeImpact: {
    color: '#ef4444',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginTop: 12,
  },
  emptyDescription: {
    fontSize: 13,
    color: theme.subtext,
    textAlign: 'center',
    marginTop: 6,
  },
  bottomSpacer: {
    height: 12,
  },
});
