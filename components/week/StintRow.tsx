/**
 * One player's line in the stint chart: team tile and name, a bar per game day,
 * and his games for the week. Tapping it opens the player sheet.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { positionLabel } from '../../services/fantasy/positions';
import type { PlayerWeek } from '../../services/fantasy/weekPlan';
import type { FantasyPlayer } from '../../types/fantasy';
import { PlayerAvatar, PlayerName, splitName } from '../coach/PlayerAvatar';
import { colors, display } from '../coach/ui';
import { DayColumn } from './DayColumn';
import { ROW_MIN_HEIGHT, type GridMetrics } from './gridMetrics';
import { StintBar } from './StintBar';
import { rowAccessibilityLabel, type StintCell } from './stints';

export interface StintRowProps {
  player: FantasyPlayer;
  cells: StintCell[];
  summary: PlayerWeek | undefined;
  /** Pro: the a11y label says how many games count. */
  detailed: boolean;
  metrics: GridMetrics;
  /** Column that carries the now line, or null. */
  nowColumn: number | null;
  /** First player row: the now line starts here, with its dot. */
  first: boolean;
  onPress: (playerId: number) => void;
}

export const StintRow = React.memo(function StintRow({ player, cells, summary, detailed, metrics, nowColumn, first, onPress }: StintRowProps) {
  return (
    <Pressable
      onPress={() => onPress(player.playerId)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={rowAccessibilityLabel(player.playerName, summary, detailed)}
      testID={`week-row-${player.playerId}`}
    >
      <View style={[styles.name, { width: metrics.nameWidth }]}>
        <PlayerAvatar playerId={player.playerId} team={player.teamAbbrev} position={player.position} size={metrics.avatarSize} />
        <View style={styles.nameText}>
          {metrics.long ? (
            <PlayerName name={player.playerName} size={14} />
          ) : (
            <Text style={styles.lastName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {splitName(player.playerName).last.toUpperCase()}
            </Text>
          )}
          <Text style={styles.pos}>{positionLabel(player)} · {player.teamAbbrev}</Text>
        </View>
      </View>
      {cells.map((cell, index) => (
        <DayColumn
          key={cell.date}
          offNight={cell.offNight}
          now={index === nowColumn}
          cap={first}
          testID={`week-cell-${player.playerId}-${cell.date}`}
        >
          <StintBar cell={cell} team={player.teamAbbrev} metrics={metrics} hatchId={`hatch-${player.playerId}-${cell.date}`} />
        </DayColumn>
      ))}
      <View style={[styles.total, { width: metrics.totalWidth }]}>
        <Text style={styles.totalText}>{summary?.games ?? 0}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ROW_MIN_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
  },
  name: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  nameText: {
    flex: 1,
  },
  lastName: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
  },
  pos: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    marginTop: 1,
  },
  total: {
    alignItems: 'center',
  },
  totalText: {
    ...display(16),
  },
});
