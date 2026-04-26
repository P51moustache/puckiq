/**
 * HeroLeaderCard -- Featured card for the #1 ranked player in the selected stat.
 * Shows: big season total, 82-game projection, recent vs season per-game,
 * shooting %, and season breakdown. All labels written for clarity.
 */

import React, { useCallback, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../constants/theme';
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

  // 82-game projection — pure stat readout, no narrative pill
  const projectionValue = useMemo(() => {
    const projected82 = statCategory === 'goals'
      ? (player.projectedGoals82 || leaderTrend?.projectedGoals82)
      : statCategory === 'points'
        ? (player.projectedPoints82 || leaderTrend?.projectedPoints82)
        : statCategory === 'assists'
          ? leaderTrend?.projectedAssists82
          : null;
    if (!projected82 || projected82 <= 0) return null;
    return Math.round(projected82);
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
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={handlePress}
      testID={`hero-card-${player.playerId}`}
    >
      {/* Header: rank + player info */}
      <View style={styles.headerRow}>
        <Text style={styles.rankNumber}>1</Text>
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
      </View>

      {/* Big season stat + projection */}
      <View style={styles.bigStatRow}>
        <View style={styles.bigStatContainer}>
          <Text style={styles.bigStatNumber}>{seasonTotal}</Text>
          <View>
            <Text style={styles.bigStatLabel}>POINTS</Text>
            <Text style={styles.gamesPlayedLabel}>{player.gamesPlayed} GP</Text>
          </View>
        </View>

        {projectionValue != null && (
          <View style={styles.paceBlock}>
            <Text style={styles.paceValue}>{projectionValue}</Text>
            <Text style={styles.paceLabel}>82-GP PACE</Text>
          </View>
        )}

        {player.pointStreak >= 3 && (
          <View style={styles.streakBlock}>
            <Text style={styles.streakValue}>{player.pointStreak}</Text>
            <Text style={styles.streakLabel}>GAME STREAK</Text>
          </View>
        )}
      </View>

      {/* Per-game averages: Recent 5 vs Season */}
      <View style={styles.formRow}>
        <View style={styles.formItem}>
          <Text style={styles.formLabel}>RECENT 5 GAMES</Text>
          <Text style={[
            styles.formValue,
            recentIsUp && { color: rinkGlass.faceoffDot },
            recentIsDown && { color: rinkGlass.redLine },
          ]}>
            {recentAvg > 0 ? recentAvg.toFixed(2) : '—'}
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

      {/* Shooting % visual bar — cyan only; semantics live in the value color */}
      {hasShootingData && (
        <View style={styles.shootingContainer}>
          <View style={styles.shootingHeader}>
            <Text style={styles.shootingLabel}>SHOOTING %</Text>
            <Text style={[
              styles.shootingValue,
              shootingPctRecent > shootingPctSeason && { color: rinkGlass.faceoffDot },
              shootingPctRecent < shootingPctSeason * 0.85 && { color: rinkGlass.redLine },
            ]}>
              {shootingPctRecent.toFixed(1)}%
            </Text>
            <Text style={styles.shootingSeasonRef}>
              SEASON {shootingPctSeason.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.shootingBarBg}>
            <View style={[
              styles.shootingBarFill,
              {
                width: `${shootingBarWidth * 100}%`,
                backgroundColor: rinkGlass.blueLight,
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
    backgroundColor: rinkGlass.boards,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
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
    fontSize: 24,
    fontWeight: '700',
    width: 28,
    textAlign: 'center',
    color: rinkGlass.blueLight,
    fontFamily: rinkGlass.fonts.display,
  },
  headshot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: rinkGlass.zamboni,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  nameContainer: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontSize: 18,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    marginBottom: 2,
  },
  playerMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: rinkGlass.textSecondary,
  },

  // Big stat row
  bigStatRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 16,
    marginBottom: 10,
    paddingLeft: 34,
  },
  bigStatContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  bigStatNumber: {
    fontSize: 44,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.display,
    letterSpacing: -1.5,
  },
  bigStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: rinkGlass.textSecondary,
    letterSpacing: 1.5,
  },
  gamesPlayedLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: rinkGlass.textMuted,
    marginTop: 1,
    letterSpacing: 1,
    fontFamily: rinkGlass.fonts.mono,
  },
  paceBlock: {
    alignItems: 'flex-start',
  },
  paceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: rinkGlass.blueLight,
    fontFamily: rinkGlass.fonts.display,
    letterSpacing: -0.5,
  },
  paceLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: rinkGlass.textMuted,
    letterSpacing: 1.5,
    fontFamily: rinkGlass.fonts.mono,
  },
  streakBlock: {
    alignItems: 'flex-start',
  },
  streakValue: {
    fontSize: 22,
    fontWeight: '700',
    color: rinkGlass.powerPlay,
    fontFamily: rinkGlass.fonts.display,
    letterSpacing: -0.5,
  },
  streakLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: rinkGlass.textMuted,
    letterSpacing: 1.5,
    fontFamily: rinkGlass.fonts.mono,
  },

  // Form comparison
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: rinkGlass.glassHighlight,
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
    color: rinkGlass.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  formValue: {
    fontSize: 17,
    fontWeight: '800',
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.mono,
    fontVariant: ['tabular-nums'] as any,
  },
  formSubLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: rinkGlass.textSecondary,
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
    color: rinkGlass.textSecondary,
    letterSpacing: 0.8,
  },
  shootingValue: {
    fontSize: 13,
    fontWeight: '800',
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.mono,
  },
  shootingSeasonRef: {
    fontSize: 10,
    fontWeight: '600',
    color: rinkGlass.textSecondary,
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
    color: rinkGlass.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
