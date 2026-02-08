/**
 * CompactPlayerRow -- Compact single-line row for ranks #6-10.
 * Minimal: rank, small headshot, name, team, trend pill, stat value.
 */

import React, { useCallback, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import type { TrendingPlayer, StatCategory } from '../services/playerTrends';

const TREND_COLORS: Record<string, string> = {
  HOT: '#ef4444',
  WARM: '#f97316',
  STEADY: '#60a5fa',
  COOL: '#38bdf8',
  COLD: '#6366f1',
};

interface CompactPlayerRowProps {
  player: TrendingPlayer;
  rank: number;
  statCategory: StatCategory;
  onPress: (playerId: number) => void;
}

export default React.memo(function CompactPlayerRow({
  player,
  rank,
  statCategory,
  onPress,
}: CompactPlayerRowProps) {
  const handlePress = useCallback(() => onPress(player.playerId), [onPress, player.playerId]);
  const teamColors = useMemo(() => getTeamColors(player.teamAbbrev), [player.teamAbbrev]);
  const trendColor = TREND_COLORS[player.trendLabel] || theme.accent;

  // Always points-focused
  const goalsAssists = `${player.seasonGoals}G · ${player.seasonAssists}A`;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={handlePress}
      testID={`compact-row-${player.playerId}`}
    >
      <Text style={[styles.rankNumber, { color: teamColors.primary }]}>{rank}</Text>

      <Image
        source={{ uri: player.headshotUrl }}
        style={styles.headshot}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={`compact-${player.playerId}`}
      />

      <Text style={styles.playerName} numberOfLines={1}>{player.lastName}</Text>
      <Text style={styles.teamAbbrev}>{player.teamAbbrev}</Text>
      <Text style={styles.goalsAssists}>{goalsAssists}</Text>

      {player.trendLabel !== 'STEADY' && (
        <View style={[styles.trendPill, { backgroundColor: trendColor + '22' }]}>
          <Text style={[styles.trendText, { color: trendColor }]}>{player.trendLabel}</Text>
        </View>
      )}

      <Text style={styles.statValue}>{player.seasonPoints}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  rowPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  rankNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.subtext,
    width: 20,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  headshot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.subtle,
    marginLeft: 6,
  },
  playerName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
    marginLeft: 8,
  },
  teamAbbrev: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
    marginRight: 6,
  },
  goalsAssists: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.accent,
    letterSpacing: 0.3,
    marginRight: 8,
  },
  trendPill: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginRight: 8,
  },
  trendText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
    minWidth: 40,
    textAlign: 'right',
  },
});
