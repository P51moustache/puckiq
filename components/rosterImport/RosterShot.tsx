/**
 * A small drawing of a league app's roster screen: the host's name, "My Team" and position-badge
 * rows. It shows what a good roster screenshot looks like. Plain text and shapes, never a host's
 * logo or real UI.
 */

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../coach/ui';

export interface ShotRow {
  /** "C", "D", "W", "G", or a slot such as "BN" / "IR" */
  position: string;
  name: string;
  /** "EDM · C" */
  meta: string;
}

interface Props {
  /** "Yahoo" */
  host: string;
  rows: readonly ShotRow[];
  /** Thumbnail size: smaller type and no column header. */
  compact?: boolean;
  /** Grey bars instead of names, for a phone drawn behind another. */
  blurred?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function RosterShot({ host, rows, compact = false, blurred = false, style }: Props) {
  const size = compact ? small : large;
  return (
    <View style={[styles.phone, size.phone, style]}>
      {blurred ? <View style={[styles.bar, styles.barHost]} /> : <Text style={[styles.host, size.host]} numberOfLines={1}>{host}</Text>}
      {compact || blurred ? null : (
        <>
          <Text style={styles.team}>My Team</Text>
          <Text style={styles.columns}>Pos  ·  Player</Text>
        </>
      )}
      {rows.map((row, index) => (
        <View key={index} style={[styles.row, size.row]}>
          <View style={[styles.badge, size.badge]}><Text style={[styles.badgeText, size.badgeText]}>{row.position}</Text></View>
          {blurred ? (
            <View style={styles.bars}>
              <View style={[styles.bar, { width: `${60 + ((index * 17) % 30)}%` }]} />
              <View style={[styles.bar, styles.barShort]} />
            </View>
          ) : (
            <View style={styles.flex}>
              <Text style={[styles.name, size.name]} numberOfLines={1}>{row.name}</Text>
              <Text style={[styles.meta, size.meta]} numberOfLines={1}>{row.meta}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  phone: { borderWidth: 1.5, borderColor: 'rgba(225, 235, 245, 0.28)', backgroundColor: '#0B1216', overflow: 'hidden' },
  host: { fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  team: { marginTop: 8, paddingBottom: 6, fontSize: 13, fontWeight: '700', color: colors.text, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.track },
  columns: { marginTop: 6, marginBottom: 2, fontSize: 10, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raised },
  badgeText: { fontWeight: '800', color: colors.text },
  name: { fontWeight: '600', color: colors.text },
  meta: { color: colors.muted },
  bars: { flex: 1, gap: 4 },
  bar: { height: 7, borderRadius: 4, backgroundColor: colors.track },
  barShort: { width: '40%', height: 5 },
  barHost: { width: '45%', height: 12, marginBottom: 6 },
});

const large = StyleSheet.create({
  phone: { borderRadius: 26, paddingHorizontal: 12, paddingTop: 16, paddingBottom: 12 },
  host: { fontSize: 20 },
  row: { gap: 10, marginTop: 9 },
  badge: { width: 30, height: 30, borderRadius: 7 },
  badgeText: { fontSize: 13 },
  name: { fontSize: 13 },
  meta: { fontSize: 10 },
});

const small = StyleSheet.create({
  phone: { borderRadius: 12, paddingHorizontal: 7, paddingTop: 8, paddingBottom: 8 },
  host: { fontSize: 12, marginBottom: 2 },
  row: { gap: 6, marginTop: 7 },
  badge: { width: 22, height: 22, borderRadius: 5 },
  badgeText: { fontSize: 10 },
  name: { fontSize: 10 },
  meta: { fontSize: 8 },
});
