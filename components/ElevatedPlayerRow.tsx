/**
 * ElevatedPlayerRow -- Medium-height row for ranks #2-5 in the leader section.
 * Shows rank, headshot, name, position, team, goals/assists, season points,
 * a sparkline showing recent trend data, flame badges for hot players,
 * and a watch-list toggle.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Sparkline } from './Sparkline';
import { rinkGlass } from '../constants/theme';
import type { TrendingPlayer, HitRateResult, LeaderTrend, StatCategory } from '../services/playerTrends';

const WATCHLIST_KEY = 'puckiq_watchlist';

const TREND_ICONS: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  HOT: { name: 'arrow-up', color: rinkGlass.goalLight },
  WARM: { name: 'arrow-up', color: rinkGlass.powerPlay },
  COOL: { name: 'arrow-down', color: '#38bdf8' },
  COLD: { name: 'arrow-down', color: rinkGlass.blueLight },
};

/** Build a simple 5-value sparkline array from available trend data. */
function buildSparklineData(player: TrendingPlayer, trend?: LeaderTrend): number[] {
  if (trend) {
    return [
      trend.seasonPpg,
      Math.max(trend.recentPpg * 0.8, trend.seasonPpg * 0.9),
      trend.recentPpg,
      trend.recentPpg * (1 + trend.hotColdScore * 0.05),
      trend.recentPpg * (1 + trend.hotColdScore * 0.1),
    ].map(v => Math.max(v, 0));
  }
  // Fallback from player data
  return [
    player.seasonPpg,
    (player.seasonPpg + player.avgPoints5g) / 2,
    player.avgPoints5g,
    player.avgPoints10g,
    player.recentPpg,
  ].map(v => Math.max(v, 0));
}

/** Get flame string for HOT / WARM players. */
function getFlames(trendLabel: string): string {
  if (trendLabel === 'HOT') return '\uD83D\uDD25\uD83D\uDD25\uD83D\uDD25\uD83D\uDD25\uD83D\uDD25';
  if (trendLabel === 'WARM') return '\uD83D\uDD25\uD83D\uDD25\uD83D\uDD25\uD83D\uDD25';
  return '';
}

interface ElevatedPlayerRowProps {
  player: TrendingPlayer;
  rank: number;
  hitRate?: HitRateResult;
  leaderTrend?: LeaderTrend;
  statCategory: StatCategory;
  onPress: (playerId: number) => void;
}

export default React.memo(function ElevatedPlayerRow({
  player,
  rank,
  leaderTrend,
  onPress,
}: ElevatedPlayerRowProps) {
  const handlePress = useCallback(() => onPress(player.playerId), [onPress, player.playerId]);
  const trendIcon = TREND_ICONS[player.trendLabel];
  const sparklineData = buildSparklineData(player, leaderTrend);
  const flames = getFlames(player.trendLabel);

  // Watchlist state
  const [isWatched, setIsWatched] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(WATCHLIST_KEY).then(raw => {
      if (raw) {
        try {
          const ids: number[] = JSON.parse(raw);
          setIsWatched(ids.includes(player.playerId));
        } catch { /* ignore */ }
      }
    });
  }, [player.playerId]);

  const toggleWatch = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(WATCHLIST_KEY);
      const ids: number[] = raw ? JSON.parse(raw) : [];
      let updated: number[];
      if (ids.includes(player.playerId)) {
        updated = ids.filter(id => id !== player.playerId);
        setIsWatched(false);
      } else {
        updated = [...ids, player.playerId];
        setIsWatched(true);
      }
      await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('[WATCHLIST] Error toggling watch:', err);
    }
  }, [player.playerId]);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={handlePress}
      testID={`elevated-row-${player.playerId}`}
    >
      <Text style={styles.rankNumber}>{rank}</Text>

      <Image
        source={{ uri: player.headshotUrl }}
        style={styles.headshot}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={`elevated-${player.playerId}`}
        accessibilityLabel={`${player.playerName} headshot`}
      />

      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={styles.playerName} numberOfLines={1}>{player.playerName}</Text>
          {flames ? (
            <Text style={styles.flamesBadge}>{flames}</Text>
          ) : trendIcon ? (
            <Ionicons
              name={trendIcon.name}
              size={14}
              color={trendIcon.color}
              style={styles.trendArrow}
            />
          ) : null}
        </View>
        <Text style={styles.playerMeta}>
          {player.position} · {player.teamAbbrev}  {player.seasonGoals}G · {player.seasonAssists}A
        </Text>
      </View>

      <Sparkline
        data={sparklineData}
        width={50}
        height={18}
        color={rinkGlass.blueLight}
      />

      <View style={styles.statContainer}>
        <Text style={styles.pointsTotal}>{player.seasonPoints}</Text>
        <Text style={styles.ppgLabel}>{player.gamesPlayed} GP</Text>
      </View>

      <TouchableOpacity
        onPress={toggleWatch}
        style={styles.watchButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        testID={`watch-btn-${player.playerId}`}
      >
        <Ionicons
          name={isWatched ? 'eye' : 'eye-outline'}
          size={16}
          color={isWatched ? rinkGlass.blueLight : rinkGlass.textMuted}
        />
      </TouchableOpacity>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: rinkGlass.glass,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  rowPressed: {
    transform: [{ scale: rinkGlass.pressScale }],
    opacity: 0.9,
  },
  rankNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: rinkGlass.blueLight,
    width: 24,
    textAlign: 'center',
    fontFamily: rinkGlass.fonts.mono,
  },
  headshot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: rinkGlass.boards,
    marginLeft: 8,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    fontSize: 14,
    fontWeight: '600',
    color: rinkGlass.textPrimary,
    flexShrink: 1,
  },
  trendArrow: {
    marginLeft: 4,
  },
  flamesBadge: {
    marginLeft: 4,
    fontSize: 10,
  },
  playerMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: rinkGlass.textSecondary,
    marginTop: 2,
  },
  statContainer: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  pointsTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.mono,
    fontVariant: ['tabular-nums'] as any,
    lineHeight: 24,
  },
  ppgLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: rinkGlass.textSecondary,
    fontFamily: rinkGlass.fonts.mono,
    fontVariant: ['tabular-nums'] as any,
    marginTop: 1,
  },
  watchButton: {
    marginLeft: 8,
    padding: 4,
  },
});
