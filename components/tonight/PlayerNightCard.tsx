/**
 * One of my players tonight: who he faces, his status, and — once his game starts — his
 * fantasy points, box-score line and game clock. Big nights get the F1 purple.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FantasyPlayer, SlotKey } from '../../types/fantasy';
import type { PlayerForm } from '../../services/fantasy/form';
import type { PlayerStatus } from '../../services/fantasy/coach';
import type { PlayerGameDay } from '../../services/fantasy/weekPlan';
import type { GameLine } from '../../services/nhl/gamecenter';
import { isGameFinal, isGameStarted, type NhlGame } from '../../services/nhl/schedule';
import { BIG_NIGHT_LABEL, gameClockText, lineText, type PlayerNight } from '../../services/fantasy/nightScore';
import { positionLabel } from '../../services/fantasy/positions';
import { formatValue } from '../../services/fantasy/scoring';
import { formatPuckDrop } from '../../services/nhl/dates';
import { PlayerAvatar, PlayerName, TeamChip } from '../coach/PlayerAvatar';
import { Card, ColdBadge, colors, display, HotBadge, Pill } from '../coach/ui';

export interface MatchupTag {
  label: string;
  tone: 'good' | 'bad';
}

/** Skaters care how many goals the opponent allows; goalies care how many it scores. */
export function matchupTagFor(
  form: PlayerForm | undefined,
  opponent: { offenseRank: number; matchupRank: number } | undefined,
): MatchupTag | null {
  if (!opponent) return null;
  if (form?.isGoalie) {
    if (opponent.offenseRank <= 8) return { label: 'TOUGH O', tone: 'bad' };
    return opponent.offenseRank >= 25 ? { label: 'WEAK O', tone: 'good' } : null;
  }
  if (opponent.matchupRank <= 8) return { label: 'SOFT D', tone: 'good' };
  return opponent.matchupRank >= 25 ? { label: 'TOUGH D', tone: 'bad' } : null;
}

export function PlayerNightCard({
  player,
  game,
  fullGame,
  status,
  line,
  form,
  night,
  slot,
  matchupTag,
  isPro,
  onPress,
}: {
  player: FantasyPlayer;
  game: PlayerGameDay;
  fullGame: NhlGame | undefined;
  status: PlayerStatus | undefined;
  line: GameLine | undefined;
  form: PlayerForm | undefined;
  night: PlayerNight | undefined;
  slot: SlotKey | undefined;
  matchupTag: MatchupTag | null;
  isPro: boolean;
  onPress: () => void;
}) {
  const current = fullGame ?? game;
  const started = isGameStarted(current);
  const final = isGameFinal(current);
  const scratched = status?.signal === 'scratch' && status.confidence === 'confirmed';
  const points = night?.points ?? null;
  const benched = isPro && night?.role === 'bench' && started;
  const bigNight = night?.bigNight ?? null;
  return (
    <Card onPress={onPress} style={[styles.card, bigNight && styles.cardBig]} testID={`tonight-player-${player.playerId}`}>
      <View style={styles.row}>
        <PlayerAvatar playerId={player.playerId} team={player.teamAbbrev} position={player.position} size={56} />
        <View style={styles.text}>
          <PlayerName name={player.playerName} size={17} style={scratched ? styles.struck : undefined} />
          <View style={styles.meta}>
            <Text style={styles.position}>{positionLabel(player)}</Text>
            <TeamChip team={game.opponent} prefix={game.isHome ? 'vs' : '@'} />
            {matchupTag && !started ? <Pill label={matchupTag.label} tone={matchupTag.tone} /> : null}
          </View>
        </View>
        <View style={styles.right}>
          {points !== null ? (
            <Text style={[styles.value, bigNight && styles.valueBig, benched && styles.valueBench]}>{formatValue(points)}</Text>
          ) : started ? (
            <Text style={[styles.clock, !final && styles.live]}>{gameClockText(current)}</Text>
          ) : (
            <Text style={styles.puck}>{formatPuckDrop(game.startTimeUTC)}</Text>
          )}
          {started && points !== null ? (
            <Text style={[styles.clockSmall, !final && styles.live]}>{gameClockText(current)}</Text>
          ) : isPro && slot ? (
            <Text style={styles.slot}>{slot}</Text>
          ) : null}
        </View>
      </View>
      <StatusRow>
        {scratched ? <Pill key="scr" label="SCRATCHED · NHL" tone="bad" solid /> : null}
        {bigNight ? (
          <View key="big" style={styles.bigPill} testID={`big-night-${player.playerId}`}>
            <Text style={styles.bigPillText}>{BIG_NIGHT_LABEL[bigNight]}</Text>
          </View>
        ) : null}
        {benched ? <Pill key="bench" label="NO SLOT · DIDN’T COUNT" tone="warn" /> : null}
        {status && status.confidence === 'likely' && !started ? <Pill key="inj" label={status.signal === 'dtd' ? 'DTD NEWS' : 'INJURY NEWS'} tone="warn" /> : null}
        {!started && form?.isGoalie && !scratched ? <Pill key="gs" label={`STARTER TBD · ${Math.round(form.startShare * 100)}% GS`} tone="muted" /> : null}
        {!started && form && form.trend === 'hot' ? <HotBadge key="hot" /> : null}
        {!started && form && form.trend === 'cold' ? <ColdBadge key="cold" /> : null}
        {line ? (
          <Text key="line" style={styles.line}>{lineText(line)}</Text>
        ) : started && !scratched ? (
          <Text key="none" style={styles.muted}>Not in the box score yet</Text>
        ) : null}
      </StatusRow>
    </Card>
  );
}

function StatusRow({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  if (items.length === 0) return null;
  return <View style={styles.status}>{items}</View>;
}

const styles = StyleSheet.create({
  card: { paddingVertical: 12, paddingHorizontal: 12 },
  cardBig: { borderWidth: 1.5, borderColor: colors.elite },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, gap: 6 },
  struck: { textDecorationLine: 'line-through', color: colors.muted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  position: { fontSize: 13, fontWeight: '700', color: colors.sub },
  right: { alignItems: 'flex-end', gap: 2, minWidth: 56 },
  value: { ...display(26) },
  valueBig: { color: colors.elite },
  valueBench: { color: colors.muted },
  puck: { fontSize: 15, fontWeight: '800', color: colors.text },
  clock: { fontSize: 14, fontWeight: '800', color: colors.sub },
  clockSmall: { fontSize: 11, fontWeight: '800', color: colors.muted },
  live: { color: colors.accent },
  slot: { fontSize: 11, fontWeight: '900', color: colors.accent },
  status: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10, marginLeft: 68 },
  bigPill: { backgroundColor: colors.elite, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  bigPillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6, color: colors.onInk },
  line: { fontSize: 13, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
});
