import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FantasyPlayer } from '../../types/fantasy';
import type { DayPlan } from '../../services/fantasy/weekPlan';
import { formatValue } from '../../services/fantasy/scoring';
import { PlayerValueRow } from '../coach/PlayerValueRow';
import { colors, Card, SectionLabel } from '../coach/ui';

export function LineupList({
  day,
  players,
  values,
  onOpen,
  onEdit,
  editable,
  planned,
}: {
  day: DayPlan;
  players: FantasyPlayer[];
  values: ReadonlyMap<number, number>;
  onOpen: (id: number) => void;
  onEdit: (id: number, choice: 'start' | 'sit') => void;
  editable: boolean;
  planned: boolean;
}) {
  const byId = new Map(players.map((p) => [p.playerId, p]));
  const row = (id: number, slot: string, bench = false) => {
    const player = byId.get(id);
    if (!player) return null;
    return (
      <PlayerValueRow key={`${slot}-${id}`} testID={`lineup-row-${id}`}
        player={player} slot={slot}
        meta={`${player.teamAbbrev} · ${player.eligible?.join('/') || player.position}`}
        value={values.has(id) ? formatValue(values.get(id)!) : '—'} onOpen={() => onOpen(id)}>
        {planned ? (
          <Pressable
            onPress={() => onEdit(id, bench ? 'start' : 'sit')}
            disabled={!editable}
            style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !editable }}
            accessibilityLabel={`${bench ? 'Start' : 'Bench'} ${player.playerName}`}
            testID={`lineup-${bench ? 'start' : 'sit'}-${id}`}
          >
            <View style={[styles.editLabel, !editable && styles.disabled]}>
              <Text style={[styles.editText, !editable && styles.disabledText]}>
                {bench ? 'Start' : 'Bench'}
              </Text>
            </View>
          </Pressable>
        ) : null}
      </PlayerValueRow>
    );
  };
  return (
    <>
      <View style={styles.columns}>
        <Text style={styles.meta}>POS</Text>
        <Text style={[styles.meta, { flex: 1, marginLeft: 14 }]}>PLAYER</Text>
        <Text style={styles.meta}>EST. VALUE{planned ? ' / ACTION' : ''}</Text>
      </View>
      <Card style={styles.list}>
        {day.starters.map((s) => row(s.playerId, s.slot))}
        {day.empty.map((slot, i) => (
          <View key={`${slot}-${i}`} style={styles.row}>
            <Text style={styles.slot}>{slot}</Text>
            <Text style={styles.empty}>Open slot · no eligible player</Text>
          </View>
        ))}
      </Card>
      {day.bench.length > 0 ? (
        <>
          <SectionLabel title="Playing · bench" />
          <Card style={styles.list}>
            {day.bench.map((id) => row(id, 'BN', true))}
          </Card>
        </>
      ) : null}
    </>
  );
}
const styles = StyleSheet.create({
  columns: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6 },
  list: { paddingHorizontal: 8, paddingVertical: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 4,
  },
  slot: { width: 28, fontSize: 12, fontWeight: '500', color: colors.text },
  meta: { fontSize: 11, color: colors.sub },
  edit: {
    width: 54,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editLabel: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,37,45,0.3)',
    backgroundColor: 'rgba(255,37,45,0.08)',
    paddingVertical: 7,
    width: 52,
    alignItems: 'center',
  },
  editText: { fontSize: 12, fontWeight: '600', color: colors.accent },
  pressed: { backgroundColor: colors.raised },
  disabled: { borderColor: colors.border, backgroundColor: colors.card },
  disabledText: { color: colors.muted },
  empty: { flex: 1, fontSize: 13, color: colors.muted },
});
