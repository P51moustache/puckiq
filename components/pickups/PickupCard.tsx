import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PickupRow } from '../../services/fantasy/pickups';
import { formatValue } from '../../services/fantasy/scoring';
import { positionLabel } from '../../services/fantasy/positions';
import { PlayerAvatar } from '../coach/PlayerAvatar';
import { Card, ColdBadge, colors, display, HotBadge, Pill, layout } from '../coach/ui';

export function PickupCard({ row, onPress, onAdd, grid = false }: { row: PickupRow; onPress: () => void; onAdd: () => void; grid?: boolean }) {
  const rate = row.form.recentRate ?? row.form.seasonRate;
  return (
    <Card onPress={onPress} style={[styles.card, grid && styles.cardGrid]} testID={`pickup-${row.playerId}`}>
      <View style={styles.row}>
        <PlayerAvatar playerId={row.playerId} team={row.team} position={row.position} size={40} />
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
          <Text style={styles.meta}>
            {positionLabel({ position: row.position })} · {row.team} · {formatValue(rate)}/{row.form.isGoalie ? 'start' : 'gm'}
            {row.form.recentRate !== null ? ' L14' : ''}
          </Text>
        </View>
        <View style={styles.gain}>
          <Text style={styles.gainValue}>+{formatValue(row.gain)}</Text>
          <Text style={styles.gainLabel}>Value added</Text>
        </View>
      </View>
      <View style={styles.days}>
        {row.days.map((day) => (
          <View
            key={day.date}
            style={[
              styles.day,
              day.usable && styles.dayUsable,
              day.fillsEmpty && styles.dayFills,
            ]}
          >
            <Text style={[styles.dayAbbrev, day.usable && styles.dayOnDark]}>{day.dayAbbrev.slice(0, 2)}{day.offNight ? ' ·' : ''}</Text>
            <Text style={[styles.dayOpp, day.usable && styles.dayOnDark]}>{day.isHome ? '' : '@'}{day.opponent}</Text>
          </View>
        ))}
        <Pressable
          onPress={onAdd}
          style={({ pressed }) => [styles.addButton, pressed && styles.addPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Add ${row.name} to my team`}
          hitSlop={6}
          testID={`pickup-add-${row.playerId}`}
        >
          <Ionicons name="add" size={22} color={colors.onInk} />
        </Pressable>
      </View>
      <View style={styles.tags}>
        {row.emptyFills > 0 ? <Pill label={`FILLS ${row.emptyFills} EMPTY`} tone="good" /> : null}
        {row.usableGames > row.emptyFills ? <Pill label={`UPGRADES ${row.usableGames - row.emptyFills}`} tone="ink" /> : null}
        {row.offNightGames > 0 ? <Pill label={`${row.offNightGames} OFF-NIGHT`} tone="neutral" /> : null}
        {row.form.trend === 'hot' ? <HotBadge /> : row.form.trend === 'cold' ? (
          <ColdBadge />
        ) : null}
        {row.form.isGoalie ? <Pill label={`${Math.round(row.form.startShare * 100)}% GS`} tone="muted" /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    padding: layout.pageInset,
  },
  cardGrid: {
    flex: 1,
    // Capped so a lone last card doesn't stretch across both columns; the 1.4% left over is the gutter.
    maxWidth: '49.3%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.sub,
  },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  gain: {
    alignItems: 'flex-end',
  },
  gainValue: {
    ...display(22),
    color: colors.good,
  },
  gainLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
  },
  days: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
  },
  day: {
    minWidth: 40,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.bg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayUsable: {
    backgroundColor: colors.ink,
  },
  dayFills: {
    borderColor: colors.good,
  },
  dayAbbrev: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.muted,
    letterSpacing: 0.6,
  },
  dayOpp: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.muted,
  },
  dayOnDark: {
    color: colors.onInk,
  },
  addButton: {
    marginLeft: 'auto',
    width: layout.tapTarget,
    height: layout.tapTarget,
    borderRadius: layout.cardRadius,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPressed: {
    opacity: 0.8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },

});
