import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
  retryLabel?: string;
  style?: ViewStyle;
}

export function ErrorState({
  message = 'Something went wrong',
  onRetry,
  retryLabel = 'Try Again',
  style,
}: ErrorStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Ionicons name="alert-circle-outline" size={32} color="#f59e0b" />
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>{retryLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  icon: {
    fontSize: 36,
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: theme.subtext,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  button: {
    marginTop: 16,
    backgroundColor: '#ef444422',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
});
