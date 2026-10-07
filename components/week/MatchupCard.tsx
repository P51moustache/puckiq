/**
 * The carbon matchup card: my games that count vs my opponent's, the edge, and a
 * day-by-day strip of starters. A League Room opponent is labelled as synced and has
 * no Edit — the room owns that roster.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { MatchupSummary } from '../../services/fantasy/matchup';
import { formatValue } from '../../services/fantasy/scoring';
import type { WeekPlan } from '../../services/fantasy/weekPlan';
import { ART, ART_ASPECT } from '../../constants/art';
import { colors, DarkCard, display, Pill } from '../coach/ui';
import { CountUp } from '../coach/motion';

/** "+3", "0", "-2": the start edge always shows its sign when ahead. */
export function formatEdge(edge: number): string {
  const rounded = Math.round(edge);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

export interface MatchupCardProps {
  opponentName: string;
  /** The opponent comes from the League Room: say so and hide Edit. */
  synced: boolean;
  plan: WeekPlan;
  opponentPlan: WeekPlan;
  matchup: MatchupSummary;
  onEdit: () => void;
}

export function MatchupCard({ opponentName, synced, plan, opponentPlan, matchup, onEdit }: MatchupCardProps) {
  return (
    <DarkCard testID="matchup-card">
      <View style={styles.matchupHead}>
        {matchup.verdict === 'ahead' ? (
          <Image source={ART.trophy} style={styles.matchupTrophy} contentFit="contain" accessible={false} testID="matchup-trophy" />
        ) : null}
        <Pill
          label={matchup.verdict === 'ahead' ? 'AHEAD' : matchup.verdict === 'behind' ? 'BEHIND' : 'EVEN'}
          tone={matchup.verdict === 'ahead' ? 'good' : matchup.verdict === 'behind' ? 'bad' : 'muted'}
          solid
        />
        <Text style={styles.matchupTitle} numberOfLines={2} testID="matchup-title">
          vs {opponentName || 'Opponent'}
          {synced ? <Text style={styles.matchupSource}> · synced from League Room</Text> : null}
        </Text>
        {synced ? null : (
          <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit opponent" testID="matchup-edit">
            <Text style={styles.edit}>Edit</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.matchupStats}>
        <View style={styles.matchupCol}>
          <Text style={styles.matchupLabel}>YOU</Text>
          <CountUp value={matchup.mine.starts} style={styles.matchupValue} testID="matchup-mine" />
          <Text style={styles.matchupSub}>{formatValue(matchup.mine.value)} proj</Text>
        </View>
        <View style={[styles.matchupCol, styles.alignCenter]}>
          <CountUp
            value={matchup.startEdge}
            format={formatEdge}
            style={[styles.matchupEdge, { color: matchup.startEdge >= 0 ? colors.good : colors.accent }]}
            testID="matchup-edge"
          />
          <Text style={styles.matchupLabel}>GAMES THAT COUNT</Text>
        </View>
        <View style={[styles.matchupCol, styles.alignEnd]}>
          <Text style={styles.matchupLabel}>THEM</Text>
          <CountUp value={matchup.theirs.starts} style={styles.matchupValue} testID="matchup-theirs" />
          <Text style={styles.matchupSub}>{formatValue(matchup.theirs.value)} proj</Text>
        </View>
      </View>
      <View style={styles.dayCompare}>
        {plan.days.map((day, index) => {
          const theirs = opponentPlan.days[index];
          return (
            <View key={day.date} style={[styles.compareCell, day.isPast && styles.pastCell]}>
              <Text style={styles.compareHead}>{day.dayAbbrev.slice(0, 2)}</Text>
              <Text style={[styles.compareMine, day.starters.length > theirs.starters.length && styles.goodText]}>{day.starters.length}</Text>
              <Text style={styles.compareTheirs}>{theirs.starters.length}</Text>
            </View>
          );
        })}
      </View>
    </DarkCard>
  );
}

const styles = StyleSheet.create({
  matchupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchupTrophy: {
    height: 30,
    width: 30 * ART_ASPECT.trophy,
  },
  matchupTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.onInk,
  },
  matchupSource: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onInkSub,
  },
  edit: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.accent,
  },
  matchupStats: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 16,
  },
  matchupCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  alignCenter: {
    alignItems: 'center',
  },
  matchupLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    color: colors.onInkSub,
  },
  matchupValue: {
    ...display(44),
    color: colors.onInk,
  },
  matchupSub: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onInkSub,
  },
  matchupEdge: {
    ...display(32),
  },
  dayCompare: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 4,
  },
  compareCell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.inkRaised,
    borderRadius: 10,
    paddingVertical: 8,
    gap: 2,
  },
  pastCell: {
    opacity: 0.35,
  },
  compareHead: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: colors.onInkSub,
  },
  compareMine: {
    ...display(16),
    color: colors.onInk,
  },
  compareTheirs: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onInkSub,
  },
  goodText: {
    color: colors.good,
  },
});
