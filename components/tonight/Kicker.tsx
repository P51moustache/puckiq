/**
 * The red-dot kicker that opens Tonight's cards ("LAST NIGHT · TUE OCT 13", "UP NEXT"), with an
 * optional element (share, close) pushed to the far end. A pulsing dot while games are live.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LiveDot } from '../coach/motion';
import { colors } from '../coach/ui';

export function Kicker({
  label,
  live = false,
  onInk = true,
  right,
}: {
  label: string;
  live?: boolean;
  /** White text for carbon panels; ink text on white cards. */
  onInk?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      {live ? <LiveDot /> : <View style={styles.dot} />}
      <Text style={[styles.text, !onInk && styles.textInk]}>{label}</Text>
      {right ? <View style={styles.spacer} /> : null}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  text: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: colors.onInk },
  textInk: { color: colors.text },
  spacer: { flex: 1 },
});
