import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { upcomingAssessments } from '../../services/fantasy/playerOutlook';
import { shortDate, weekdayAbbrev } from '../../services/nhl/dates';
import { Card, colors, SectionLabel, LoadingRows } from '../coach/ui';

type Upcoming = ReturnType<typeof upcomingAssessments>;
export function ScheduleAssessment({
  rows,
  loading,
  error,
  goalie,
  limit,
}: {
  rows: Upcoming;
  loading: boolean;
  error?: string | null;
  goalie: boolean;
  /** Overview shows four games; the Schedule tab keeps the full list. */
  limit?: number;
}) {
  const known = rows.filter((r) => r.stars !== null);
  const average = known.length
    ? known.reduce((s, r) => s + (r.stars ?? 0), 0) / known.length
    : null;
  const outlook =
    average === null
      ? 'Awaiting data'
      : average >= 3.7
        ? 'Favorable'
        : average <= 2.3
          ? 'Challenging'
          : 'Balanced';
  return (
    <>
      <SectionLabel title="Upcoming schedule" />
      <Card testID="player-schedule-assessment" style={styles.card}>
        <View style={styles.heading}>
          <Text style={styles.title}>Schedule outlook</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="How schedule ratings work"
            hitSlop={8}
            onPress={() =>
              Alert.alert(
                'Schedule ratings',
                goalie
                  ? 'Opponent scoring strength; stars do not confirm a goalie start.'
                  : 'Stars reflect opponent goals allowed, blended with last season early on.',
              )
            }
          >
            <Text
              style={[
                styles.outlook,
                {
                  color:
                    average === null
                      ? colors.muted
                      : average >= 3.7
                        ? colors.good
                        : average <= 2.3
                          ? colors.warn
                          : colors.sub,
                },
              ]}
            >
              {outlook}
            </Text>
          </Pressable>
        </View>
        {loading && !rows.length ? (
          <LoadingRows count={2} />
        ) : !rows.length ? (
          <Text style={styles.note}>
            {error
              ? 'Schedule unavailable. Pull to refresh.'
              : 'No upcoming regular-season games are published.'}
          </Text>
        ) : (
          (limit ? rows.slice(0, limit) : rows).map((row) => (
            <View
              key={row.game.id}
              style={styles.row}
              accessible
              accessibilityLabel={`${row.game.date}, ${row.isHome ? 'versus' : 'at'} ${row.opponent}, ${row.label}`}
            >
              <Text style={styles.date}>
                {weekdayAbbrev(row.game.date).slice(0, 3)}{' '}
                {shortDate(row.game.date)}
              </Text>
              <Text style={styles.opponent}>
                {row.isHome ? 'vs' : '@'} {row.opponent}
              </Text>
              <Text style={styles.rating}>
                {row.stars === null ? '—' : '★'.repeat(row.stars)}
                <Text style={{ color: colors.track }}>
                  {row.stars === null ? '' : '★'.repeat(5 - row.stars)}
                </Text>
              </Text>
            </View>
          ))
        )}
      </Card>
    </>
  );
}
const styles = StyleSheet.create({
  card: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8 },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: { fontSize: 12, fontWeight: '600', color: colors.text },
  outlook: { fontSize: 11, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    minHeight: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  date: { width: 100, fontSize: 11, color: colors.sub },
  opponent: { flex: 1, fontSize: 12, color: colors.text },
  rating: { fontSize: 13, letterSpacing: 1, color: colors.schedule },
  note: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 7 },
});
