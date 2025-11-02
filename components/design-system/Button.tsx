import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ 
  title, 
  onPress, 
  variant = 'primary', 
  size = 'md',
  disabled = false,
  style 
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[`size-${size}`],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style
      ]}
    >
      <Text style={[
        styles.text,
        styles[`text-${variant}`],
        styles[`text-${size}`],
        disabled && styles.textDisabled
      ]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#60a5fa', // Your accent color
  },
  secondary: {
    backgroundColor: '#334e8dff', // Your factbox color
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#081726', // Your border color
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  'size-sm': {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  'size-md': {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  'size-lg': {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600',
  },
  'text-primary': {
    color: '#ffffff',
  },
  'text-secondary': {
    color: '#ffffff',
  },
  'text-outline': {
    color: '#e6eef8', // Your text color
  },
  'text-ghost': {
    color: '#60a5fa', // Your accent color
  },
  'text-sm': {
    fontSize: 14,
  },
  'text-md': {
    fontSize: 16,
  },
  'text-lg': {
    fontSize: 18,
  },
  textDisabled: {
    color: '#98a6bf', // Your subtext color
  },
});