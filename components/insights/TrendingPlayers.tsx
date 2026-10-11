import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PlayerForm } from '../../services/fantasy/form';
import { formatValue } from '../../services/fantasy/scoring';
import { PlayerAvatar } from '../coach/PlayerAvatar';
import { Card, colors, SectionLabel } from '../coach/ui';

export interface TrendingPlayer {
  id: number;
  name: string;
  team: string;
  position: string;
  form: PlayerForm;
  owned: boolean;
}
export function TrendingPlayers({
  players,
  onOpen,
}: {
  players: TrendingPlayer[];
  onOpen: (row: TrendingPlayer) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = players
    .filter(
      (p) =>
        p.form.recentGp >= 3 &&
        p.form.recentRate !== null &&
        p.form.seasonRate > 0,
    )
    .sort(
      (a, b) =>
        b.form.recentRate! / b.form.seasonRate -
        a.form.recentRate! / a.form.seasonRate,
    )
    .slice(0, expanded ? 12 : 4);
  return (
    <>
      <SectionLabel
        title="Trending players"
        right={
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(!expanded)}
          >
            <Text style={styles.more}>
              {expanded ? 'Show less' : 'See all'}
            </Text>
          </Pressable>
        }
      />
      <Card style={styles.card}>
        {rows.length ? (
          <View style={styles.columns}>
            <Text style={[styles.meta, { flex: 1 }]}>PLAYER</Text>
            <Text style={styles.value}>14D VALUE</Text>
            <Text style={styles.deltaHeading}>Δ BASELINE</Text>
            <View style={{ width: 20 }} />
          </View>
        ) : null}
        {rows.length ? (
          rows.map((row) => {
            const delta =
              (row.form.recentRate! / row.form.seasonRate - 1) * 100;
            return (
              <Pressable
                key={row.id}
                onPress={() => onOpen(row)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`View ${row.name}, recent value ${Math.round(delta)} percent versus season`}
              >
                <PlayerAvatar
                  playerId={row.id}
                  team={row.team}
                  position={row.position}
                  size={32}
                />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={styles.meta}>
                    {row.team} · {row.position}
                  </Text>
                </View>
                <Text style={styles.rate}>
                  {formatValue(row.form.recentRate!)}
                </Text>
                <Text
                  style={[
                    styles.delta,
                    { color: delta >= 0 ? colors.good : colors.warn },
                  ]}
                >
                  {delta >= 0 ? '▲ +' : '▼ '}
                  {Math.round(delta)}%
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={colors.muted}
                />
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.empty}>
            Trends appear after a player has at least three recent games. Early
            in the season, check the schedule and lineup recommendations.
          </Text>
        )}
      </Card>
    </>
  );
}
const styles = StyleSheet.create({
  card: { paddingHorizontal: 8, paddingVertical: 2 },
  columns: { flexDirection: 'row', paddingVertical: 4 },
  value: { width: 55, textAlign: 'right', fontSize: 10, color: colors.sub },
  deltaHeading: {
    width: 68,
    textAlign: 'right',
    fontSize: 10,
    color: colors.sub,
  },
  rate: { width: 42, textAlign: 'right', fontSize: 13, color: colors.text },
  more: { fontSize: 13, color: colors.accent },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { fontSize: 14, fontWeight: '500', color: colors.text },
  meta: { fontSize: 11, color: colors.sub },
  pressed: { backgroundColor: colors.raised },
  delta: {
    width: 62,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  empty: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.sub,
    paddingVertical: 12,
  },
});
