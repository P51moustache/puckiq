/** A − value + stepper for League settings' numbers (slots, league size, scoring weights). */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, display } from '../../coach/ui';

export function Stepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  format = (n: number) => String(n),
  testID,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  testID?: string;
}) {
  const round = (n: number) => Math.round(n * 100) / 100;
  return (
    <View style={styles.stepper} testID={testID}>
      <Pressable
        onPress={() => onChange(round(Math.max(min, value - step)))}
        disabled={value <= min}
        style={[styles.stepButton, value <= min && styles.stepDisabled]}
        hitSlop={6}
        accessibilityLabel="Decrease"
      >
        <Ionicons name="remove" size={16} color={colors.text} />
      </Pressable>
      <Text style={styles.stepValue}>{format(value)}</Text>
      <Pressable
        onPress={() => onChange(round(Math.min(max, value + step)))}
        disabled={value >= max}
        style={[styles.stepButton, value >= max && styles.stepDisabled]}
        hitSlop={6}
        accessibilityLabel="Increase"
      >
        <Ionicons name="add" size={16} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: {
    opacity: 0.35,
  },
  stepValue: {
    ...display(18),
    minWidth: 34,
    textAlign: 'center',
  },
});
