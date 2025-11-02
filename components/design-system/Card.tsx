import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export function Card({ 
  children, 
  variant = 'elevated', 
  padding = 'md',
  style 
}: CardProps) {
  return (
    <View style={[
      styles.base,
      styles[variant],
      styles[`padding-${padding}`],
      style
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    backgroundColor: '#192e5eff', // Your dark mode card color
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  outlined: {
    borderWidth: 1,
    borderColor: '#081726', // Your dark mode border color
  },
  filled: {
    backgroundColor: '#334e8dff', // Your factbox color
  },
  'padding-sm': {
    padding: 12,
  },
  'padding-md': {
    padding: 16,
  },
  'padding-lg': {
    padding: 24,
  },
});