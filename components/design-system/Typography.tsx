import React from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';

interface TypographyProps {
  children: React.ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'overline';
  color?: string;
  align?: 'left' | 'center' | 'right';
  style?: TextStyle;
}

export function Typography({ 
  children, 
  variant = 'body', 
  color = '#e6eef8', // Your dark mode text color
  align = 'left',
  style 
}: TypographyProps) {
  return (
    <Text style={[styles[variant], { color, textAlign: align }, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  h1: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
    letterSpacing: -0.25,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  overline: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});