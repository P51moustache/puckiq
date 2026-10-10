/**
 * The verdict near the top of the player card: a carbon panel with when he plays next, the call
 * in heavy italics, and one or two plain reasons. The call itself comes from
 * services/fantasy/playerVerdict; this only renders it.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PlayerVerdict, VerdictTone } from '../../services/fantasy/playerVerdict';
import { colors, DarkCard, display } from '../coach/ui';

/** Kicker dot: green to start, amber to sit or check; otherwise the app's red kicker dot. */
const DOT_COLOR: Record<VerdictTone, string> = {
  good: colors.good,
  warn: colors.warn,
  bad: colors.accent,
  neutral: colors.accent,
};

function Kicker({ label, tone }: { label: string; tone: VerdictTone }) {
  return (
    <View style={styles.kickerRow}>
      <View style={[styles.dot, { backgroundColor: DOT_COLOR[tone] }]} />
      <Text style={styles.kicker} numberOfLines={1}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function VerdictCard({ verdict, loading }: { verdict: PlayerVerdict | null; loading: boolean }) {
  if (!verdict) {
    if (!loading) return null;
    return (
      <DarkCard style={styles.card} testID="player-verdict-loading">
        <Kicker label="Next game" tone="neutral" />
        <Text style={styles.waiting}>Reading his week…</Text>
      </DarkCard>
    );
  }
  const spoken = [verdict.when, verdict.call, ...verdict.reasons].join('. ');
  return (
    <DarkCard style={styles.card} testID="player-verdict">
      <View accessible accessibilityLabel={spoken} style={styles.content}>
        <Kicker label={verdict.when} tone={verdict.tone} />
        <Text style={styles.call} testID={`player-verdict-${verdict.kind}`}>{verdict.call}</Text>
        {verdict.reasons.map((reason) => (
          <View key={reason} style={styles.reasonRow}>
            <View style={styles.bullet} />
            <Text style={styles.reason}>{reason}</Text>
          </View>
        ))}
      </View>
    </DarkCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
  },
  content: {
    gap: 8,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  kicker: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.onInk,
  },
  call: {
    ...display(28),
    color: colors.onInk,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 1,
    marginTop: 8,
    backgroundColor: colors.onInkSub,
  },
  reason: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.onInkSub,
  },
  waiting: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    color: colors.onInkSub,
  },
});
