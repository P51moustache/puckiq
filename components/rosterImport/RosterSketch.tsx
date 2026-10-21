/**
 * A plain drawing of a league app's roster screen with the part to screenshot marked: position
 * badges and name bars inside a dashed red frame. Deliberately generic, never a host's logo or UI.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../coach/ui';

/** Positions and name-bar widths (percent) for the sketched rows. */
const ROWS: ReadonlyArray<readonly [string, number]> = [['C', 70], ['C', 56], ['W', 64], ['D', 52], ['G', 60]];

export function RosterSketch() {
  return (
    <View style={styles.phone} accessible accessibilityLabel="Screenshot your team's roster screen, the list with player names">
      <View style={styles.bar}>
        <Text style={styles.barText}>MY TEAM</Text>
      </View>
      <View style={styles.frame}>
        {ROWS.map(([position, width], index) => (
          <View key={index} style={styles.row}>
            <View style={styles.badge}><Text style={styles.badgeText}>{position}</Text></View>
            <View style={styles.flex}>
              <View style={[styles.name, { width: `${width}%` }]} />
              <View style={styles.meta} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  phone: {
    alignSelf: 'center',
    width: '78%',
    marginTop: 6,
    padding: 10,
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(225, 235, 245, 0.14)',
    backgroundColor: colors.raised,
  },
  bar: { paddingHorizontal: 4 },
  barText: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.sub },
  frame: { gap: 8, padding: 8, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accent },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.track },
  badgeText: { fontSize: 11, fontWeight: '800', color: colors.text },
  name: { height: 8, borderRadius: 4, backgroundColor: colors.sub, opacity: 0.6 },
  meta: { width: '34%', height: 6, borderRadius: 3, backgroundColor: colors.muted, opacity: 0.4 },
});
