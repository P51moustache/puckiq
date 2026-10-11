import { styles } from './ProPaywall.styles';
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
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { PurchasesPackage } from 'react-native-purchases';
import {
  PRO_FEATURES,
  isPaywallEnabled,
  type PaywallSource,
} from '../constants/monetization';
import { PRIVACY_URL, TERMS_URL } from '../constants/legal';
import { ART } from '../constants/art';
import { FREE_STATUS, getOfferings, getTrialEligibility, purchasePackage, restorePurchases } from '../services/subscription';
import { proAccessCopy } from '../services/proAccessCopy';
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
  const [trialEligibility, setTrialEligibility] = useState<Record<string, boolean>>({});
  const [storeLoading, setStoreLoading] = useState(true);
  const [storeAttempt, setStoreAttempt] = useState(0);
  const busy = purchasing || restoring;

  useEffect(() => {
    if (!visible) return;
    AnalyticsService.getInstance().trackCustomEvent('paywall_view', { source });
    let cancelled = false;
    setStoreLoading(true);
    setPackages({ annual: null, monthly: null });
    setTrialEligibility({});
    getOfferings().then((offerings) => {
      if (cancelled) return;
      const next = { annual: offerings?.current?.annual ?? null, monthly: offerings?.current?.monthly ?? null };
      setPackages(next);
      const ids = Object.values(next).flatMap((pkg) => pkg?.product?.identifier ? [pkg.product.identifier] : []);
      getTrialEligibility(ids).then((eligible) => { if (!cancelled) setTrialEligibility(eligible); });
    }).catch(() => undefined).finally(() => { if (!cancelled) setStoreLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [visible, source, storeAttempt]);

  const selected = plan === 'annual' ? packages.annual : packages.monthly;
  const annualPrice = packagePrice(packages.annual);
  const monthlyPrice = packagePrice(packages.monthly);
  const pricePlaceholder = storeLoading ? 'Loading…' : 'Unavailable';
  const trial = selected?.product?.identifier && trialEligibility[selected.product.identifier] === true ? trialLabel(selected) : null;
  const selectedPrice = plan === 'annual' ? annualPrice : monthlyPrice;
  const renewal = selectedPrice ? `${selectedPrice}/${plan === 'annual' ? 'year' : 'month'}` : null;

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
    if (!selected || !packagePrice(selected)) {
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
            <Image source={ART.hockeyNight} style={styles.heroImage} contentFit="cover" contentPosition="center" accessible={false} />
            <LinearGradient colors={['#0D141A00', colors.bg]} style={styles.heroFade} pointerEvents="none" />
          </View>
          <View style={styles.kickerRow}>
            <BrandMark height={16} />
            <Text style={styles.kicker}>PUCKIQ PRO</Text>
          </View>
          <Text style={styles.title}>Win your{'\n'}week.</Text>
          <Text style={styles.lede}>
            Your best lineup, every move before lock, and pickups for your empty nights.
          </Text>

          {status.isPro ? (
            <View style={styles.activeCard} testID="pro-active">
              <Ionicons name="checkmark-circle" size={18} color={colors.good} />
              <Text style={styles.activeText}>
                {proAccessCopy(status)}
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
                  {savings ? <Text style={styles.planBadge}>SAVE {savings}%</Text> : <Text style={[styles.planBadge, styles.planBadgeHidden]}> </Text>}
                  <Text style={styles.planName}>Season pass</Text>
                  <Text style={[styles.planPrice, !annualPrice && styles.pricePlaceholder]} numberOfLines={1}>{annualPrice ?? pricePlaceholder}</Text>
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
                  <Text style={[styles.planPrice, !monthlyPrice && styles.pricePlaceholder]} numberOfLines={1}>{monthlyPrice ?? pricePlaceholder}</Text>
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
                disabled={busy || !selected || !selectedPrice}
                testID="pro-subscribe"
              />
              <Text style={styles.renewal} testID="pro-renewal">
                {renewal ? `${trial ? `${trial[0].toUpperCase()}${trial.slice(1)}, then ${renewal}. ` : `${renewal}, renews automatically. `}Cancel anytime.` : 'Prices are provided by the App Store. No purchase is available until they load.'}
              </Text>
              {!storeLoading && !selectedPrice ? (
                <Pressable onPress={() => setStoreAttempt((attempt) => attempt + 1)} style={styles.restore} testID="pro-retry-store" accessibilityRole="button">
                  <Text style={styles.restoreText}>Retry App Store</Text>
                </Pressable>
              ) : null}
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
