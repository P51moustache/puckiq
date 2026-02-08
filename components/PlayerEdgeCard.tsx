/**
 * PlayerEdgeCard — Compact, data-dense player card inspired by Sleeper's PICKS layout.
 * Single-row design: [Headshot + Name/Team] [L10 Bar Chart] [Stat Value] [Trend Badge]
 * Fits ~6-7 cards on screen for rapid scanning.
 */

import React, { useCallback, useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import type { TrendingPlayer, HitRateResult, StatCategory, L10GameStat } from '../services/playerTrends';

// ---------------------------------------------------------------------------
// Trend badge colors
// ---------------------------------------------------------------------------

const TREND_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  HOT: { bg: '#ef444422', text: '#ef4444', border: '#ef444466' },
  WARM: { bg: '#f9731622', text: '#f97316', border: '#f9731666' },
  STEADY: { bg: '#60a5fa22', text: '#60a5fa', border: '#60a5fa66' },
  COOL: { bg: '#38bdf822', text: '#38bdf8', border: '#38bdf866' },
  COLD: { bg: '#6366f122', text: '#6366f1', border: '#6366f166' },
};

const STAT_LABELS: Record<StatCategory, string> = {
  goals: 'G',
  assists: 'A',
  points: 'P',
  shots: 'SOG',
};

const DEFAULT_THRESHOLDS: Record<StatCategory, number> = {
  goals: 0.5,
  assists: 0.5,
  points: 0.5,
  shots: 2.5,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlayerEdgeCardProps {
  player: TrendingPlayer;
  hitRate?: HitRateResult;
  l10Stats?: L10GameStat[];
  statCategory: StatCategory;
  onPress: (playerId: number) => void;
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default React.memo(function PlayerEdgeCard({
  player,
  hitRate,
  l10Stats,
  statCategory,
  onPress,
}: PlayerEdgeCardProps) {
  const trendStyle = TREND_COLORS[player.trendLabel] || TREND_COLORS.STEADY;
  const threshold = DEFAULT_THRESHOLDS[statCategory];
  const teamColors = getTeamColors(player.teamAbbrev);

  const recentAvg = useMemo(() => getRecentAvg(player, statCategory), [player, statCategory]);
  const seasonAvg = useMemo(() => getSeasonAvg(player, statCategory), [player, statCategory]);
  const handlePress = useCallback(() => onPress(player.playerId), [onPress, player.playerId]);

  // Build L10 bar data
  const bars = useMemo(() => {
    if (!l10Stats || l10Stats.length === 0) return null;
    const max = Math.max(...l10Stats.map(g => g.value), 1);
    return l10Stats.map(g => ({
      value: g.value,
      exceeded: g.value > threshold,
      heightPct: Math.max(0.08, g.value / max),
    }));
  }, [l10Stats, threshold]);

  // Hit rate display
  const hitDisplay = useMemo(() => {
    if (!hitRate || hitRate.total === 0) return null;
    return { hit: hitRate.hit, total: hitRate.total };
  }, [hitRate]);

  // Stat value to display prominently
  const statValue = recentAvg;
  const isOverSeason = recentAvg > seasonAvg && seasonAvg > 0;

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: teamColors?.primary || theme.colors.primary, borderLeftWidth: 3 }]}
      onPress={handlePress}
      activeOpacity={0.7}
      testID={`edge-card-${player.playerId}`}
    >
      {/* Row 1: Player info + stat value + trend badge */}
      <View style={styles.mainRow}>
        {/* Left: Headshot + Name */}
        <Image
          source={{ uri: player.headshotUrl }}
          style={styles.headshot}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={`edge-${player.playerId}`}
        />
        <View style={styles.nameCol}>
          <Text style={styles.playerName} numberOfLines={1}>
            {player.playerName}
          </Text>
          <Text style={styles.playerMeta} numberOfLines={1}>
            {player.position} · {player.teamAbbrev}
            {player.matchup ? ` · vs ${player.matchup.opponent}` : ''}
          </Text>
        </View>

        {/* Center: L10 mini bars */}
        {bars && (
          <View style={styles.barsContainer}>
            {bars.map((bar, i) => (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    height: Math.max(3, bar.heightPct * 22),
                    backgroundColor: bar.exceeded ? theme.semantic.positive : 'rgba(255, 255, 255, 0.12)',
                  },
                ]}
              />
            ))}
          </View>
        )}

        {/* Right: Stat value */}
        <View style={styles.statCol}>
          <Text style={styles.statValue}>
            {statValue.toFixed(1)}
          </Text>
          <Text style={styles.statLabel}>{STAT_LABELS[statCategory]}</Text>
        </View>

        {/* Far right: Trend badge */}
        <View style={[styles.trendBadge, { backgroundColor: trendStyle.bg, borderColor: trendStyle.border }]}>
          <Text style={[styles.trendText, { color: trendStyle.text }]}>
            {player.trendLabel}
          </Text>
        </View>
      </View>

      {/* Row 2: Hit rate + avg comparison (compact) */}
      <View style={styles.detailRow}>
        {hitDisplay && (
          <View style={styles.hitRateSection}>
            <View style={styles.hitDots}>
              {Array.from({ length: hitDisplay.total }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.hitDot,
                    { backgroundColor: i < hitDisplay.hit ? theme.semantic.positive : 'rgba(255,255,255,0.12)' },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.hitText, hitDisplay.hit >= hitDisplay.total * 0.7 ? styles.hitTextGood : null]}>
              {hitDisplay.hit}/{hitDisplay.total}
            </Text>
          </View>
        )}
        <Text style={styles.avgText}>
          Avg {seasonAvg.toFixed(1)}
        </Text>
        {player.pointStreak > 0 && (
          <Text style={styles.streakText}>
            {player.pointStreak}G streak
          </Text>
        )}
        {isOverSeason && (
          <View style={styles.overBadge}>
            <Text style={styles.overText}>ABOVE AVG</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRecentAvg(player: TrendingPlayer, stat: StatCategory): number {
  switch (stat) {
    case 'goals': return player.avgGoals5g;
    case 'assists': return player.avgAssists5g;
    case 'points': return player.avgPoints5g;
    case 'shots': return player.avgShots5g;
    default: return 0;
  }
}

function getSeasonAvg(player: TrendingPlayer, stat: StatCategory): number {
  if (player.gamesPlayed === 0) return 0;
  switch (stat) {
    case 'goals': return player.seasonGoals / player.gamesPlayed;
    case 'assists': return player.seasonAssists / player.gamesPlayed;
    case 'points': return player.seasonPoints / player.gamesPlayed;
    case 'shots': return player.avgShots5g;
    default: return 0;
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    paddingLeft: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  // Row 1: main content
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headshot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.elevated,
  },
  nameCol: {
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  playerMeta: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  // L10 bars
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 24,
    gap: 2,
    marginRight: 10,
  },
  bar: {
    width: 4,
    borderRadius: 1.5,
  },
  // Stat value
  statCol: {
    alignItems: 'center',
    marginRight: 8,
    minWidth: 36,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: -1,
  },
  // Trend badge
  trendBadge: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 44,
    alignItems: 'center',
  },
  trendText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Row 2: detail line
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingLeft: 44,
    gap: 10,
  },
  hitRateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hitDots: {
    flexDirection: 'row',
    gap: 1.5,
  },
  hitDot: {
    width: 5,
    height: 5,
    borderRadius: 1,
  },
  hitText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  hitTextGood: {
    color: theme.semantic.positive,
  },
  avgText: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  streakText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f97316',
  },
  overBadge: {
    backgroundColor: theme.semantic.positive + '22',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  overText: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.semantic.positive,
    letterSpacing: 0.5,
  },
});
