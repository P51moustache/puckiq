import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout } from './theme';

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  testID,
  style,
}: {
  options: { value: T; label: string; locked?: boolean }[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segment, style]} testID={testID}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            testID={testID ? `${testID}-${option.value}` : undefined}
          >
            <Text
              style={[styles.segmentText, active && styles.segmentTextActive]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
            {option.locked ? (
              <Ionicons
                name="lock-closed"
                size={10}
                color={active ? colors.onInk : colors.muted}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: layout.tapTarget,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  segmentItemActive: {
    borderBottomColor: colors.accent,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.sub,
  },
  segmentTextActive: {
    color: colors.onInk,
  },
});
