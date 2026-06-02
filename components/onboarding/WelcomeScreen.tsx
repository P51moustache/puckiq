import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface WelcomeScreenProps {
  onContinueWithApple: () => void;
  onContinueWithGoogle: () => void;
  onSkip: () => void;
}

export function WelcomeScreen({ onContinueWithApple, onContinueWithGoogle, onSkip }: WelcomeScreenProps) {
  return (
    <LinearGradient
      colors={['#0f172a', '#1e3a8a', '#071023']}
      style={styles.container}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <View style={styles.content}>
        {/* Glowing puck icon */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.iconOuter}>
          <View style={styles.iconGlow} />
          <View style={styles.iconContainer}>
            <Ionicons name="disc" size={38} color="#60a5fa" />
          </View>
        </Animated.View>

        <Animated.Text entering={FadeInDown.duration(600).delay(200)} style={styles.title}>
          PuckIQ
        </Animated.Text>
        <Animated.Text entering={FadeInDown.duration(600).delay(400)} style={styles.subtitle}>
          Win Your Fantasy League
        </Animated.Text>
        <Animated.Text entering={FadeInDown.duration(600).delay(600)} style={styles.tagline}>
          ML-powered lineup recommendations, start/sit advice, and waiver wire picks
        </Animated.Text>
      </View>

      <Animated.View entering={FadeInDown.duration(500).delay(800)} style={styles.buttons}>
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.appleButton}
            onPress={onContinueWithApple}
            accessibilityLabel="Continue with Apple"
            activeOpacity={0.8}
          >
            <Ionicons name="logo-apple" size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.appleButtonText}>Continue with Apple</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.googleButton}
          onPress={onContinueWithGoogle}
          accessibilityLabel="Continue with Google"
          activeOpacity={0.8}
        >
          <Ionicons name="logo-google" size={18} color="#60a5fa" style={styles.buttonIcon} />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onSkip} style={styles.skipLink} activeOpacity={0.6}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  iconOuter: {
    position: 'relative',
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 20,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -1.5,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#60a5fa',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 16,
    color: '#98a6bf',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  buttons: {
    gap: 12,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a4080',
  },
  appleButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#192e5e',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a4080',
  },
  googleButtonText: {
    color: '#e6eef8',
    fontSize: 17,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 10,
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    color: '#98a6bf',
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});
