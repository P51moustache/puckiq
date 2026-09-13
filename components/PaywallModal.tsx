import React, { useEffect, useState } from 'react';
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
import {
  getIntroductoryPriceEligibility,
  getOfferings,
  PurchaseResult,
  purchasePackage,
  restorePurchases,
  RestoreResult,
} from '../services/subscription';
import { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  refresh: () => Promise<void>;
  featureHeadline?: string;
}

const FEATURES = [
  {
    title: 'ML-powered game predictions',
    subtitle: 'Model-backed probabilities for followed games',
    icon: 'analytics' as const,
  },
  {
    title: 'Advanced player analytics',
    subtitle: 'Compare player performance and role context',
    icon: 'swap-horizontal' as const,
  },
  {
    title: 'Custom model builder',
    subtitle: 'Tune factors and review your model',
    icon: 'stats-chart' as const,
  },
  {
    title: 'Forecast history',
    subtitle: 'Compare saved forecasts over time',
    icon: 'time' as const,
  },
];

type Plan = 'annual' | 'monthly';
type OfferingState = 'loading' | 'available' | 'unavailable' | 'error';

function packageForPlan(offering: PurchasesOffering | null, plan: Plan): PurchasesPackage | null {
  return offering?.[plan] ?? null;
}

function hasStorePrice(pkg: PurchasesPackage | null): boolean {
  return Boolean(pkg?.product?.priceString);
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? `Subscription action failed: ${error.message}`
    : 'Subscription action failed. Please try again.';
}

function purchaseMessage(result: PurchaseResult): string | null {
  if (result.status === 'cancelled') return 'Purchase cancelled.';
  if (result.status === 'no_entitlement') return 'Purchase completed, but Pro is not active yet. Try Restore Purchases.';
  if (result.status === 'error') return errorMessage(result.error);
  return null;
}

function restoreMessage(result: RestoreResult): string | null {
  if (result.status === 'no_entitlement') return 'No active PuckIQ Pro entitlement was found.';
  if (result.status === 'error') return errorMessage(result.error);
  return null;
}

export default function PaywallModal({
  visible,
  onClose,
  refresh,
  featureHeadline = 'Unlock Premium Analytics',
}: PaywallModalProps) {
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
  const [offeringState, setOfferingState] = useState<OfferingState>('loading');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [introEligibility, setIntroEligibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!visible) return undefined;
    let mounted = true;
    setOfferingState('loading');
    setCurrentOffering(null);
    setFeedback(null);
    setIntroEligibility({});

    const loadOffering = async () => {
      const offerings = await getOfferings();
      if (!mounted) return;
      const offering = offerings.current;
      const supportedPackages = offering
        ? [offering.monthly, offering.annual].filter(
          (pkg): pkg is PurchasesPackage => hasStorePrice(pkg),
        )
        : [];

      if (!offering || supportedPackages.length === 0) {
        setCurrentOffering(null);
        setOfferingState('unavailable');
        return;
      }

      setCurrentOffering(offering);
      setOfferingState('available');
      setSelectedPlan((plan) => packageForPlan(offering, plan) && hasStorePrice(packageForPlan(offering, plan))
        ? plan
        : hasStorePrice(offering.annual) ? 'annual' : 'monthly');

      const introProductIds = supportedPackages
        .filter((pkg) => Boolean(pkg.product?.introPrice))
        .map((pkg) => pkg.product?.identifier || pkg.identifier);
      if (introProductIds.length > 0) {
        const eligibility = await getIntroductoryPriceEligibility(introProductIds);
        if (mounted) setIntroEligibility(eligibility);
      }
    };

    loadOffering().catch((error: unknown) => {
      if (!mounted) return;
      setOfferingState('error');
      setFeedback(errorMessage(error));
    });

    return () => { mounted = false; };
  }, [visible]);

  const handlePurchase = async (packageType: Plan) => {
    const pkg = packageForPlan(currentOffering, packageType);
    if (!pkg || !hasStorePrice(pkg)) {
      setFeedback(pkg ? 'This subscription price is unavailable.' : 'Subscriptions are currently unavailable.');
      return;
    }

    setPurchasing(true);
    setFeedback(null);
    try {
      const result = await purchasePackage(pkg);
      const message = purchaseMessage(result);
      if (result.status === 'active') {
        await refresh();
        onClose();
      } else if (message) {
        setFeedback(message);
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setFeedback(null);
    try {
      const result = await restorePurchases();
      const message = restoreMessage(result);
      if (result.status === 'restored') {
        await refresh();
        onClose();
      } else if (message) {
        setFeedback(message);
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
              Explore model-backed probabilities and player-analysis tools.
            </Text>
          </Animated.View>

          {/* Feature cards */}
          <Animated.View entering={FadeInUp.duration(600).delay(250)} style={styles.featuresSection}>
            {FEATURES.map((feat) => (
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
            <Text style={styles.pricingLabel}>Store subscription options</Text>

            {offeringState === 'loading' && <Text style={styles.statusText}>Loading store prices…</Text>}
            {offeringState === 'unavailable' && <Text style={styles.statusText}>Subscriptions are currently unavailable.</Text>}
            {offeringState === 'error' && <Text style={styles.statusText}>Subscription options could not be loaded.</Text>}

            {currentOffering && (
              <View style={styles.pricingRow}>
                {(['monthly', 'annual'] as Plan[]).map((plan) => {
                  const pkg = packageForPlan(currentOffering, plan);
                  if (!pkg || !hasStorePrice(pkg)) return null;
                  const introPrice = pkg.product?.introPrice;
                  return (
                    <TouchableOpacity
                      key={plan}
                      style={[
                        styles.pricingCard,
                        selectedPlan === plan && styles.pricingCardSelected,
                      ]}
                      onPress={() => setSelectedPlan(plan)}
                      testID={`paywall-${plan}-plan`}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.planName}>{plan === 'annual' ? 'Annual' : 'Monthly'}</Text>
                      <Text style={styles.planPrice}>{pkg.product?.priceString || 'Price unavailable'}</Text>
                      {introPrice
                        && introEligibility[pkg.product?.identifier || pkg.identifier] === true && (
                        <Text style={styles.planMonthly}>Intro offer: {introPrice.priceString}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Animated.View>

          {/* CTA */}
          <Animated.View entering={FadeInDown.duration(600).delay(550)} style={styles.ctaSection}>
            <TouchableOpacity
              onPress={() => handlePurchase(selectedPlan)}
              testID="paywall-purchase"
              disabled={isLoading || offeringState !== 'available' || !hasStorePrice(packageForPlan(currentOffering, selectedPlan))}
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
                  <Text style={styles.ctaText}>Subscribe</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {feedback && <Text style={styles.feedbackText} accessibilityRole="alert">{feedback}</Text>}

            <Text style={styles.trialSubtext}>Store terms apply.</Text>

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
  pricingCardSelected: {
    borderColor: '#4cc9f0',
    backgroundColor: 'rgba(76, 201, 240, 0.12)',
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
    shadowColor: '#4cc9f0',
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
  statusText: {
    color: '#8b95b0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  trialSubtext: {
    color: '#8b95b0',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
  },
  feedbackText: {
    color: '#f0f4ff',
    fontSize: 13,
    lineHeight: 19,
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
