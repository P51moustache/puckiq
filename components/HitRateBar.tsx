/**
 * HitRateBar — Segmented horizontal bar showing hit rate (e.g., 8/10).
 * Filled segments are green, empty segments are dim.
 */

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';

interface HitRateBarProps {
  hit: number;
  total: number;
}

export default React.memo(function HitRateBar({ hit, total }: HitRateBarProps) {
  const segments = [];
  for (let i = 0; i < total; i++) {
    segments.push(
      <View
        key={i}
        style={[
          styles.segment,
          { backgroundColor: i < hit ? theme.semantic.positive : 'rgba(255, 255, 255, 0.1)' },
        ]}
      />,
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.segmentRow}>{segments}</View>
      <Text style={styles.label}>
        {hit}/{total}
      </Text>
    </View>
  );
})

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 2,
  },
  segment: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.semantic.positive,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
});
