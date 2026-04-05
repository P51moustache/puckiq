/**
 * WeeklyOutlook
 * Shows weekly category outlook: games remaining, winning/losing categories.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';
import type { PlayerProjection } from '../types/fantasy';

interface WeeklyOutlookProps {
  projections: PlayerProjection[];
  gamesRemaining?: number;
}

interface CategorySummary {
  label: string;
  value: number;
  isEdge: boolean; // true = winning (green), false = gap (red)
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

  // Simple threshold-based edge detection
  // Above league average-ish thresholds = edge, below = gap
  return [
    { label: 'Goals', value: totalGoals, isEdge: totalGoals >= 2 },
    { label: 'Assists', value: totalAssists, isEdge: totalAssists >= 3 },
    { label: 'SOG', value: totalSog, isEdge: totalSog >= 15 },
    { label: 'Hits', value: totalHits, isEdge: totalHits >= 10 },
    { label: 'Blocks', value: totalBlocks, isEdge: totalBlocks >= 8 },
  ];
}

export default function WeeklyOutlook({ projections, gamesRemaining }: WeeklyOutlookProps) {
  const categories = computeCategories(projections);

  return (
    <View style={styles.container} testID="weekly-outlook">
      <Text style={styles.header}>Weekly Outlook</Text>
      {gamesRemaining !== undefined && (
        <Text style={styles.gamesRemaining}>
          {gamesRemaining} game{gamesRemaining !== 1 ? 's' : ''} remaining this week
        </Text>
      )}
      {categories.length === 0 ? (
        <Text style={styles.emptyText}>No projection data available</Text>
      ) : (
        categories.map(cat => (
          <View key={cat.label} style={styles.categoryRow}>
            <View style={[styles.indicator, { backgroundColor: cat.isEdge ? '#10b981' : '#ef4444' }]} />
            <Text style={styles.categoryLabel}>{cat.label}</Text>
            <Text style={[styles.categoryValue, { color: cat.isEdge ? '#10b981' : '#ef4444' }]}>
              {cat.value.toFixed(1)}
            </Text>
            <Text style={styles.categoryTag}>
              {cat.isEdge ? 'Edge' : 'Gap'}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 8,
  },
  gamesRemaining: {
    fontSize: 13,
    color: theme.subtext,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 13,
    color: theme.subtext,
    fontStyle: 'italic',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 14,
    color: theme.text,
  },
  categoryValue: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  categoryTag: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
    width: 36,
    textAlign: 'right',
  },
});
