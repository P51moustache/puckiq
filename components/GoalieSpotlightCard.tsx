/**
 * GoalieSpotlightCard -- Featured card highlighting the hottest trending goalie.
 * Shows SV% comparison (recent vs season), GAA, record, and team color accent.
 */

import React, { useCallback, useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import type { TrendingGoalie } from '../services/playerTrends';

const TREND_COLORS: Record<string, string> = {
  HOT: '#ef4444',
  WARM: '#f97316',
  STEADY: '#60a5fa',
  COOL: '#38bdf8',
  COLD: '#6366f1',
};

interface GoalieSpotlightCardProps {
  goalie: TrendingGoalie;
  onPress: (playerId: number) => void;
}

export default React.memo(function GoalieSpotlightCard({
  goalie,
  onPress,
}: GoalieSpotlightCardProps) {
  const teamColors = useMemo(() => getTeamColors(goalie.teamAbbrev), [goalie.teamAbbrev]);
  const trendColor = TREND_COLORS[goalie.trendLabel] || theme.accent;
  const handlePress = useCallback(() => onPress(goalie.playerId), [onPress, goalie.playerId]);

  // Compare recent vs season save percentage
  const svPctDiff = useMemo(() => {
    if (goalie.savePct5g == null || goalie.seasonSavePct == null) return null;
    return goalie.savePct5g - goalie.seasonSavePct;
  }, [goalie.savePct5g, goalie.seasonSavePct]);

  const formatPct = (val: number | null): string => {
    if (val == null) return '---';
    return (val * 100).toFixed(1) + '%';
  };

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: teamColors.primary, borderLeftWidth: 4 }]}
      onPress={handlePress}
      activeOpacity={0.7}
      testID={`goalie-spotlight-${goalie.playerId}`}
    >
      <View style={styles.headerRow}>
        <Image
          source={{ uri: goalie.headshotUrl }}
          style={styles.headshot}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={`goalie-${goalie.playerId}`}
          accessibilityLabel={`${goalie.playerName} headshot`}
        />
        <View style={styles.nameContainer}>
          <Text style={styles.playerName} numberOfLines={1}>{goalie.playerName}</Text>
          <Text style={styles.playerMeta}>G · {goalie.teamAbbrev}</Text>
        </View>
        <View style={[styles.trendBadge, { backgroundColor: trendColor + '22', borderColor: trendColor }]}>
          <Text style={[styles.trendBadgeText, { color: trendColor }]}>{goalie.trendLabel}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>L5 SV%</Text>
          <Text style={[
            styles.statValue,
            svPctDiff != null && svPctDiff > 0 && styles.statValueGreen,
            svPctDiff != null && svPctDiff < -0.01 && styles.statValueRed,
          ]}>
            {formatPct(goalie.savePct5g)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>SEASON</Text>
          <Text style={styles.statValue}>{formatPct(goalie.seasonSavePct)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>L5 GAA</Text>
          <Text style={styles.statValue}>{goalie.avgGa5g.toFixed(2)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>RECORD</Text>
          <Text style={styles.statValue}>{goalie.wins}-{goalie.losses}-{goalie.otLosses}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headshot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.subtle,
  },
  nameContainer: {
    flex: 1,
    marginLeft: 10,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 2,
  },
  playerMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.subtext,
  },
  trendBadge: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  trendBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.subtext,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
  statValueGreen: {
    color: '#22c55e',
  },
  statValueRed: {
    color: '#ef4444',
  },
});
