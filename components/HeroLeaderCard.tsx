/**
 * HeroLeaderCard -- Featured card for the #1 ranked player in the selected stat.
 * Shows: big season total, 82-game projection, recent vs season per-game,
 * shooting %, and season breakdown. All labels written for clarity.
 */

import React, { useCallback, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import type { TrendingPlayer, StatCategory, LeaderTrend } from '../services/playerTrends';

interface HeroLeaderCardProps {
  player: TrendingPlayer;
  leaderTrend?: LeaderTrend;
  statCategory: StatCategory;
  onPress: (playerId: number) => void;
}

export default React.memo(function HeroLeaderCard({
  player,
  leaderTrend,
  statCategory,
  onPress,
}: HeroLeaderCardProps) {
  const teamColors = useMemo(() => getTeamColors(player.teamAbbrev), [player.teamAbbrev]);

  const handlePress = useCallback(() => onPress(player.playerId), [onPress, player.playerId]);

  // Season total
  const seasonTotal = useMemo(() => {
    switch (statCategory) {
      case 'goals': return player.seasonGoals;
      case 'assists': return player.seasonAssists;
      case 'points': return player.seasonPoints;
      case 'shots': return player.avgShots5g ? player.avgShots5g.toFixed(1) : '0';
      default: return 0;
    }
  }, [player, statCategory]);

  // 82-game projection
  const projectionText = useMemo(() => {
    const projected82 = statCategory === 'goals'
      ? (player.projectedGoals82 || leaderTrend?.projectedGoals82)
      : statCategory === 'points'
        ? (player.projectedPoints82 || leaderTrend?.projectedPoints82)
        : statCategory === 'assists'
          ? leaderTrend?.projectedAssists82
          : null;
    if (!projected82 || projected82 <= 0) return null;
    return `On pace for ${Math.round(projected82)}`;
  }, [player, leaderTrend, statCategory]);

  // Per-game averages
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
      case 'shots': return player.seasonShotsPerGame || player.avgShots5g;
      default: return 0;
    }
  }, [player, statCategory]);

  // Shooting %
  const shootingPctRecent = player.recentShootingPct;
  const shootingPctSeason = player.seasonShootingPct;
  const hasShootingData = shootingPctSeason > 0;

  const shootingBarWidth = useMemo(() => {
    if (!hasShootingData) return 0;
    return Math.min(shootingPctRecent / 30, 1);
  }, [shootingPctRecent, hasShootingData]);

  // Recent form comparison
  const recentIsUp = recentAvg > seasonAvg * 1.05;
  const recentIsDown = recentAvg < seasonAvg * 0.95;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: teamColors.primary, borderLeftWidth: 4 },
        pressed && styles.cardPressed,
      ]}
      onPress={handlePress}
      testID={`hero-card-${player.playerId}`}
    >
      {/* Header: rank + player info */}
      <View style={styles.headerRow}>
        <Text style={[styles.rankNumber, { color: teamColors.primary }]}>1</Text>
        <Image
          source={{ uri: player.headshotUrl }}
          style={[styles.headshot, { borderColor: teamColors.primary + '44' }]}
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
      </View>

      {/* Big season stat + projection */}
      <View style={styles.bigStatRow}>
        <View style={styles.bigStatContainer}>
          <Text style={[styles.bigStatNumber, { color: teamColors.primary }]}>
            {seasonTotal}
          </Text>
          <View>
            <Text style={styles.bigStatLabel}>POINTS</Text>
            <Text style={styles.gamesPlayedLabel}>{player.gamesPlayed} games</Text>
          </View>
        </View>

        {projectionText && (
          <View style={styles.paceBadge}>
            <Ionicons name="trending-up" size={12} color={theme.accent} />
            <Text style={styles.paceText}>{projectionText}</Text>
          </View>
        )}

        {player.pointStreak >= 3 && (
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={12} color="#f97316" />
            <Text style={styles.streakText}>{player.pointStreak}g point streak</Text>
          </View>
        )}
      </View>

      {/* Per-game averages: Recent 5 vs Season */}
      <View style={styles.formRow}>
        <View style={styles.formItem}>
          <Text style={styles.formLabel}>RECENT 5 GAMES</Text>
          <Text style={[
            styles.formValue,
            recentIsUp && { color: theme.semantic.positive },
            recentIsDown && { color: theme.semantic.negative },
          ]}>
            {recentAvg.toFixed(2)}
          </Text>
          <Text style={styles.formSubLabel}>per game</Text>
        </View>
        <View style={styles.formDivider} />
        <View style={styles.formItem}>
          <Text style={styles.formLabel}>SEASON AVG</Text>
          <Text style={styles.formValue}>{seasonAvg.toFixed(2)}</Text>
          <Text style={styles.formSubLabel}>per game</Text>
        </View>
      </View>

      {/* Shooting % visual bar */}
      {hasShootingData && (
        <View style={styles.shootingContainer}>
          <View style={styles.shootingHeader}>
            <Text style={styles.shootingLabel}>SHOOTING %</Text>
            <Text style={[
              styles.shootingValue,
              shootingPctRecent > shootingPctSeason && { color: theme.semantic.positive },
              shootingPctRecent < shootingPctSeason * 0.85 && { color: theme.semantic.negative },
            ]}>
              {shootingPctRecent.toFixed(1)}%
            </Text>
            <Text style={styles.shootingSeasonRef}>
              Season {shootingPctSeason.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.shootingBarBg}>
            <View style={[
              styles.shootingBarFill,
              {
                width: `${shootingBarWidth * 100}%`,
                backgroundColor: shootingPctRecent > shootingPctSeason
                  ? theme.semantic.positive
                  : theme.accent,
              },
            ]} />
          </View>
        </View>
      )}

      {/* Season breakdown */}
      <View style={styles.seasonLineRow}>
        <Text style={styles.seasonLineText}>
          {player.seasonGoals} Goals · {player.seasonAssists} Assists
        </Text>
      </View>
    </Pressable>
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
  cardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    borderWidth: 2,
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

  // Big stat row
  bigStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    paddingLeft: 40,
  },
  bigStatContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bigStatNumber: {
    fontSize: 36,
    fontWeight: '900',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
  bigStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.subtext,
    letterSpacing: 0.5,
  },
  gamesPlayedLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.subtext,
    marginTop: 1,
  },
  paceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.accent + '18',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  paceText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.accent,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f9731618',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  streakText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f97316',
  },

  // Form comparison
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    gap: 12,
  },
  formItem: {
    alignItems: 'center',
    flex: 1,
  },
  formLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.subtext,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  formValue: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
  formSubLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: theme.subtext,
    marginTop: 1,
  },
  formDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  // Shooting %
  shootingContainer: {
    marginBottom: 10,
  },
  shootingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  shootingLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.subtext,
    letterSpacing: 0.8,
  },
  shootingValue: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  shootingSeasonRef: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.subtext,
  },
  shootingBarBg: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  shootingBarFill: {
    height: 4,
    borderRadius: 2,
  },

  // Season context line
  seasonLineRow: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  seasonLineText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
