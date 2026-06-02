/**
 * WeeklyOutlook
 * Premium weekly category outlook with broadcast-quality horizontal bar charts.
 * Shows winning/losing categories with edge indicators.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../constants/theme';
import type { PlayerProjection } from '../types/fantasy';

interface WeeklyOutlookProps {
  projections: PlayerProjection[];
  gamesRemaining?: number;
}

interface CategorySummary {
  label: string;
  value: number;
  threshold: number;
  status: 'winning' | 'losing' | 'close';
  edge: number; // positive = winning by this much, negative = losing
}

function computeCategories(projections: PlayerProjection[]): CategorySummary[] {
  if (projections.length === 0) return [];

  let totalGoals = 0;
  let totalAssists = 0;
  let totalSog = 0;
  let totalHits = 0;
  let totalBlocks = 0;

  for (const p of projections) {
    totalGoals += p.predGoals;
    totalAssists += p.predAssists;
    totalSog += p.predSog;
    totalHits += p.predHits;
    totalBlocks += p.predBlocks;
  }

  const cats: { label: string; value: number; threshold: number }[] = [
    { label: 'Goals', value: totalGoals, threshold: 2 },
    { label: 'Assists', value: totalAssists, threshold: 3 },
    { label: 'SOG', value: totalSog, threshold: 15 },
    { label: 'Hits', value: totalHits, threshold: 10 },
    { label: 'Blocks', value: totalBlocks, threshold: 8 },
  ];

  return cats.map(c => {
    const edge = c.value - c.threshold;
    const pct = c.threshold > 0 ? (c.value / c.threshold) : 1;
    let status: 'winning' | 'losing' | 'close';
    if (pct >= 1.1) status = 'winning';
    else if (pct >= 0.85) status = 'close';
    else status = 'losing';
    return { ...c, status, edge };
  });
}

const STATUS_COLORS = {
  winning: rinkGlass.faceoffDot,
  losing: rinkGlass.redLine,
  close: rinkGlass.powerPlay,
};

const STATUS_LABELS = {
  winning: 'Edge',
  losing: 'Gap',
  close: 'Close',
};

export default function WeeklyOutlook({ projections, gamesRemaining }: WeeklyOutlookProps) {
  const categories = computeCategories(projections);
  const maxValue = Math.max(...categories.map(c => c.value), 1);

  return (
    <Animated.View
      entering={FadeInDown.delay(200).duration(400).springify()}
      style={styles.container}
      testID="weekly-outlook"
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>WEEKLY OUTLOOK</Text>
          <View style={styles.headerUnderline} />
        </View>
        {gamesRemaining !== undefined && (
          <View style={styles.gamesRemainingPill}>
            <Ionicons name="calendar-outline" size={12} color={rinkGlass.textSecondary} />
            <Text style={styles.gamesRemainingText}>
              {gamesRemaining} game{gamesRemaining !== 1 ? 's' : ''} left
            </Text>
          </View>
        )}
      </View>

      {/* Games remaining progress bar */}
      {gamesRemaining !== undefined && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(((12 - gamesRemaining) / 12) * 100, 100)}%`,
                backgroundColor: rinkGlass.blueLight,
              },
            ]}
          />
        </View>
      )}

      {categories.length === 0 ? (
        <Text style={styles.emptyText}>No projection data available</Text>
      ) : (
        <View style={styles.categoryList}>
          {categories.map((cat, idx) => {
            const color = STATUS_COLORS[cat.status];
            const barPct = maxValue > 0 ? (cat.value / (maxValue * 1.2)) * 100 : 0;
            const edgeStr = cat.edge >= 0 ? `+${cat.edge.toFixed(1)}` : cat.edge.toFixed(1);

            return (
              <View key={cat.label} style={styles.categoryRow}>
                <Text style={styles.categoryLabel}>{cat.label}</Text>
                <View style={styles.barContainer}>
                  <View style={styles.barTrack}>
                    <View
                      style={[styles.barFill, { width: `${Math.max(barPct, 8)}%`, backgroundColor: color }]}
                    />
                  </View>
                </View>
                <Text style={[styles.categoryValue, { color }]}>
                  {cat.value.toFixed(1)}
                </Text>
                <View style={[styles.edgeBadge, { backgroundColor: `${color}20` }]}>
                  <Text style={[styles.edgeText, { color }]}>
                    {edgeStr}
                  </Text>
                </View>
                <Text style={[styles.statusTag, { color }]}>
                  {STATUS_LABELS[cat.status]}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: rinkGlass.glass,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'column',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: rinkGlass.fonts.display,
    color: rinkGlass.textPrimary,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  headerUnderline: {
    height: 2,
    width: 40,
    borderRadius: 1,
    backgroundColor: rinkGlass.blueLight,
  },
  gamesRemainingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: rinkGlass.glass,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  gamesRemainingText: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
    fontWeight: '600',
  },
  // Progress bar
  progressTrack: {
    height: 3,
    backgroundColor: rinkGlass.boards,
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  emptyText: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
    fontStyle: 'italic',
  },
  // Category rows
  categoryList: {
    gap: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryLabel: {
    width: 52,
    fontSize: 13,
    color: rinkGlass.textSecondary,
    fontWeight: '600',
  },
  barContainer: {
    flex: 1,
    marginHorizontal: 8,
  },
  barTrack: {
    height: 6,
    backgroundColor: rinkGlass.boards,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  categoryValue: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: rinkGlass.fonts.mono,
    width: 36,
    textAlign: 'right',
  },
  edgeBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  edgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTag: {
    fontSize: 11,
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
    marginLeft: 4,
  },
});
