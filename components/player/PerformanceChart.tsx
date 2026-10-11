import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GameLogRow } from '../../services/nhl/player';
import type { ScoringWeights } from '../../types/fantasy';
import { performanceMetrics } from '../../services/fantasy/performance';
import { gameLogValueNote } from '../../services/fantasy/logValue';
import { barScale } from '../../services/charts/barScale';
import { shortDate } from '../../services/nhl/dates';
import { Card, colors } from '../coach/ui';

const CHART_HEIGHT = 64;
const PLOT_TOP = 12;
export function PerformanceChart({
  log,
  goalie,
  scoring,
  isPro,
  seasonLabel,
}: {
  log: GameLogRow[];
  goalie: boolean;
  scoring: ScoringWeights;
  isPro: boolean;
  seasonLabel?: string | null;
}) {
  const metrics = performanceMetrics(goalie, scoring);
  const [metricId, setMetricId] = useState(goalie ? 'saves' : 'points');
  const [selectedGame, setSelectedGame] = useState<number | null>(null);
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0];
  const rows = log.slice(0, isPro ? 10 : 5).reverse();
  const selectedIndex = rows.findIndex((row) => row.gameId === selectedGame);
  const selected = selectedIndex >= 0 ? selectedIndex : null;
  const series = rows.map(metric.value);
  const scale = barScale(series, CHART_HEIGHT);
  const valueNote =
    metricId === 'value' ? gameLogValueNote(goalie, scoring) : null;
  const formatted = (value: number | null) =>
    value === null
      ? '—'
      : metricId === 'savePct'
        ? value.toFixed(3).replace(/^0/, '')
        : Number.isInteger(value)
          ? String(value)
          : value.toFixed(1);
  return (
    <View testID="player-performance">
      <View style={styles.heading}>
        <Text style={styles.title}>Recent performance</Text>
        <ScrollView
          horizontal
          style={styles.metricStrip}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {metrics.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => {
                setMetricId(m.id);
                setSelectedGame(null);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ selected: m.id === metricId }}
              testID={`performance-${m.id}`}
              style={[styles.filter, m.id === metricId && styles.active]}
            >
              <Text style={styles.filterText}>{m.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <Card style={styles.card}>
        {rows.length === 0 ? (
          <Text style={styles.empty}>No games logged yet.</Text>
        ) : (
          <>
            <View style={styles.plot}>
              <View style={styles.axis}>
                {scale.ticks.map((value, index) => (
                  <Text
                    key={index}
                    style={[
                      styles.tick,
                      { top: PLOT_TOP + scale.y(value) - 5 },
                    ]}
                  >
                    {formatted(value)}
                  </Text>
                ))}
              </View>
              <View style={styles.bars}>
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  {scale.ticks.map((value, index) => (
                    <View
                      key={index}
                      style={[
                        styles.gridLine,
                        { top: PLOT_TOP + scale.y(value) },
                      ]}
                    />
                  ))}
                </View>
                {rows.map((row, index) => {
                  const geometry = scale.bar(series[index]);
                  return (
                    <Pressable
                      key={row.gameId || row.date}
                      onPress={() => setSelectedGame(row.gameId)}
                      accessibilityRole="button"
                      accessibilityLabel={`${shortDate(row.date)}, ${row.opponent}, ${formatted(series[index])} ${metric.label}`}
                      testID={`performance-bar-${index}`}
                      style={styles.column}
                    >
                      {selected === index ? (
                        <Text
                          style={[
                            styles.barValue,
                            { top: Math.max(0, PLOT_TOP + geometry.top - 14) },
                          ]}
                        >
                          {formatted(series[index])}
                        </Text>
                      ) : null}
                      <View
                        style={[
                          styles.bar,
                          {
                            top: PLOT_TOP + geometry.top,
                            height: Math.max(2, geometry.height),
                            backgroundColor:
                              series[index] === null
                                ? colors.track
                                : (series[index] ?? 0) < 0
                                  ? colors.warn
                                  : colors.accent,
                            opacity:
                              selected === null || selected === index
                                ? 1
                                : 0.45,
                          },
                        ]}
                      />
                      <Text style={styles.date}>
                        {index % 2 === 0 ? shortDate(row.date) : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Text style={styles.note}>
              {selected === null
                ? `${seasonLabel ? `${seasonLabel} · ` : ''}Last ${rows.length} games · Tap a bar for details.`
                : `${shortDate(rows[selected].date)} ${rows[selected].isHome ? 'vs' : '@'} ${rows[selected].opponent} · ${formatted(series[selected])} ${metric.label}`}
              {series.some((value) => value !== null && value < 0)
                ? ' · Amber bars are below zero.'
                : ''}
              {series.some((value) => value === null)
                ? ' · — means no shots faced.'
                : ''}
            </Text>
            {valueNote ? <Text style={styles.note}>{valueNote}</Text> : null}
          </>
        )}
      </Card>
    </View>
  );
}
const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 3,
    gap: 8,
  },
  title: { fontSize: 13, fontWeight: '600', color: colors.text },
  metricStrip: { flex: 1 },
  filters: { gap: 3 },
  filter: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  active: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { fontSize: 11, color: colors.text },
  card: {
    padding: 4,
    borderWidth: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
  },
  plot: { flexDirection: 'row', height: 96 },
  axis: { width: 22 },
  tick: { position: 'absolute', fontSize: 10, color: colors.muted },
  bars: { flex: 1, flexDirection: 'row', gap: 6 },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
  },
  column: { flex: 1, alignItems: 'center', height: 96 },
  bar: {
    position: 'absolute',
    width: '68%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  barValue: { position: 'absolute', fontSize: 10, color: colors.text },
  date: {
    position: 'absolute',
    bottom: 0,
    fontSize: 9,
    color: colors.muted,
    height: 14,
  },
  note: { fontSize: 10, color: colors.muted, marginTop: 2 },
  empty: { color: colors.sub, fontSize: 14 },
});
