/**
 * ElevatedPlayerRow -- Medium-height row for ranks #2-5 in the leader section.
 * Shows rank, headshot, name, trend arrow, L5 mini dots, and key stat value.
 */

import React, { useCallback, useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import type { TrendingPlayer, HitRateResult, StatCategory } from '../services/playerTrends';

const TREND_COLORS: Record<string, string> = {
  HOT: '#ef4444',
  WARM: '#f97316',
  STEADY: '#60a5fa',
  COOL: '#38bdf8',
  COLD: '#6366f1',
};

const TREND_ICONS: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  HOT: { name: 'arrow-up', color: '#ef4444' },
  WARM: { name: 'arrow-up', color: '#f97316' },
  STEADY: { name: 'remove', color: '#60a5fa' },
  COOL: { name: 'arrow-down', color: '#38bdf8' },
  COLD: { name: 'arrow-down', color: '#6366f1' },
};

interface ElevatedPlayerRowProps {
  player: TrendingPlayer;
  rank: number;
  hitRate?: HitRateResult;
  statCategory: StatCategory;
  onPress: (playerId: number) => void;
}

export default React.memo(function ElevatedPlayerRow({
  player,
  rank,
  hitRate,
  statCategory,
  onPress,
}: ElevatedPlayerRowProps) {
  const handlePress = useCallback(() => onPress(player.playerId), [onPress, player.playerId]);
  const trendIcon = TREND_ICONS[player.trendLabel] || TREND_ICONS.STEADY;

  const statValue = useMemo(() => {
    switch (statCategory) {
      case 'goals': return player.avgGoals5g.toFixed(2);
      case 'assists': return player.avgAssists5g.toFixed(2);
      case 'points': return player.avgPoints5g.toFixed(2);
      case 'shots': return player.avgShots5g.toFixed(1);
      default: return '0';
    }
  }, [player, statCategory]);

  const statUnit = useMemo(() => {
    switch (statCategory) {
      case 'goals': return 'GPG';
      case 'assists': return 'APG';
      case 'points': return 'PPG';
      case 'shots': return 'SPG';
      default: return '';
    }
  }, [statCategory]);

  // L5 mini dots: last 5 games from hit rate data
  const l5Dots = useMemo(() => {
    if (!hitRate || hitRate.games.length === 0) return null;
    // Take last 5 games (games are in reverse chronological order)
    return hitRate.games.slice(0, 5).reverse();
  }, [hitRate]);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={handlePress}
      activeOpacity={0.7}
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
          <Ionicons
            name={trendIcon.name}
            size={14}
            color={trendIcon.color}
            style={styles.trendArrow}
          />
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.playerMeta}>{player.position} · {player.teamAbbrev}</Text>
          {l5Dots && (
            <View style={styles.dotsRow}>
              {l5Dots.map((game, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: game.exceeded ? '#22c55e' : 'rgba(255, 255, 255, 0.15)' },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </View>

      <View style={styles.statContainer}>
        <Text style={styles.statValue}>{statValue}</Text>
        <Text style={styles.statUnit}>{statUnit}</Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  rankNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.accent,
    width: 24,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  headshot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.subtle,
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
    color: theme.text,
    flexShrink: 1,
  },
  trendArrow: {
    marginLeft: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  playerMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statContainer: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
  statUnit: {
    fontSize: 9,
    fontWeight: '600',
    color: theme.subtext,
    letterSpacing: 0.5,
    marginTop: 1,
  },
});
