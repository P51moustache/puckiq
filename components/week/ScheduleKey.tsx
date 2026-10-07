/**
 * The chart key beside "Schedule", like the compound key on a tyre-strategy graphic:
 * solid = counts, hatched = lost to the bench (Pro), tint = off-night. The ⓘ opens
 * the full "How PuckIQ decides" note instead of a footnote under the grid.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HowItWorksButton } from '../sheets/HowItWorksSheet';
import { colors } from '../coach/ui';
import { OFF_NIGHT_EDGE, OFF_NIGHT_TINT } from './gridMetrics';
import { Hatch } from './StintBar';

export function ScheduleKey({ detailed }: { detailed: boolean }) {
  return (
    <View style={styles.key} testID="week-key">
      {detailed ? (
        <>
          <KeyItem label="COUNTS">
            <View style={[styles.stint, styles.solid]} />
          </KeyItem>
          <KeyItem label="BENCH">
            <View style={[styles.stint, styles.bench]}>
              <Hatch id="week-key-hatch" />
            </View>
          </KeyItem>
        </>
      ) : null}
      <KeyItem label="OFF-NIGHT">
        <View style={styles.offNight} />
      </KeyItem>
      <HowItWorksButton topic="week" />
    </View>
  );
}

function KeyItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.item}>
      {children}
      <Text style={styles.label} maxFontSizeMultiplier={1.3}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  key: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stint: {
    width: 16,
    height: 8,
    borderRadius: 4,
  },
  solid: {
    backgroundColor: colors.ink,
  },
  bench: {
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.warn,
  },
  offNight: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: OFF_NIGHT_TINT,
    borderWidth: 1,
    borderColor: OFF_NIGHT_EDGE,
  },
  label: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: colors.sub,
  },
});
