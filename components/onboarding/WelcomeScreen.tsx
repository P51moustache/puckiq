import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { theme } from '../../constants/theme';

interface WelcomeScreenProps {
  onContinueWithApple: () => void;
  onContinueWithGoogle: () => void;
  onSkip: () => void;
}

export function WelcomeScreen({ onContinueWithApple, onContinueWithGoogle, onSkip }: WelcomeScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🏒</Text>
        </View>

        <Text style={styles.title}>PuckIQ</Text>
        <Text style={styles.subtitle}>Win Your Fantasy League</Text>
        <Text style={styles.tagline}>
          ML-powered lineup recommendations, start/sit advice, and waiver wire picks
        </Text>
      </View>

      <View style={styles.buttons}>
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.appleButton}
            onPress={onContinueWithApple}
            accessibilityLabel="Continue with Apple"
          >
            <Text style={styles.appleButtonText}> Continue with Apple</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.googleButton}
          onPress={onContinueWithGoogle}
          accessibilityLabel="Continue with Google"
        >
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onSkip} style={styles.skipLink}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 48,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: '600',
    color: theme.accent,
    marginBottom: 16,
  },
  tagline: {
    fontSize: 16,
    color: theme.subtext,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  buttons: {
    gap: 12,
  },
  appleButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  appleButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '600',
  },
  googleButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.subtext,
  },
  googleButtonText: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '600',
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    color: theme.subtext,
    fontSize: 15,
  },
});
