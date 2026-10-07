/**
 * The Week schedule as an F1 tyre-strategy chart: a stint strip per player across
 * Mon–Sun, off-nights tinted, past days faded, a red "now" line on today, and totals
 * for who plays and (Pro) how many slots go empty each day.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { shortDate } from '../../services/nhl/dates';
import type { DayPlan, WeekPlan } from '../../services/fantasy/weekPlan';
import type { FantasyPlayer } from '../../types/fantasy';
import { Card, colors, display, useWide } from '../coach/ui';
import { DayColumn } from './DayColumn';
import { gridMetrics, PAST_OPACITY, type GridMetrics } from './gridMetrics';
import { StintRow } from './StintRow';
import { dayTotals, nowColumn, stintCells } from './stints';

export interface StintGridProps {
  plan: WeekPlan;
  rows: FantasyPlayer[];
  /** Pro: split games into the ones that count and the ones lost to the bench, and total empty slots. */
  detailed: boolean;
  onOpenPlayer: (playerId: number) => void;
}

export function StintGrid({ plan, rows, detailed, onOpenPlayer }: StintGridProps) {
  const metrics = gridMetrics(useWide());
  const now = nowColumn(plan);
  const strips = useMemo(() => rows.map((player) => stintCells(plan, player.playerId, detailed)), [plan, rows, detailed]);
  const totals = plan.days.map(dayTotals);
  return (
    <Card style={styles.grid} testID="week-grid">
      <View style={styles.row}>
        <View style={{ width: metrics.nameWidth }} />
        {plan.days.map((day) => (
          <DayColumn key={day.date} offNight={day.offNight}>
            <DayBadge day={day} />
          </DayColumn>
        ))}
        <View style={[styles.totalCell, { width: metrics.totalWidth }]}>
          <Text style={styles.dayHead}>GP</Text>
        </View>
      </View>
      {rows.map((player, index) => (
        <StintRow
          key={player.playerId}
          player={player}
          cells={strips[index]}
          summary={plan.players[player.playerId]}
          detailed={detailed}
          metrics={metrics}
          nowColumn={now}
          first={index === 0}
          onPress={onOpenPlayer}
        />
      ))}
      <TotalsRow
        label="PLAYING"
        days={plan.days}
        values={totals.map((day) => day.playing)}
        total={plan.week.games}
        metrics={metrics}
        testID="week-totals-playing"
      />
      {detailed ? (
        <TotalsRow
          label="EMPTY SLOTS"
          days={plan.days}
          values={totals.map((day) => day.empty)}
          total={plan.week.emptySlots}
          warn
          metrics={metrics}
          testID="week-totals-empty"
        />
      ) : null}
    </Card>
  );
}

/** "MO / 12" — carbon pill on today, faded once the day is played. */
function DayBadge({ day }: { day: DayPlan }) {
  const text = [day.isPast && styles.past, day.isToday && styles.todayText];
  return (
    <View style={[styles.dayBadge, day.isToday && styles.todayBadge]} testID={day.isToday ? 'week-today' : undefined}>
      <Text style={[styles.dayHead, ...text]}>{day.dayAbbrev.slice(0, 2)}</Text>
      <Text style={[styles.dayNum, ...text]}>{shortDate(day.date).split(' ')[1]}</Text>
    </View>
  );
}

function TotalsRow({
  label,
  days,
  values,
  total,
  warn = false,
  metrics,
  testID,
}: {
  label: string;
  days: DayPlan[];
  /** Null = no NHL games that day. */
  values: (number | null)[];
  total: number;
  /** Amber for anything above zero (empty slots). */
  warn?: boolean;
  metrics: GridMetrics;
  testID: string;
}) {
  return (
    <View style={[styles.row, styles.footRow]} testID={testID}>
      <View style={[styles.footName, { width: metrics.nameWidth }]}>
        <Text style={styles.footLabel}>{label}</Text>
      </View>
      {days.map((day, index) => {
        const value = values[index];
        return (
          <DayColumn key={day.date} offNight={day.offNight}>
            <Text style={[styles.footValue, warn && !!value && styles.warnText, day.isPast && styles.past]}>{value ?? '–'}</Text>
          </DayColumn>
        );
      })}
      <View style={[styles.totalCell, { width: metrics.totalWidth }]}>
        <Text style={[styles.total, warn && total > 0 && styles.warnText]}>{total}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayBadge: {
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 3,
    // Narrower than a phone column, so the now line beside today's badge never touches it.
    minWidth: 26,
  },
  todayBadge: {
    backgroundColor: colors.ink,
  },
  todayText: {
    color: colors.onInk,
    opacity: 1,
  },
  dayHead: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: colors.muted,
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  past: {
    opacity: PAST_OPACITY,
  },
  totalCell: {
    alignItems: 'center',
  },
  total: {
    ...display(16),
  },
  footRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    minHeight: 34,
  },
  footName: {
    paddingHorizontal: 6,
  },
  footLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.muted,
  },
  footValue: {
    ...display(15),
    color: colors.sub,
  },
  warnText: {
    color: colors.warn,
  },
});
