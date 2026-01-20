import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { getPickStatsByModel, PickStats, CLASSIC_MODEL_ID } from '../services/pickTracking';

interface ModelAccuracyCardProps {
  modelId: string;
  modelName: string;
  compact?: boolean; // For inline display in ModelList cards
}

export default function ModelAccuracyCard({ modelId, modelName, compact = false }: ModelAccuracyCardProps) {
  const [stats, setStats] = useState<PickStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        // Use CLASSIC_MODEL_ID for models without an ID (backward compat)
        const effectiveModelId = modelId || CLASSIC_MODEL_ID;
        const pickStats = await getPickStatsByModel(effectiveModelId);
        setStats(pickStats);
      } catch (error) {
        console.error('[MODEL_ACCURACY] Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [modelId]);

  if (loading) {
    if (compact) {
      return (
        <View style={styles.compactLoading}>
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
      );
    }
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.accent} />
        <Text style={styles.loadingText}>Loading accuracy...</Text>
      </View>
    );
  }

  // No picks yet for this model
  if (!stats || stats.total === 0) {
    if (compact) {
      return (
        <View style={styles.compactEmpty}>
          <Text style={styles.compactEmptyText}>No picks yet</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="analytics-outline" size={24} color={theme.subtext} />
        <Text style={styles.emptyText}>No real-world picks recorded yet</Text>
      </View>
    );
  }

  // Compact version for ModelList cards
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactStat}>
          <Text style={styles.compactLabel}>Real Accuracy</Text>
          <Text style={[
            styles.compactValue,
            stats.accuracy >= 55 ? styles.accuracyGood :
            stats.accuracy >= 50 ? styles.accuracyNeutral :
            styles.accuracyBad
          ]}>
            {stats.accuracy}%
          </Text>
        </View>
        <View style={styles.compactStat}>
          <Text style={styles.compactLabel}>Record</Text>
          <Text style={styles.compactValue}>
            {stats.wins}W-{stats.losses}L
          </Text>
        </View>
        <View style={styles.compactStat}>
          <Text style={styles.compactLabel}>Picks</Text>
          <Text style={styles.compactValue}>{stats.total}</Text>
        </View>
      </View>
    );
  }

  // Full card version
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="trophy-outline" size={20} color={theme.accent} />
        <Text style={styles.headerTitle}>Real-World Performance</Text>
      </View>

      <Text style={styles.modelName}>{modelName}</Text>

      <View style={styles.statsGrid}>
        {/* Accuracy */}
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Accuracy</Text>
          <Text style={[
            styles.statValueLarge,
            stats.accuracy >= 55 ? styles.accuracyGood :
            stats.accuracy >= 50 ? styles.accuracyNeutral :
            styles.accuracyBad
          ]}>
            {stats.accuracy}%
          </Text>
        </View>

        {/* Wins */}
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Wins</Text>
          <Text style={[styles.statValue, styles.accuracyGood]}>{stats.wins}</Text>
        </View>

        {/* Losses */}
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Losses</Text>
          <Text style={[styles.statValue, styles.accuracyBad]}>{stats.losses}</Text>
        </View>

        {/* Total Picks */}
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total Picks</Text>
          <Text style={styles.statValue}>{stats.total}</Text>
        </View>
      </View>

      {stats.pushes > 0 && (
        <Text style={styles.pushesNote}>
          {stats.pushes} push{stats.pushes !== 1 ? 'es' : ''} (not counted)
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modelName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.factbox,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: theme.subtext,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  statValueLarge: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.text,
  },
  accuracyGood: {
    color: '#10b981',
  },
  accuracyNeutral: {
    color: '#f59e0b',
  },
  accuracyBad: {
    color: '#ef4444',
  },
  pushesNote: {
    fontSize: 12,
    color: theme.subtext,
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
  },
  // Loading state
  loadingContainer: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 13,
    color: theme.subtext,
    marginTop: 8,
  },
  // Empty state
  emptyContainer: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 13,
    color: theme.subtext,
    marginTop: 8,
  },
  // Compact styles (for ModelList cards)
  compactContainer: {
    flexDirection: 'row',
    backgroundColor: theme.factbox,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  compactStat: {
    flex: 1,
    alignItems: 'center',
  },
  compactLabel: {
    fontSize: 10,
    color: theme.subtext,
    marginBottom: 2,
  },
  compactValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  compactLoading: {
    backgroundColor: theme.factbox,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  compactEmpty: {
    backgroundColor: theme.factbox,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  compactEmptyText: {
    fontSize: 12,
    color: theme.subtext,
    fontStyle: 'italic',
  },
});
