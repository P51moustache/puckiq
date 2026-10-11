import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';

export function SectionTabs<T extends string>({
  options,
  value,
  onChange,
  testID,
  comfortable = false,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
  /** Larger tap targets for screens with primary navigation controls. */
  comfortable?: boolean;
}) {
  return (
    <View style={styles.row}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option.value }}
          hitSlop={{ top: 4, bottom: 4 }}
          testID={testID ? `${testID}-${option.value}` : undefined}
          style={({ pressed }) => [
            styles.tab,
            comfortable && styles.comfortable,
            value === option.value && styles.active,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.label,
              comfortable && styles.comfortableLabel,
              value === option.value && styles.selected,
            ]}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  active: { borderBottomColor: colors.accent },
  comfortable: { minHeight: 44 },
  comfortableLabel: { fontSize: 14 },
  pressed: { backgroundColor: colors.raised },
  label: { fontSize: 13, color: colors.sub },
  selected: { color: colors.text, fontWeight: '600' },
});
