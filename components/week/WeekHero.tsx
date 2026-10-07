/**
 * The Week hero: a carbon panel with the week's headline number, counting to its new
 * value. Pro sees games that count after lineup limits; free sees games left and the
 * lock that sells the rest.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WeekPlan } from '../../services/fantasy/weekPlan';
import { weekRangeLabel } from '../../services/nhl/dates';
import { ShareButton } from '../share/ShareCards';
import { colors, DarkCard, display, StatCell } from '../coach/ui';
import { CountUp } from '../coach/motion';
import type { WeekChoice } from './types';

export interface WeekHeroProps {
  plan: WeekPlan;
  choice: WeekChoice;
  monday: string;
  isPremium: boolean;
  /** League minimum goalie starts; 0 hides the goalie line. */
  minGoalieStarts: number;
  /** Null hides the share button (nothing to share). */
  onShare: (() => void) | null;
  /** Free: opens the paywall from the lineup-math lock. */
  onUnlock: () => void;
}

export function WeekHero({ plan, choice, monday, isPremium, minGoalieStarts, onShare, onUnlock }: WeekHeroProps) {
  const totals = choice === 'this' ? plan.remaining : plan.week;
  const offNights = plan.days.filter((day) => day.offNight).length;
  return (
    <DarkCard texture style={styles.summary} testID="week-summary">
      <View style={styles.kickerRow}>
        <View style={styles.kickerDot} />
        <Text style={styles.kicker}>{weekRangeLabel(monday).toUpperCase()}</Text>
        {onShare ? <View style={styles.kickerSpacer} /> : null}
        {onShare ? <ShareButton onPress={onShare} testID="week-share" /> : null}
      </View>
      {isPremium ? (
        <>
          <View style={styles.bigRow}>
            <CountUp value={totals.starts} style={styles.summaryBig} testID="week-big" />
            <Text style={styles.summarySub}>
              {choice === 'this' ? 'games that count\nleft this week' : 'games that count\nnext week'}
            </Text>
          </View>
          <View style={styles.summaryStats}>
            <StatCell dark size={24} value={String(totals.games)} label="Games" />
            <StatCell dark size={24} value={String(totals.benched)} label="Lost to bench" tone={totals.benched > 0 ? 'warn' : 'neutral'} testID="week-benched" />
            <StatCell dark size={24} value={String(totals.emptySlots)} label="Empty slots" tone={totals.emptySlots > 0 ? 'warn' : 'neutral'} testID="week-empty" />
          </View>
          {minGoalieStarts > 0 ? (
            <View style={styles.goalieRow} testID="week-goalie-min">
              <Ionicons
                name={plan.week.goalieStarts >= minGoalieStarts ? 'checkmark-circle' : 'alert-circle'}
                size={16}
                color={plan.week.goalieStarts >= minGoalieStarts ? colors.good : colors.warn}
              />
              <Text style={styles.goalieText}>
                ~{plan.week.goalieStarts.toFixed(1)} expected goalie starts · league minimum {minGoalieStarts}
                {plan.week.goalieStarts < minGoalieStarts ? ' — stream a goalie' : ''}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <>
          <View style={styles.bigRow}>
            <CountUp value={plan.remaining.games} style={styles.summaryBig} testID="week-big" />
            <Text style={styles.summarySub}>
              {choice === 'this' ? `games left this week\n${plan.week.games} total · ${offNights} off-nights` : `games next week\n${offNights} off-nights`}
            </Text>
          </View>
          <Pressable onPress={onUnlock} style={styles.summaryLock} testID="week-planner-locked">
            <Ionicons name="lock-closed" size={13} color={colors.onInk} />
            <Text style={styles.summaryLockText}>How many actually count after lineup limits?</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.onInk} />
          </Pressable>
        </>
      )}
    </DarkCard>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: 14,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kickerSpacer: {
    flex: 1,
  },
  kickerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.onInk,
  },
  bigRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  summaryBig: {
    ...display(72),
    color: colors.onInk,
    lineHeight: 76,
    letterSpacing: -3,
  },
  summarySub: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.onInk,
    paddingBottom: 10,
  },
  summaryStats: {
    flexDirection: 'row',
  },
  goalieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalieText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.onInkSub,
  },
  summaryLock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inkRaised,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryLockText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: colors.onInk,
  },
});
