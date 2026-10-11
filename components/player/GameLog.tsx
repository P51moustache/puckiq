/**
 * His recent games on the player card: a bar chart of fantasy value per game and the game log.
 * Free sees the last 5 games; Pro sees 10 bars and the whole season's log, as the paywall promises.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ScoringWeights } from '../../types/fantasy';
import { gameLogValueNote } from '../../services/fantasy/logValue';
import { formatValue } from '../../services/fantasy/scoring';
import { shortDate } from '../../services/nhl/dates';
import type { GameLogRow } from '../../services/nhl/player';
import { Card, colors, SectionLabel } from '../coach/ui';
import { logRowValue } from './logValue';
import { sectionStyles } from './styles';

/** Games a free user sees in the chart and the log. */
export const FREE_LOG_ROWS = 5;
/** Bars Pro sees in the recent-games chart. */
const PRO_CHART_ROWS = 10;
/** Tallest bar, in points. */
const BAR_MAX_HEIGHT = 96;
/** Shortest bar, so a zero still reads as a game. */
const BAR_MIN_HEIGHT = 4;

/** "Last 5 games" bars, oldest on the left, in his team's color. Hidden with no games. */
export function RecentGamesChart({
  log,
  goalie,
  scoring,
  isPro,
  color,
}: {
  /** Newest first. */
  log: GameLogRow[];
  goalie: boolean;
  scoring: ScoringWeights;
  isPro: boolean;
  color: string;
}) {
  const rows = log.slice(0, isPro ? PRO_CHART_ROWS : FREE_LOG_ROWS).reverse();
  if (rows.length === 0) return null;
  const values = rows.map((row) => logRowValue(row, goalie, scoring));
  const max = Math.max(1, ...values);
  return (
    <>
      <SectionLabel title={`Last ${rows.length} games`} right={<Text style={sectionStyles.value}>fantasy value</Text>} />
      <Card>
        <View style={styles.bars}>
          {rows.map((row, index) => {
            const value = values[index];
            const height = Math.max(BAR_MIN_HEIGHT, (Math.max(0, value) / max) * BAR_MAX_HEIGHT);
            return (
              <View key={row.gameId || row.date} style={styles.barCol}>
                <Text style={styles.barValue}>{formatValue(value)}</Text>
                <View style={[styles.bar, { height, backgroundColor: value > 0 ? color : colors.raised }]} />
                <Text style={styles.barLabel}>{row.opponent}</Text>
              </View>
            );
          })}
        </View>
      </Card>
    </>
  );
}

function LogRow({ row, goalie, value }: { row: GameLogRow; goalie: boolean; value: number }) {
  return (
    <View style={styles.logRow}>
      <Text style={[styles.logCell, styles.logDate]}>{shortDate(row.date)}</Text>
      <Text style={[styles.logCell, styles.logOpp]}>{row.isHome ? 'vs' : '@'} {row.opponent}</Text>
      {goalie ? (
        <>
          <Text style={styles.logCell}>{row.decision ?? (row.started ? 'ND' : '—')}</Text>
          <Text style={styles.logCell}>{row.shotsAgainst}</Text>
          <Text style={styles.logCell}>{row.goalsAgainst}</Text>
        </>
      ) : (
        <>
          <Text style={styles.logCell}>{row.goals}</Text>
          <Text style={styles.logCell}>{row.assists}</Text>
          <Text style={styles.logCell}>{row.shots}</Text>
        </>
      )}
      <Text style={[styles.logCell, styles.logFp]}>{formatValue(value)}</Text>
    </View>
  );
}

/** The game log table; free users get the last 5 rows and a link to the rest with Pro. */
export function GameLog({
  log,
  goalie,
  scoring,
  isPro,
  seasonLabel,
  onUnlock,
}: {
  /** Newest first. */
  log: GameLogRow[];
  goalie: boolean;
  scoring: ScoringWeights;
  isPro: boolean;
  /** "2025-26" when the log is last season's (before he plays this season). */
  seasonLabel: string | null;
  onUnlock: () => void;
}) {
  const visible = isPro ? log : log.slice(0, FREE_LOG_ROWS);
  const valueNote = gameLogValueNote(goalie, scoring);
  return (
    <>
      <SectionLabel title={seasonLabel ? `Game log · ${seasonLabel}` : 'Game log'} />
      <Card style={styles.logCard}>
        <View style={[styles.logRow, styles.logHeader]}>
          <Text style={[styles.logHead, styles.logDate]}>DATE</Text>
          <Text style={[styles.logHead, styles.logOpp]}>OPP</Text>
          {goalie ? (
            <>
              <Text style={styles.logHead}>DEC</Text>
              <Text style={styles.logHead}>SA</Text>
              <Text style={styles.logHead}>GA</Text>
            </>
          ) : (
            <>
              <Text style={styles.logHead}>G</Text>
              <Text style={styles.logHead}>A</Text>
              <Text style={styles.logHead}>SOG</Text>
            </>
          )}
          <Text style={[styles.logHead, styles.logFp]}>VAL</Text>
        </View>
        {visible.length === 0 ? <Text style={[sectionStyles.muted, styles.logEmpty]}>No games logged.</Text> : null}
        {visible.map((row) => (
          <LogRow key={row.gameId || row.date} row={row} goalie={goalie} value={logRowValue(row, goalie, scoring)} />
        ))}
      </Card>
      {valueNote ? <Text style={[sectionStyles.muted, { fontSize: 10, marginTop: 8 }]}>{valueNote}</Text> : null}
      {!isPro && log.length > FREE_LOG_ROWS ? (
        <Pressable onPress={onUnlock} style={styles.moreLog}>
          <Text style={styles.moreLogText}>See all {log.length} games with Pro</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 140,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  bar: {
    width: '100%',
    borderRadius: 6,
  },
  barValue: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.text,
  },
  barLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.muted,
  },
  logCard: {
    paddingVertical: 6,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  logHeader: {
    paddingTop: 4,
  },
  logHead: {
    flex: 1,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.muted,
    textAlign: 'center',
  },
  logCell: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  logDate: {
    flex: 1.4,
    textAlign: 'left',
  },
  logOpp: {
    flex: 1.4,
    textAlign: 'left',
  },
  logFp: {
    color: colors.text,
    fontWeight: '900',
  },
  logEmpty: {
    paddingVertical: 12,
  },
  moreLog: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  moreLogText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
