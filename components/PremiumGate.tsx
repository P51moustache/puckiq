import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  FadeInUp,
} from 'react-native-reanimated';
import { theme } from '../constants/theme';
import { useSubscription } from './SubscriptionProvider';

export interface PremiumGateProps {
  children: React.ReactNode;
  feature: string;
  onUpgrade?: () => void;
}

const PRO_BENEFITS = [
  { icon: 'analytics-outline' as const, text: 'ML-Powered Predictions' },
  { icon: 'swap-horizontal-outline' as const, text: 'Start/Sit Engine' },
  { icon: 'search-outline' as const, text: 'Waiver Wire Scout' },
];

export default function PremiumGate({ children, feature, onUpgrade }: PremiumGateProps) {
  const { isPremium } = useSubscription();
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.25, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [glowScale, glowOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowOpacity.value,
  }));

  if (isPremium) return <>{children}</>;

  return (
    <View style={styles.wrapper} testID="premium-gate">
      {/* Dimmed content preview */}
      <View style={styles.contentDimmed} pointerEvents="none">
        {children}
      </View>

      {/* Glass overlay */}
      <LinearGradient
        colors={['rgba(7, 16, 35, 0.55)', 'rgba(7, 16, 35, 0.92)', 'rgba(7, 16, 35, 0.98)']}
        locations={[0, 0.5, 1]}
        style={styles.gradientOverlay}
        testID="premium-gate-overlay"
      >
        {/* Glass card */}
        <Animated.View entering={FadeInUp.duration(500)} style={styles.glassCard}>
          {/* Pulsing glow ring */}
          <View style={styles.lockContainer}>
            <Animated.View style={[styles.glowRing, pulseStyle]} />
            <Animated.View style={[styles.glowRingOuter, pulseStyle]} />
            <View style={styles.lockCircle}>
              <Ionicons name="lock-closed" size={24} color="#fff" />
            </View>
          </View>

          {/* Headline */}
          <Text style={styles.headline}>Unlock Your Edge</Text>
          <Text style={styles.featureText}>{feature}</Text>

          {/* Benefits */}
          <View style={styles.benefitsContainer}>
            {PRO_BENEFITS.map((benefit) => (
              <View key={benefit.text} style={styles.benefitRow}>
                <View style={styles.benefitIconWrap}>
                  <Ionicons name={benefit.icon} size={16} color={theme.accent} />
                </View>
                <Text style={styles.benefitText}>{benefit.text}</Text>
              </View>
            ))}
          </View>

          {/* CTA Button */}
          <TouchableOpacity
            onPress={onUpgrade}
            testID="premium-gate-upgrade"
            activeOpacity={0.8}
            style={styles.ctaTouchable}
          >
            <LinearGradient
              colors={['#60a5fa', '#3b82f6', '#1e40af']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>Unlock with PuckIQ Pro</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.trialSubtext}>7 days free, then $6.99/mo</Text>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  contentDimmed: {
    opacity: 0.35,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  glassCard: {
    backgroundColor: 'rgba(25, 46, 94, 0.65)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  lockContainer: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  glowRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#60a5fa',
    backgroundColor: 'transparent',
  },
  glowRingOuter: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    backgroundColor: 'transparent',
  },
  lockCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.subtext,
    textAlign: 'center',
    marginBottom: 20,
  },
  benefitsContainer: {
    width: '100%',
    marginBottom: 20,
    gap: 10,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '500',
  },
  ctaTouchable: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
  },
  ctaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  trialSubtext: {
    color: theme.subtext,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 10,
    opacity: 0.8,
  },
});
