/**
 * Tonight's best lineup as a carbon board of team-colour tiles, slot by slot (Pro). Once games
 * start, each tile carries its live points, like an F1 timing tower's gaps.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FantasyPlayer, SlotKey } from '../../types/fantasy';
import { SLOT_ORDER } from '../../services/fantasy/positions';
import type { DayPlan, PlayerGameDay } from '../../services/fantasy/weekPlan';
import type { NightScore } from '../../services/fantasy/nightScore';
import { formatValue } from '../../services/fantasy/scoring';
import { PlayerAvatar } from '../coach/PlayerAvatar';
import { colors, DarkCard, display } from '../coach/ui';
import { lastNameOf } from './nightText';

interface Row {
  slot: SlotKey;
  seats: number[];
  empty: number;
}

export function lineupRows(day: DayPlan): Row[] {
  return SLOT_ORDER.map((slot) => ({
    slot,
    seats: day.starters.filter((seat) => seat.slot === slot).map((seat) => seat.playerId),
    empty: day.empty.filter((value) => value === slot).length,
  })).filter((row) => row.seats.length + row.empty > 0);
}

export function LineupBoard({
  day,
  byId,
  games,
  score,
  onOpenPlayer,
}: {
  day: DayPlan;
  byId: Map<number, FantasyPlayer>;
  games: Record<number, PlayerGameDay | undefined>;
  score: NightScore | null;
  onOpenPlayer: (playerId: number) => void;
}) {
  const live = !!score && score.phase !== 'pre';
  const pointsById = new Map((score?.players ?? []).map((row) => [row.playerId, row]));
  return (
    <DarkCard style={styles.board} testID="tonight-lineup">
      {lineupRows(day).map((row) => (
        <View key={row.slot} style={styles.row}>
          <Text style={styles.slot} numberOfLines={1}>{row.slot}</Text>
          <View style={styles.tiles}>
            {row.seats.map((id) => {
              const player = byId.get(id);
              const game = games[id];
              const night = pointsById.get(id);
              return (
                <Pressable key={id} style={styles.tile} onPress={() => onOpenPlayer(id)} accessibilityLabel={player?.playerName}>
                  <PlayerAvatar playerId={id} team={player?.teamAbbrev ?? ''} position={player?.position ?? ''} size={52} />
                  <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {lastNameOf(player?.playerName ?? '').toUpperCase()}
                  </Text>
                  {live && night && night.state !== 'upcoming' ? (
                    <Text style={[styles.points, night.bigNight && styles.pointsBig]} testID={`lineup-points-${id}`}>
                      {night.points === null ? '—' : formatValue(night.points)}
                    </Text>
                  ) : (
                    <Text style={styles.opp}>{game ? `${game.isHome ? 'vs' : '@'} ${game.opponent}` : ''}</Text>
                  )}
                </Pressable>
              );
            })}
            {Array.from({ length: row.empty }, (_, index) => (
              <View key={`empty-${index}`} style={styles.tile}>
                <View style={styles.emptyTile}>
                  <Ionicons name="add" size={18} color={colors.warn} />
                </View>
                <Text style={styles.emptyLabel}>EMPTY</Text>
                <Text style={styles.opp}>no game</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
      {day.bench.length > 0 ? (
        <View style={styles.bench}>
          <Text style={styles.benchLabel}>
            BENCH · PLAYING, NO SLOT{live && score && score.benchPoints > 0 ? ` · ${formatValue(score.benchPoints)} PTS UNUSED` : ''}
          </Text>
          <Text style={styles.benchNames}>{day.bench.map((id) => byId.get(id)?.playerName).filter(Boolean).join(' · ')}</Text>
        </View>
      ) : null}
    </DarkCard>
  );
}

const styles = StyleSheet.create({
  board: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  slot: {
    ...display(15),
    // Wide enough for "UTIL" once display()'s italic bleed padding is counted.
    width: 46,
    color: colors.accent,
    paddingTop: 16,
  },
  tiles: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 12 },
  tile: { width: 60, alignItems: 'center', gap: 4 },
  name: { width: 60, textAlign: 'center', fontSize: 11, fontWeight: '900', color: colors.onInk },
  opp: { fontSize: 10, fontWeight: '700', color: colors.onInkSub },
  points: { ...display(15), color: colors.onInk },
  pointsBig: { color: colors.elite },
  emptyTile: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.warn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLabel: { fontSize: 11, fontWeight: '900', color: colors.warn, textAlign: 'center' },
  bench: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 12 },
  benchLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: colors.onInkSub },
  benchNames: { fontSize: 14, color: colors.onInk, marginTop: 4 },
});
