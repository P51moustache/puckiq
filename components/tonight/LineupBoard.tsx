/** Tonight's saved starters, using the same compact rows as the optimizer. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FantasyPlayer } from '../../types/fantasy';
import type { DayPlan, PlayerGameDay } from '../../services/fantasy/weekPlan';
import type { NightScore } from '../../services/fantasy/nightScore';
import { formatValue } from '../../services/fantasy/scoring';
import { tileLineText } from '../../services/fantasy/nightTallies';
import type { GameLine } from '../../services/nhl/gamecenter';
import { PlayerValueRow } from '../coach/PlayerValueRow';
import { colors, DarkCard, layout } from '../coach/ui';

export function LineupBoard({ day, byId, games, score, lines, values, onOpenPlayer }: {
  day: DayPlan;
  byId: Map<number, FantasyPlayer>;
  games: Record<number, PlayerGameDay | undefined>;
  score: NightScore | null;
  lines: Map<number, GameLine> | null;
  values: ReadonlyMap<number, number>;
  onOpenPlayer: (playerId: number) => void;
}) {
  const live = !!score && score.phase !== 'pre';
  const points = new Map((score?.players ?? []).map((row) => [row.playerId, row]));
  return <DarkCard style={styles.board} testID="tonight-lineup">
    <View style={styles.columns}><Text style={styles.meta}>POS / PLAYER</Text>
      <Text style={styles.meta}>{live ? lines ? 'LIVE STATS' : 'LIVE PTS' : 'EST. VALUE'}</Text></View>
    {day.starters.map(({ playerId: id, slot }) => {
      const player = byId.get(id); if (!player) return null;
      const game = games[id]; const night = points.get(id); const line = lines?.get(id);
      const scored = live && night && night.state !== 'upcoming';
      const value = scored ? lines ? line ? tileLineText(line) : '—'
        : night.points === null ? '—' : formatValue(night.points)
        : values.has(id) ? `${live ? '~' : ''}${formatValue(values.get(id)!)}` : '—';
      return <PlayerValueRow key={id} player={player} slot={slot}
        meta={`${player.teamAbbrev}${game ? ` · ${game.isHome ? 'vs' : '@'} ${game.opponent}` : ''}`}
        value={value} valueColor={night?.bigNight ? colors.elite : colors.text}
        valueTestID={scored ? `lineup-points-${id}` : undefined}
        onOpen={() => onOpenPlayer(id)} />;
    })}
    {day.empty.map((slot, index) => <View style={styles.empty} key={`${slot}-${index}`}>
      <Text style={styles.slot}>{slot}</Text><Text style={styles.meta}>Open slot · no eligible player</Text>
    </View>)}
    {day.bench.length ? <View style={styles.bench}>
      <Text style={styles.meta}>Playing · bench{live && !lines && score && score.benchPoints > 0 ? ` · ${formatValue(score.benchPoints)} pts unused` : ''}</Text>
      <Text style={styles.benchNames}>{day.bench.map((id) => byId.get(id)?.playerName).filter(Boolean).join(' · ')}</Text>
    </View> : null}
  </DarkCard>;
}
const styles = StyleSheet.create({
  board: { paddingHorizontal: 8, paddingVertical: 2 },
  columns: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  meta: { fontSize: 11, color: colors.sub },
  empty: { flexDirection: 'row', alignItems: 'center', minHeight: layout.tapTarget, gap: 6 },
  slot: { width: 28, fontSize: 12, color: colors.warn },
  bench: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: 8 },
  benchNames: { fontSize: 13, lineHeight: 18, color: colors.text, marginTop: 4 },
});
