import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  AdvancedMetric,
  formatMetricValue,
  getMetricRating,
  getRatingColor,
} from '../constants/advancedMetrics';
import { theme } from '../constants/theme';
import StatExplainer from './StatExplainer';

interface AdvancedStatCardProps {
  metric: AdvancedMetric;
  value: number;
  leagueRank?: number; // 1-32
  showRank?: boolean;
  leagueThresholds?: { elite: number; good: number; average: number };
}

export default function AdvancedStatCard({
  metric,
  value,
  leagueRank,
  showRank = true,
  leagueThresholds,
}: AdvancedStatCardProps) {
  const [showExplainer, setShowExplainer] = useState(false);

  // Validate inputs
  if (!metric || value === undefined || value === null) {
    return null;
  }

  const rating = getMetricRating(metric.id, value, leagueRank);
  const ratingColor = getRatingColor(rating);
  const formattedValue = formatMetricValue(metric, value);

  // Calculate percentile for visual bar (ensure it's a valid number)
  const percentile = leagueRank && !isNaN(leagueRank)
    ? Math.max(0, Math.min(100, ((33 - leagueRank) / 32) * 100))
    : 50;

  return (
    <>
      <View style={styles.container}>
        {/* Header with name and info icon */}
        <View style={styles.header}>
          <Text style={styles.statName} numberOfLines={2} ellipsizeMode="tail">
            {String(metric.name || 'Unknown')}
          </Text>
          <TouchableOpacity
            style={styles.infoButton}
            onPress={() => setShowExplainer(true)}
          >
            <Text style={styles.infoIcon}>ⓘ</Text>
          </TouchableOpacity>
        </View>

        {/* Value and rating */}
        <View style={styles.valueRow}>
          <Text
            style={[styles.value, { color: ratingColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {String(formattedValue || '0')}
          </Text>
          <View style={[styles.ratingBadge, { backgroundColor: ratingColor + '22' }]}>
            <Text style={[styles.ratingText, { color: ratingColor }]} numberOfLines={1}>
              {String((rating || 'N/A')).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* League rank (if provided) */}
        {showRank && leagueRank && (
          <View style={styles.rankSection}>
            <Text style={styles.rankLabel} numberOfLines={1}>Rank</Text>
            <Text style={styles.rankValue} numberOfLines={1}>
              {String(leagueRank)}
              {leagueRank === 1 ? 'st' : leagueRank === 2 ? 'nd' : leagueRank === 3 ? 'rd' : 'th'} / 32
            </Text>
          </View>
        )}

        {/* Percentile bar */}
        {leagueRank && (
          <View style={styles.percentileBar}>
            <View
              style={[
                styles.percentileFill,
                { width: `${percentile}%`, backgroundColor: ratingColor },
              ]}
            />
          </View>
        )}
      </View>

      {/* Explainer Modal */}
      <StatExplainer
        visible={showExplainer}
        onClose={() => setShowExplainer(false)}
        metricId={metric.id}
        leagueThresholds={leagueThresholds}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.factbox,
    borderRadius: 12,
    padding: 8,
    gap: 3,
    height: 100,
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  statName: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
    lineHeight: 12,
  },
  infoButton: {
    padding: 2,
    marginLeft: 2,
    flexShrink: 0,
  },
  infoIcon: {
    fontSize: 12,
    color: theme.accent,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    flexShrink: 1,
  },
  ratingBadge: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    flexShrink: 0,
  },
  ratingText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rankSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 1,
  },
  rankLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: theme.subtext,
  },
  rankValue: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.text,
  },
  percentileBar: {
    height: 3,
    backgroundColor: theme.subtle,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  percentileFill: {
    height: '100%',
    borderRadius: 2,
  },
});
