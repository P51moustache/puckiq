/**
 * NHL Edge "telemetry" for the player sheet — F1-style timing colours on league
 * percentiles. Free users see the headline metric; the rest is Pro.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { edgeTier, percentileLabel, type EdgeMetric, type EdgeProfile, type EdgeTier } from '../../services/nhl/edge';
import { seasonLabel } from '../../services/nhl/dates';
import { colors, DarkCard, display, Skeleton } from './ui';

/** F1 live-timing palette: purple fastest, green personal best, amber slower. */
export const TIER_COLOR: Record<EdgeTier, string> = {
  elite: colors.elite,
  good: '#22C55E',
  below: '#F5A524',
};

function LockedRow({ metric }: { metric: EdgeMetric }) {
  return (
    <View style={styles.lockedRow} testID={`edge-${metric.key}`}>
      <Text style={styles.label}>{metric.label.toUpperCase()}</Text>
      <View style={styles.lockedFill} />
      <Ionicons name="lock-closed" size={12} color={colors.onInkSub} />
    </View>
  );
}

function MetricRow({ metric, locked }: { metric: EdgeMetric; locked: boolean }) {
  if (locked) return <LockedRow metric={metric} />;
  const tier = metric.percentile === null ? null : edgeTier(metric.percentile);
  const fill = tier ? TIER_COLOR[tier] : colors.onInkSub;
  const width = metric.percentile === null ? 0 : Math.max(4, Math.round(metric.percentile * 100));
  return (
    <View style={styles.row} testID={`edge-${metric.key}`}>
      <View style={styles.rowTop}>
        <Text style={styles.label}>{metric.label.toUpperCase()}</Text>
        {metric.percentile !== null ? (
          <Text style={[styles.percentile, { color: fill }]}>{percentileLabel(metric.percentile)}</Text>
        ) : null}
      </View>
      <View style={styles.valueLine}>
        <Text style={styles.value}>{metric.value}</Text>
        {metric.unit ? <Text style={styles.unit}>{metric.unit}</Text> : null}
        {metric.leagueAvg ? <Text style={styles.avg}>Lg avg {metric.leagueAvg}</Text> : null}
      </View>
      <View style={styles.track}>
        {width > 0 ? <View style={[styles.fill, { width: `${width}%`, backgroundColor: fill }]} /> : null}
      </View>
    </View>
  );
}

export function EdgePanel({
  edge,
  loading,
  isPro,
  onUnlock,
}: {
  edge: EdgeProfile | null;
  loading: boolean;
  isPro: boolean;
  onUnlock: () => void;
}) {
  if (loading && !edge) {
    return (
      <DarkCard style={styles.card}>
        <Skeleton width="45%" height={12} />
        <View style={styles.skeletonGap} />
        <Skeleton width="100%" height={36} />
      </DarkCard>
    );
  }
  if (!edge) return null;

  const [headline, ...rest] = edge.metrics;
  return (
    <DarkCard style={styles.card} testID="player-edge">
      <View style={styles.kickerRow}>
        <View style={styles.dot} />
        <Text style={styles.kicker}>NHL EDGE · {seasonLabel(edge.seasonId)}</Text>
        <View style={styles.legend}>
          {(['elite', 'good', 'below'] as EdgeTier[]).map((tier) => (
            <View key={tier} style={[styles.legendDot, { backgroundColor: TIER_COLOR[tier] }]} />
          ))}
        </View>
      </View>
      <MetricRow metric={headline} locked={false} />
      {isPro ? (
        rest.map((metric) => <MetricRow key={metric.key} metric={metric} locked={false} />)
      ) : (
        <View style={styles.lockedList}>{rest.map((metric) => <MetricRow key={metric.key} metric={metric} locked />)}</View>
      )}
      {!isPro && rest.length > 0 ? (
        <Pressable
          onPress={onUnlock}
          style={({ pressed }) => [styles.unlock, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Unlock full NHL Edge telemetry with Pro"
          testID="player-edge-unlock"
        >
          <Text style={styles.unlockText}>Unlock full telemetry</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.onAccent} />
        </Pressable>
      ) : null}
      <Text style={styles.footnote}>Percentile vs. NHL {edge.isGoalie ? 'goalies' : 'skaters'} · purple = top 10%</Text>
    </DarkCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
  skeletonGap: {
    height: 10,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.accent,
  },
  kicker: {
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: colors.onInk,
  },
  legend: {
    flexDirection: 'row',
    gap: 4,
  },
  legendDot: {
    width: 14,
    height: 4,
    borderRadius: 2,
  },
  row: {
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: colors.onInkSub,
  },
  percentile: {
    ...display(15),
  },
  valueLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  value: {
    ...display(26),
    color: colors.onInk,
  },
  unit: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.onInkSub,
  },
  avg: {
    marginLeft: 'auto',
    fontSize: 11,
    color: colors.onInkSub,
    fontVariant: ['tabular-nums'],
  },
  lockedList: {
    gap: 2,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  lockedFill: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF14',
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF1A',
    overflow: 'hidden',
  },
  fill: {
    height: 5,
    borderRadius: 3,
  },
  unlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
  },
  unlockText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.onAccent,
  },
  pressed: {
    opacity: 0.8,
  },
  footnote: {
    fontSize: 11,
    color: colors.onInkSub,
  },
});
