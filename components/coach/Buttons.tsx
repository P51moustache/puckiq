import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, pressedStyle, toneColor, type Tone } from './theme';

/** Shared actions with compact and standard presentation. */
export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled,
  loading,
  testID,
  style,
  variant = 'red',
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  variant?: 'red' | 'black';
}) {
  const bg = variant === 'black' ? colors.ink : colors.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: bg },
        (disabled || loading) && styles.disabled,
        pressed && pressedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <>
          {icon ? (
            <Ionicons name={icon} size={18} color={colors.onAccent} />
          ) : null}
          <Text style={styles.primaryText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  icon,
  testID,
  tone = 'ink',
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const color = tone === 'neutral' ? colors.text : toneColor(tone);
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.ghost,
        { borderColor: color },
        pressed && pressedStyle,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={color} /> : null}
      <Text style={[styles.ghostText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  testID,
  dark = false,
  compact = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  testID?: string;
  dark?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        dark && styles.iconButtonDark,
        compact && styles.compact,
        pressed && pressedStyle,
      ]}
    >
      <Ionicons
        name={icon}
        size={compact ? 18 : 20}
        color={dark ? colors.onInk : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onAccent,
  },
  disabled: {
    opacity: 0.35,
  },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  ghostText: {
    fontSize: 13,
    fontWeight: '600',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDark: {
    backgroundColor: colors.ink,
  },
  compact: { width: 36, height: 36, backgroundColor: 'transparent' },
});
