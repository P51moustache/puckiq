import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { barn } from '../constants/barn';
import type { MyWeek } from '../types/fantasy';

export default function MyWeekStrip({
  week,
  today,
}: {
  week: MyWeek | null;
  today: string | null;
}) {
  if (!week || week.days.length === 0) return null;

  return (
    <View style={styles.wrap} testID="my-week-strip">
      <Text style={styles.kicker}>THE WEEK</Text>
      <View style={styles.row}>
        {week.days.map((day) => {
          const isToday = !!today && day.date === today;
          return (
            <View
              key={day.date || day.dayAbbrev}
              style={[styles.day, isToday && styles.dayToday]}
              testID={`my-week-day-${day.date}`}
            >
              <Text style={[styles.abbrev, isToday && styles.abbrevToday]}>{day.dayAbbrev}</Text>
              <Text style={[styles.count, isToday && styles.countToday]}>
                {day.playerCount > 0 ? String(day.playerCount) : '—'}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 0,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    color: barn.ghost,
    marginBottom: 8,
    fontFamily: barn.fonts.mono,
  },
  row: {
    flexDirection: 'row',
    gap: 0,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: barn.rule,
  },
  dayToday: {
    borderBottomWidth: 2,
    borderBottomColor: barn.signal,
  },
  abbrev: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: barn.ghost,
    fontFamily: barn.fonts.mono,
  },
  abbrevToday: {
    color: barn.ink,
  },
  count: {
    marginTop: 2,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '800',
    color: barn.ink,
    fontFamily: barn.fonts.display,
  },
  countToday: {
    color: barn.ink,
  },
});
