/**
 * ElevatedPlayerRow -- Medium-height row for ranks #2-5 in the leader section.
 * Shows rank, headshot, name, position, team, goals/assists, and season points.
 */

import React, { useCallback } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import type { TrendingPlayer, HitRateResult, StatCategory } from '../services/playerTrends';

const TREND_ICONS: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  HOT: { name: 'arrow-up', color: '#ef4444' },
  WARM: { name: 'arrow-up', color: '#f97316' },
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
  onPress,
}: ElevatedPlayerRowProps) {
  const handlePress = useCallback(() => onPress(player.playerId), [onPress, player.playerId]);
  const trendIcon = TREND_ICONS[player.trendLabel];

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
          {trendIcon && (
            <Ionicons
              name={trendIcon.name}
              size={14}
              color={trendIcon.color}
              style={styles.trendArrow}
            />
          )}
        </View>
        <Text style={styles.playerMeta}>
          {player.position} · {player.teamAbbrev}  {player.seasonGoals}G · {player.seasonAssists}A
        </Text>
      </View>

      <View style={styles.statContainer}>
        <Text style={styles.pointsTotal}>{player.seasonPoints}</Text>
        <Text style={styles.ppgLabel}>{player.gamesPlayed} GP</Text>
      </View>
    </Pressable>
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
  rowPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
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
  playerMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
    marginTop: 2,
  },
  statContainer: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  pointsTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
    lineHeight: 24,
  },
  ppgLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.subtext,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
    marginTop: 1,
  },
});
