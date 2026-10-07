/**
 * The F1 kicker every League card opens with: a red dot (the breathing live dot while games are
 * on) and an uppercase label, with an optional control on the right. Plus the small round
 * button those carbon cards use for their corner actions.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../coach/ui';
import { LiveDot } from '../coach/motion';

export function Kicker({
  label,
  dark = false,
  live = false,
  right,
  testID,
}: {
  label: string;
  /** On a carbon card. */
  dark?: boolean;
  live?: boolean;
  right?: React.ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.row} testID={testID}>
      {live ? <LiveDot /> : <View style={styles.dot} />}
      <Text style={[styles.label, { color: dark ? colors.onInk : colors.text }]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      <View style={styles.spacer} />
      {right}
    </View>
  );
}

/** Round corner action on a carbon card (same look as the share button). */
export function CarbonIconButton({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={17} color={colors.onInk} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  label: { flexShrink: 1, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  spacer: { flex: 1 },
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.inkRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
