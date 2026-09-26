/**
 * PuckIQ Pro sheet. Prices come from the store (RevenueCat offerings); the list
 * prices in constants/monetization are only a fallback label.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { PurchasesPackage } from 'react-native-purchases';
import {
  LIST_PRICE_ANNUAL,
  LIST_PRICE_MONTHLY,
  PRO_FEATURES,
  isPaywallEnabled,
  type PaywallSource,
} from '../constants/monetization';
import { PRIVACY_URL, TERMS_URL } from '../constants/legal';
import { ART } from '../constants/art';
import { FREE_STATUS, getOfferings, purchasePackage, restorePurchases } from '../services/subscription';
import AnalyticsService from '../services/analytics/AnalyticsService';
import { useSubscription } from './SubscriptionProvider';
import { BrandMark, colors, PrimaryButton } from './coach/ui';

interface ProPaywallProps {
  visible: boolean;
  onClose: () => void;
  source?: PaywallSource;
}

type Plan = 'annual' | 'monthly';

function packagePrice(pkg: PurchasesPackage | null | undefined): string | null {
  const price = pkg?.product?.priceString;
  return typeof price === 'string' && price ? price : null;
}

const TRIAL_UNIT_DAYS: Record<string, number> = { DAY: 1, WEEK: 7 };
const TRIAL_UNIT_NAME: Record<string, string> = { MONTH: 'month', YEAR: 'year' };

/**
 * "7-day free trial" — only when the store product really has a FREE intro offer,
 * worded from its actual length. Paid intro offers aren't trials, so they get null.
 */
export function trialLabel(pkg: PurchasesPackage | null | undefined): string | null {
  const intro = pkg?.product?.introPrice;
  if (!intro || intro.price !== 0) return null;
  const count = Number(intro.periodNumberOfUnits) || 1;
  const unit = String(intro.periodUnit ?? '').toUpperCase();
  if (TRIAL_UNIT_DAYS[unit]) return `${count * TRIAL_UNIT_DAYS[unit]}-day free trial`;
  if (TRIAL_UNIT_NAME[unit]) return `${count}-${TRIAL_UNIT_NAME[unit]} free trial`;
  return 'free trial';
}

export default function ProPaywall({ visible, onClose, source = 'settings' }: ProPaywallProps) {
  const { refresh, applyStatus, status = FREE_STATUS } = useSubscription();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [plan, setPlan] = useState<Plan>('annual');
  const [packages, setPackages] = useState<{ annual: PurchasesPackage | null; monthly: PurchasesPackage | null }>({ annual: null, monthly: null });
  const busy = purchasing || restoring;

  useEffect(() => {
    if (!visible) return;
    AnalyticsService.getInstance().trackCustomEvent('paywall_view', { source });
    let cancelled = false;
    getOfferings().then((offerings) => {
      if (cancelled) return;
      setPackages({ annual: offerings?.current?.annual ?? null, monthly: offerings?.current?.monthly ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [visible, source]);

  const selected = plan === 'annual' ? packages.annual : packages.monthly;
  const annualPrice = packagePrice(packages.annual) ?? LIST_PRICE_ANNUAL;
  const monthlyPrice = packagePrice(packages.monthly) ?? LIST_PRICE_MONTHLY;
  const trial = trialLabel(selected);
  const renewal = plan === 'annual' ? `${annualPrice}/year` : `${monthlyPrice}/month`;

  const savings = useMemo(() => {
    const annual = packages.annual?.product?.price;
    const monthly = packages.monthly?.product?.price;
    if (typeof annual !== 'number' || typeof monthly !== 'number' || monthly <= 0) return null;
    // Hockey season is ~7 months.
    const pct = Math.round((1 - annual / (monthly * 7)) * 100);
    return pct > 0 ? pct : null;
  }, [packages]);

  const handlePurchase = async () => {
    if (!isPaywallEnabled()) {
      Alert.alert('Subscriptions are off', 'Purchases are disabled in this build.');
      return;
    }
    if (!selected) {
      Alert.alert('Store unavailable', 'We couldn’t reach the App Store. Check your connection and try again.');
      return;
    }
    setPurchasing(true);
    try {
      const result = await purchasePackage(selected);
      AnalyticsService.getInstance().trackCustomEvent('paywall_purchase', { source, plan, result });
      if (result === 'purchased') {
        await refresh();
        onClose();
      } else if (result === 'failed') {
        Alert.alert('Purchase didn’t go through', 'You weren’t charged. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const restored = await restorePurchases();
      AnalyticsService.getInstance().trackCustomEvent('paywall_restore', { source, result: restored.isPro ? 'pro' : 'none' });
      if (restored.isPro) {
        applyStatus(restored);
        onClose();
      } else {
        Alert.alert('Nothing to restore', 'No active PuckIQ Pro subscription was found for this Apple ID.');
      }
    } finally {
      setRestoring(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} testID="pro-paywall">
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} disabled={busy} hitSlop={10} testID="pro-paywall-close" accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={colors.onInk} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Image source={ART.goalLamp} style={styles.heroImage} contentFit="cover" contentPosition="center" accessible={false} />
            <LinearGradient colors={['#15151E00', colors.ink]} style={styles.heroFade} pointerEvents="none" />
          </View>
          <View style={styles.kickerRow}>
            <BrandMark height={16} />
            <Text style={styles.kicker}>PUCKIQ PRO</Text>
          </View>
          <Text style={styles.title}>WIN YOUR{'\n'}WEEK.</Text>
          <Text style={styles.lede}>
            Your best lineup, every move before lock, and pickups for your empty nights.
          </Text>

          {status.isPro ? (
            <View style={styles.activeCard} testID="pro-active">
              <Ionicons name="checkmark-circle" size={18} color={colors.good} />
              <Text style={styles.activeText}>
                {status.source === 'legacy' ? 'Pro is included with your original purchase.' : 'You’re on Pro.'}
              </Text>
            </View>
          ) : null}

          <View style={styles.features}>
            {PRO_FEATURES.map((feature) => (
              <View key={feature.title} style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Ionicons name={feature.icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.onInk} />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDetail}>{feature.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.legal}>
            Payment is charged to your Apple ID at confirmation. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the period. Manage or cancel in your App Store account settings.
          </Text>
          <View style={styles.links}>
            <Text style={styles.link} onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link">
              Terms of Use
            </Text>
            {PRIVACY_URL ? (
              <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">
                Privacy Policy
              </Text>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {!status.isPro ? (
            <>
              <View style={styles.plans}>
                <Pressable
                  style={[styles.plan, plan === 'annual' && styles.planOn]}
                  onPress={() => setPlan('annual')}
                  testID="pro-plan-annual"
                  accessibilityRole="radio"
                  accessibilityState={{ selected: plan === 'annual' }}
                >
                  {savings ? <Text style={styles.planBadge}>SAVE {savings}%</Text> : <Text style={styles.planBadge}>BEST VALUE</Text>}
                  <Text style={styles.planName}>Season pass</Text>
                  <Text style={styles.planPrice}>{annualPrice}</Text>
                  <Text style={styles.planNote}>per season · billed yearly</Text>
                </Pressable>
                <Pressable
                  style={[styles.plan, plan === 'monthly' && styles.planOn]}
                  onPress={() => setPlan('monthly')}
                  testID="pro-plan-monthly"
                  accessibilityRole="radio"
                  accessibilityState={{ selected: plan === 'monthly' }}
                >
                  <Text style={[styles.planBadge, styles.planBadgeHidden]}> </Text>
                  <Text style={styles.planName}>Monthly</Text>
                  <Text style={styles.planPrice}>{monthlyPrice}</Text>
                  <Text style={styles.planNote}>per month · cancel anytime</Text>
                </Pressable>
              </View>
              {savings ? (
                <Text style={styles.savingsNote}>Savings vs. paying monthly for a 7-month NHL season.</Text>
              ) : null}

              <PrimaryButton
                label={trial ? `Start ${trial}` : 'Subscribe'}
                onPress={handlePurchase}
                loading={purchasing}
                disabled={busy}
                testID="pro-subscribe"
              />
              <Text style={styles.renewal} testID="pro-renewal">
                {trial ? `${trial[0].toUpperCase()}${trial.slice(1)}, then ${renewal}. ` : `${renewal}, renews automatically. `}
                Cancel anytime.
              </Text>
            </>
          ) : null}

          <Pressable onPress={handleRestore} disabled={busy} style={styles.restore} testID="pro-restore">
            {restoring ? <ActivityIndicator color={colors.onInk} /> : <Text style={styles.restoreText}>Restore purchases</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  header: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#00000066',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    height: 290,
    marginHorizontal: -22,
    marginBottom: -54,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
  },
  body: {
    paddingHorizontal: 22,
    paddingBottom: 40,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: colors.onInk,
  },
  title: {
    fontSize: 50,
    lineHeight: 52,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -1.5,
    color: colors.onInk,
    marginTop: 8,
  },
  lede: {
    fontSize: 16,
    lineHeight: 23,
    color: colors.onInkSub,
    marginTop: 10,
  },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.inkRaised,
  },
  activeText: {
    color: colors.onInk,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  features: {
    marginTop: 24,
    gap: 16,
  },
  feature: {
    flexDirection: 'row',
    gap: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.inkRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.onInk,
  },
  featureDetail: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.onInkSub,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    backgroundColor: colors.ink,
  },
  plans: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  plan: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.inkRaised,
    backgroundColor: colors.inkRaised,
    padding: 14,
    gap: 2,
  },
  planOn: {
    borderColor: colors.onInk,
  },
  planBadge: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.onInk,
    backgroundColor: colors.accent,
    borderRadius: 6,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6,
  },
  planBadgeHidden: {
    opacity: 0,
  },
  planName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.onInk,
  },
  planPrice: {
    fontSize: 30,
    fontWeight: '900',
    fontStyle: 'italic',
    color: colors.onInk,
  },
  planNote: {
    fontSize: 12,
    color: colors.onInkSub,
  },
  savingsNote: {
    fontSize: 11,
    color: colors.onInkSub,
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 10,
  },
  renewal: {
    fontSize: 12,
    color: colors.onInkSub,
    textAlign: 'center',
    marginTop: 8,
  },
  restore: {
    alignItems: 'center',
    paddingTop: 12,
  },
  restoreText: {
    color: colors.onInk,
    fontSize: 14,
    fontWeight: '800',
  },
  legal: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.onInkSub,
    textAlign: 'center',
    marginTop: 28,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginTop: 10,
  },
  link: {
    fontSize: 12,
    color: colors.onInkSub,
    textDecorationLine: 'underline',
  },
});
