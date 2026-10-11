/** A compact, clickable player identity and value row shared by lineup views. */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FantasyPlayer } from '../../types/fantasy';
import { PlayerAvatar } from './PlayerAvatar';
import { colors, layout } from './theme';

export function PlayerValueRow({ player, slot, meta, value, valueColor = colors.text,
  valueTestID, testID, onOpen, children }: {
  player: FantasyPlayer;
  slot: string;
  meta: string;
  value: string;
  valueColor?: string;
  valueTestID?: string;
  testID?: string;
  onOpen: () => void;
  children?: React.ReactNode;
}) {
  return <View style={styles.row} testID={testID}>
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.player, pressed && styles.pressed]}
      accessibilityRole="button" accessibilityLabel={`View ${player.playerName}`}>
      <Text style={styles.slot}>{slot}</Text>
      <PlayerAvatar playerId={player.playerId} team={player.teamAbbrev} position={player.position} size={32} />
      <View style={styles.identity}>
        <Text style={styles.name} numberOfLines={1}>{player.playerName}</Text>
        <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
      </View>
      <Text style={[styles.value, { color: valueColor }]} numberOfLines={2} accessibilityLabel={value} testID={valueTestID}>{value}</Text>
      <Ionicons name="chevron-forward" size={14} color={colors.muted} />
    </Pressable>
    {children}
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: layout.tapTarget,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 4 },
  player: { flex: 1, minHeight: layout.tapTarget, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 6 },
  slot: { width: 28, fontSize: 12, fontWeight: '500', color: colors.text },
  identity: { flex: 1, gap: 1 },
  name: { fontSize: 14, fontWeight: '500', color: colors.text },
  meta: { fontSize: 11, color: colors.sub },
  value: { fontSize: 14, lineHeight: 18, fontVariant: ['tabular-nums'], minWidth: 34, maxWidth: '35%', textAlign: 'right' },
  pressed: { backgroundColor: colors.raised },
});
