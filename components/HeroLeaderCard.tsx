/**
 * HeroLeaderCard -- Featured card for the #1 ranked player in the selected stat.
 * Shows team-color accent, pace projection, trend badge, and mini stat row.
 */

import React, { useCallback, useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import HitRateBar from './HitRateBar';
import type { TrendingPlayer, HitRateResult, StatCategory, LeaderTrend } from '../services/playerTrends';

const TREND_COLORS: Record<string, string> = {
  HOT: '#ef4444',
  WARM: '#f97316',
  STEADY: '#60a5fa',
  COOL: '#38bdf8',
  COLD: '#6366f1',
};

const STAT_LABELS: Record<StatCategory, string> = {
  goals: 'Goals',
  assists: 'Assists',
  points: 'Points',
  shots: 'Shots',
};

interface HeroLeaderCardProps {
  player: TrendingPlayer;
  leaderTrend?: LeaderTrend;
  hitRate?: HitRateResult;
  statCategory: StatCategory;
  onPress: (playerId: number) => void;
}

export default React.memo(function HeroLeaderCard({
  player,
  leaderTrend,
  hitRate,
  statCategory,
  onPress,
}: HeroLeaderCardProps) {
  const teamColors = useMemo(() => getTeamColors(player.teamAbbrev), [player.teamAbbrev]);
  const trendColor = TREND_COLORS[player.trendLabel] || theme.accent;

  const handlePress = useCallback(() => onPress(player.playerId), [onPress, player.playerId]);

  const paceText = useMemo(() => {
    if (!leaderTrend) return null;
    switch (statCategory) {
      case 'goals': return leaderTrend.projectedGoals82 > 0 ? `On pace for ${Math.round(leaderTrend.projectedGoals82)} goals` : null;
      case 'assists': return leaderTrend.projectedAssists82 > 0 ? `On pace for ${Math.round(leaderTrend.projectedAssists82)} assists` : null;
      case 'points': return leaderTrend.projectedPoints82 > 0 ? `On pace for ${Math.round(leaderTrend.projectedPoints82)} points` : null;
      default: return null;
    }
  }, [leaderTrend, statCategory]);

  const recentAvg = useMemo(() => {
    switch (statCategory) {
      case 'goals': return player.avgGoals5g;
      case 'assists': return player.avgAssists5g;
      case 'points': return player.avgPoints5g;
      case 'shots': return player.avgShots5g;
      default: return 0;
    }
  }, [player, statCategory]);

  const seasonAvg = useMemo(() => {
    if (player.gamesPlayed === 0) return 0;
    switch (statCategory) {
      case 'goals': return player.seasonGoals / player.gamesPlayed;
      case 'assists': return player.seasonAssists / player.gamesPlayed;
      case 'points': return player.seasonPoints / player.gamesPlayed;
      case 'shots': return player.avgShots5g;
      default: return 0;
    }
  }, [player, statCategory]);

  const badgeStyle = useMemo(
    () => [styles.trendBadge, { backgroundColor: trendColor + '22', borderColor: trendColor }],
    [trendColor],
  );

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: teamColors.primary, borderLeftWidth: 4 }]}
      onPress={handlePress}
      activeOpacity={0.7}
      testID={`hero-card-${player.playerId}`}
    >
      {/* Top row: rank + player info + trend badge */}
      <View style={styles.headerRow}>
        <Text style={[styles.rankNumber, { color: teamColors.primary }]}>1</Text>
        <Image
          source={{ uri: player.headshotUrl }}
          style={styles.headshot}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={`hero-${player.playerId}`}
          accessibilityLabel={`${player.playerName} headshot`}
        />
        <View style={styles.nameContainer}>
          <Text style={styles.playerName} numberOfLines={1}>{player.playerName}</Text>
          <Text style={styles.playerMeta}>
            {player.position} · {player.teamAbbrev}
            {player.matchup ? ` · vs ${player.matchup.opponent}` : ''}
          </Text>
        </View>
        <View style={badgeStyle}>
          <Text style={[styles.trendBadgeText, { color: trendColor }]}>{player.trendLabel}</Text>
        </View>
      </View>

      {/* Pace projection */}
      {paceText && (
        <View style={styles.paceRow}>
          <Ionicons name="trending-up" size={14} color={theme.accent} />
          <Text style={styles.paceText}>{paceText}</Text>
        </View>
      )}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>L5 AVG</Text>
          <Text style={[styles.statValue, styles.statValueHighlight]}>{recentAvg.toFixed(2)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>SEASON</Text>
          <Text style={styles.statValue}>{seasonAvg.toFixed(2)}</Text>
        </View>
        {player.pointStreak > 0 && (
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>STREAK</Text>
            <Text style={[styles.statValue, styles.statValueHighlight]}>{player.pointStreak}G</Text>
          </View>
        )}
        {hitRate && hitRate.total > 0 && (
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>HIT RATE</Text>
            <HitRateBar hit={hitRate.hit} total={hitRate.total} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  rankNumber: {
    fontSize: 28,
    fontWeight: '900',
    width: 32,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  headshot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.subtle,
    marginLeft: 8,
  },
  nameContainer: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 2,
  },
  playerMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.subtext,
  },
  trendBadge: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  trendBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  paceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingLeft: 40,
  },
  paceText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accent,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    paddingLeft: 40,
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
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
  statValueHighlight: {
    color: theme.accent,
  },
});
