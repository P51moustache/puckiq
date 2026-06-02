import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { purchasePackage, restorePurchases, getOfferings } from '../services/subscription';
import { useSubscription } from './SubscriptionProvider';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  featureHeadline?: string;
}

const FEATURES = [
  {
    emoji: '\u{1F9E0}',
    title: 'ML-powered game predictions',
    subtitle: 'Know who wins before the game',
    icon: 'analytics' as const,
  },
  {
    emoji: '\u{1F3D2}',
    title: 'Advanced player analytics',
    subtitle: 'Never bench the wrong player',
    icon: 'swap-horizontal' as const,
  },
  {
    emoji: '\u{1F4CA}',
    title: 'Custom model builder',
    subtitle: 'Projected points for every player',
    icon: 'stats-chart' as const,
  },
  {
    emoji: '\u{1F514}',
    title: 'Ad-free experience',
    subtitle: 'Lineup locks, injuries, goalies',
    icon: 'notifications' as const,
  },
];

export default function PaywallModal({
  visible,
  onClose,
  featureHeadline = 'Unlock Premium Analytics',
}: PaywallModalProps) {
  const { refresh } = useSubscription();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');

  const handlePurchase = async (packageType: 'monthly' | 'annual') => {
    setPurchasing(true);
    try {
      const offerings = await getOfferings();
      const currentOffering = offerings?.current;
      if (!currentOffering) {
        console.warn('[SUBSCRIPTION] No current offering available');
        return;
      }

      const pkg = packageType === 'monthly'
        ? currentOffering.monthly
        : currentOffering.annual;

      if (!pkg) {
        console.warn(`[SUBSCRIPTION] No ${packageType} package available`);
        return;
      }

      const success = await purchasePackage(pkg);
      if (success) {
        await refresh();
        onClose();
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        await refresh();
        onClose();
      }
    } finally {
      setRestoring(false);
    }
  };

  const isLoading = purchasing || restoring;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={['#0a0e1a', '#141829']}
        style={styles.fullScreen}
      >
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          testID="paywall-close"
          disabled={isLoading}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <View style={styles.closeCircle}>
            <Ionicons name="close" size={20} color="#f0f4ff" />
          </View>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInUp.duration(600).delay(100)} style={styles.headerSection}>
            <View style={styles.proIconContainer}>
              <LinearGradient
                colors={['#4cc9f0', '#141829']}
                style={styles.proIconGradient}
              >
                <Ionicons name="diamond" size={28} color="#fff" />
              </LinearGradient>
              <View style={styles.proIconGlow} />
            </View>

            <Text style={styles.proTitle}>PuckIQ Pro</Text>
            <Text style={styles.headline}>{featureHeadline}</Text>
            <Text style={styles.subheadline}>
              Elevate your hockey analytics with machine learning predictions and fantasy tools.
            </Text>
          </Animated.View>

          {/* Feature cards */}
          <Animated.View entering={FadeInUp.duration(600).delay(250)} style={styles.featuresSection}>
            {FEATURES.map((feat, idx) => (
              <View key={feat.title} style={styles.featureCard}>
                <View style={styles.featureIconWrap}>
                  <Ionicons name={feat.icon} size={20} color="#4cc9f0" />
                </View>
                <View style={styles.featureTextWrap}>
                  <Text style={styles.featureTitle}>{feat.title}</Text>
                  <Text style={styles.featureSubtitle}>{feat.subtitle}</Text>
                </View>
              </View>
            ))}
          </Animated.View>

          {/* Pricing cards */}
          <Animated.View entering={FadeInUp.duration(600).delay(400)} style={styles.pricingSection}>
            <Text style={styles.pricingLabel}>Choose Your Plan</Text>

            <View style={styles.pricingRow}>
              {/* Monthly */}
              <TouchableOpacity
                style={[
                  styles.pricingCard,
                  selectedPlan === 'monthly' && styles.pricingCardSelected,
                ]}
                onPress={() => setSelectedPlan('monthly')}
                activeOpacity={0.8}
              >
                <Text style={styles.planName}>Monthly</Text>
                <Text style={styles.planPrice}>$6.99/mo</Text>
              </TouchableOpacity>

              {/* Annual (recommended) */}
              <TouchableOpacity
                style={[
                  styles.pricingCard,
                  styles.pricingCardAnnual,
                  selectedPlan === 'annual' && styles.pricingCardSelected,
                ]}
                onPress={() => setSelectedPlan('annual')}
                activeOpacity={0.8}
              >
                {/* Save badge */}
                <View style={styles.saveBadge}>
                  <Text style={styles.saveBadgeText}>Save 40%</Text>
                </View>

                <Text style={styles.planName}>Annual</Text>
                <Text style={styles.planPrice}>$49.99/yr</Text>
                <Text style={styles.planMonthly}>$4.17/mo</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* CTA */}
          <Animated.View entering={FadeInDown.duration(600).delay(550)} style={styles.ctaSection}>
            <TouchableOpacity
              onPress={() => handlePurchase(selectedPlan)}
              testID={selectedPlan === 'annual' ? 'paywall-annual' : 'paywall-monthly'}
              disabled={isLoading}
              activeOpacity={0.85}
              style={styles.ctaTouchable}
            >
              <LinearGradient
                colors={['#4cc9f0', '#f72585']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGradient}
              >
                {purchasing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.ctaText}>Start 7-Day Free Trial</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Hidden testID buttons for purchase flows */}
            <View style={styles.hiddenButtons}>
              <TouchableOpacity
                testID="paywall-annual"
                onPress={() => handlePurchase('annual')}
                disabled={isLoading}
              />
              <TouchableOpacity
                testID="paywall-monthly"
                onPress={() => handlePurchase('monthly')}
                disabled={isLoading}
              />
            </View>

            <Text style={styles.trialSubtext}>
              {selectedPlan === 'annual' ? '$49.99/yr' : '$6.99/mo'} after free trial. Cancel anytime.
            </Text>

            {/* Restore */}
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
              testID="paywall-restore"
              disabled={isLoading}
            >
              {restoring ? (
                <ActivityIndicator color="#8b95b0" size="small" />
              ) : (
                <Text style={styles.restoreText}>Restore Purchases</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 10,
  },
  closeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingTop: 80,
    paddingBottom: 50,
    paddingHorizontal: 24,
    alignItems: 'center',
  },

  // Header
  headerSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  proIconContainer: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  proIconGradient: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proIconGlow: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(76, 201, 240, 0.15)',
  },
  proTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4cc9f0',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 10,
    lineHeight: 34,
  },
  subheadline: {
    fontSize: 15,
    color: '#8b95b0',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },

  // Features
  featuresSection: {
    width: '100%',
    marginBottom: 28,
    gap: 10,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    padding: 14,
    gap: 14,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(76, 201, 240, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f0f4ff',
    marginBottom: 2,
  },
  featureSubtitle: {
    fontSize: 12,
    color: '#8b95b0',
    fontWeight: '400',
  },

  // Pricing
  pricingSection: {
    width: '100%',
    marginBottom: 24,
  },
  pricingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b95b0',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 14,
  },
  pricingRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pricingCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    padding: 18,
    alignItems: 'center',
  },
  pricingCardAnnual: {
    borderColor: '#06d6a0',
    shadowColor: '#06d6a0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  pricingCardSelected: {
    borderColor: '#4cc9f0',
    backgroundColor: 'rgba(76, 201, 240, 0.12)',
  },
  saveBadge: {
    position: 'absolute',
    top: -10,
    right: -1,
    backgroundColor: '#06d6a0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderTopRightRadius: 16,
  },
  saveBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b95b0',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Display-Bold',
  },
  planMonthly: {
    fontSize: 11,
    fontWeight: '500',
    color: '#4cc9f0',
    marginTop: 6,
    opacity: 0.9,
  },

  // CTA
  ctaSection: {
    width: '100%',
    alignItems: 'center',
  },
  ctaTouchable: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#f72585',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  ctaGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 16,
  },
  ctaText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  hiddenButtons: {
    height: 0,
    overflow: 'hidden',
    opacity: 0,
  },
  trialSubtext: {
    color: '#8b95b0',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
  },
  restoreButton: {
    paddingVertical: 12,
    marginTop: 4,
  },
  restoreText: {
    color: '#8b95b0',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
