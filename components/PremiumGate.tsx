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
  { icon: 'analytics-outline' as const, text: 'ML-Powered Predictions', color: '#f72585' },
  { icon: 'swap-horizontal-outline' as const, text: 'Start/Sit Engine', color: '#06d6a0' },
  { icon: 'search-outline' as const, text: 'Waiver Wire Scout', color: '#4cc9f0' },
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
      {/* Dimmed content preview — let the underlying layout breathe through */}
      <View style={styles.contentDimmed} pointerEvents="none">
        {children}
      </View>

      {/* Lighter scrim — the underlying screen stays visible. The card itself has weight; the scrim doesn't need to. */}
      <LinearGradient
        colors={['rgba(10, 14, 26, 0.20)', 'rgba(10, 14, 26, 0.50)', 'rgba(10, 14, 26, 0.78)']}
        locations={[0, 0.5, 1]}
        style={styles.gradientOverlay}
        testID="premium-gate-overlay"
      >
        {/* Stat-Sheet card: tighter, calmer, no pulsing glow ring */}
        <Animated.View entering={FadeInUp.duration(500)} style={styles.glassCard}>
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={16} color="#0a0e1a" />
            <Text style={styles.lockBadgeText}>PRO</Text>
          </View>

          {/* Headline — the feature name leads, no marketing copy */}
          <Text style={styles.headline}>{feature}</Text>
          <Text style={styles.subhead}>Pro unlocks lineup, projections, and waiver intel.</Text>

          {/* CTA Button — single solid cyan, no rainbow gradient */}
          <TouchableOpacity
            onPress={onUpgrade}
            testID="premium-gate-upgrade"
            activeOpacity={0.85}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>Start 7-day trial</Text>
          </TouchableOpacity>

          <Text style={styles.trialSubtext}>$6.99 / mo after trial · cancel anytime</Text>
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
    opacity: 0.55,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  glassCard: {
    backgroundColor: '#141829',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 22,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4cc9f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 12,
  },
  lockBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0a0e1a',
    letterSpacing: 1.5,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f0f4ff',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 4,
    fontFamily: 'Display-Bold',
  },
  subhead: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8b95b0',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18,
  },
  ctaButton: {
    width: '100%',
    borderRadius: 10,
    backgroundColor: '#4cc9f0',
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaText: {
    color: '#0a0e1a',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  trialSubtext: {
    color: '#525c75',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 10,
    letterSpacing: 0.3,
  },
});
