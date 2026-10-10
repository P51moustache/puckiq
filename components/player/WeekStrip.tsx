/**
 * "This week" on the player card: his team's game each day, tinted by how the opponent treats
 * his fantasy night (the same matchup tags as Tonight: green soft, red tough), with the tag
 * written in the cell so it never relies on color alone.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { matchupTagFor, type MatchupTag } from '../../services/fantasy/matchupTag';
import type { PlayerWeekDay } from '../../services/fantasy/playerVerdict';
import type { TeamStrength } from '../../services/nhl/teams';
import { colors, SectionLabel, toneColor } from '../coach/ui';

const DAY_NAMES: Record<string, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};

/** Same light wash a tinted Pill uses (hex alpha ~9%). */
const TINT_ALPHA = '18';

function dayLabel(day: PlayerWeekDay, tag: MatchupTag | null): string {
  const name = DAY_NAMES[day.dayAbbrev] ?? day.dayAbbrev;
  if (!day.game) return `${name}: no game`;
  const parts = [`${name}: ${day.game.isHome ? 'vs' : 'at'} ${day.game.opponent}`];
  if (tag) parts.push(tag.tone === 'good' ? 'soft matchup' : 'tough matchup');
  if (day.offNight) parts.push('off-night');
  return parts.join(', ');
}

export function WeekStrip({
  days,
  strength,
  goalie,
}: {
  days: PlayerWeekDay[];
  /** Opponent strength by team; without it the strip is untinted. */
  strength?: Map<string, TeamStrength>;
  goalie: boolean;
}) {
  return (
    <>
      <SectionLabel title="This week" />
      <View style={styles.weekRow} testID="player-week">
        {days.map((day) => {
          const tag = day.game ? matchupTagFor({ isGoalie: goalie }, strength?.get(day.game.opponent)) : null;
          const tint = tag ? toneColor(tag.tone) : null;
          return (
            <View
              key={day.date}
              style={[styles.weekDay, tint ? { backgroundColor: `${tint}${TINT_ALPHA}` } : null, day.past && styles.weekDayPast]}
              accessible
              accessibilityLabel={dayLabel(day, tag)}
              testID={`player-week-${day.date}`}
            >
              <Text style={[styles.weekAbbrev, day.offNight && styles.offNight]}>{day.dayAbbrev.slice(0, 2)}</Text>
              {day.game ? (
                <Text style={styles.weekOpp}>{day.game.isHome ? '' : '@'}{day.game.opponent}</Text>
              ) : (
                <Text style={styles.weekNone}>—</Text>
              )}
              {tag && tint ? <Text style={[styles.weekTag, { color: tint }]} numberOfLines={1}>{tag.label}</Text> : null}
            </View>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  weekRow: {
    flexDirection: 'row',
    gap: 4,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.card,
    gap: 3,
  },
  weekDayPast: {
    opacity: 0.45,
  },
  weekAbbrev: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 0.8,
  },
  offNight: {
    color: colors.accent,
  },
  weekOpp: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  weekNone: {
    fontSize: 11,
    color: colors.muted,
  },
  weekTag: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
