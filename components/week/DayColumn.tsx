/**
 * One day's cell in any row of the stint chart: the off-night tint, and the red
 * live-timing "now" line on today's leading edge — the boundary between days already
 * played and days still to come. Rows stack edge to edge, so the per-row segments
 * read as one line through the chart.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../coach/ui';
import { NOW_CAP_SIZE, NOW_LINE_WIDTH, OFF_NIGHT_TINT } from './gridMetrics';

export function DayColumn({
  offNight,
  now = false,
  cap = false,
  children,
  testID,
}: {
  offNight: boolean;
  /** Draw the now line on this column's leading edge (today). */
  now?: boolean;
  /** Top of the line: a dot on the row's top edge. */
  cap?: boolean;
  children?: React.ReactNode;
  testID?: string;
}) {
  return (
    <View style={[styles.column, offNight && styles.offNight]} testID={testID}>
      {children}
      {now ? <View pointerEvents="none" style={[styles.nowLine, cap && styles.nowLineCapped]} testID="week-now-line" /> : null}
      {now && cap ? <View pointerEvents="none" style={styles.nowCap} testID="week-now-cap" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  offNight: {
    backgroundColor: OFF_NIGHT_TINT,
  },
  nowLine: {
    position: 'absolute',
    left: -NOW_LINE_WIDTH / 2,
    width: NOW_LINE_WIDTH,
    // Reach over the row's hairline top border so the segments join.
    top: -1,
    bottom: 0,
    backgroundColor: colors.accent,
  },
  nowLineCapped: {
    top: 0,
  },
  nowCap: {
    position: 'absolute',
    left: -NOW_CAP_SIZE / 2,
    top: -NOW_CAP_SIZE / 2,
    width: NOW_CAP_SIZE,
    height: NOW_CAP_SIZE,
    borderRadius: NOW_CAP_SIZE / 2,
    backgroundColor: colors.accent,
  },
});
