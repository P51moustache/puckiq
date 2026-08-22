import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { rinkGlass } from '../constants/theme';
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
      <Text style={styles.kicker}>MY WEEK · FREE · NO PAYWALL</Text>
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
    marginHorizontal: 16,
    marginBottom: 16,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: rinkGlass.textMuted,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: rinkGlass.glass,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  dayToday: {
    borderColor: rinkGlass.blueLight,
  },
  abbrev: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: rinkGlass.textSecondary,
  },
  abbrevToday: {
    color: rinkGlass.blueLight,
  },
  count: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '800',
    color: rinkGlass.textPrimary,
  },
  countToday: {
    color: rinkGlass.blueLight,
  },
});
