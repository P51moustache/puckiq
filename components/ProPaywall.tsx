import { styles } from './ProPaywall.styles';
/**
 * PuckIQ Pro sheet. Prices come from the store (RevenueCat offerings); the list
 * prices in constants/monetization are only a fallback label.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { openLink } from '../services/native/deviceLinks';
import { FREE_STATUS, getOfferings, getTrialEligibility, purchasePackageWithDetails, restorePurchases } from '../services/subscription';
import { proAccessCopy } from '../services/proAccessCopy';
import { packagePrice, packageProperties, trialLabel } from '../services/paywallProducts';
import { usePaywallJourney } from '../hooks/usePaywallJourney';
import { useSubscription } from './SubscriptionProvider';
import { BrandMark, colors, PrimaryButton } from './coach/ui';
import type { FantasyTeam } from '../types/fantasy';
import type { ProOpportunity } from '../services/fantasy/proOpportunity';
import { ProOpportunityCard } from './coach/ProOpportunityCard';

export { trialLabel } from '../services/paywallProducts';

interface ProPaywallProps {
  visible: boolean;
  onClose: () => void;
  source?: PaywallSource;
  team?: FantasyTeam | null;
  opportunity?: ProOpportunity;
}

type Plan = 'annual' | 'monthly';

export default function ProPaywall({ visible, onClose, source = 'settings', team, opportunity }: ProPaywallProps) {
  const { refresh, applyStatus, status = FREE_STATUS } = useSubscription();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [plan, setPlan] = useState<Plan>('annual');
  const [packages, setPackages] = useState<{ annual: PurchasesPackage | null; monthly: PurchasesPackage | null }>({ annual: null, monthly: null });
  const [trialEligibility, setTrialEligibility] = useState<Record<string, boolean>>({});
  const [storeLoading, setStoreLoading] = useState(true);
  const [storeAttempt, setStoreAttempt] = useState(0);
  const busy = purchasing || restoring;
  const journey = usePaywallJourney(visible, source);
  const close = (reason = 'close_button') => {
    if (busy) return;
    journey.close(reason);
    onClose();
  };
  const selectPlan = (next: Plan) => {
    if (next === plan) return;
    journey.record('paywall_plan_select', { plan: next, previous_plan: plan });
    setPlan(next);
  };

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const startedAt = Date.now();
    setStoreLoading(true);
    setPackages({ annual: null, monthly: null });
    setTrialEligibility({});
    getOfferings().then((offerings) => {
      if (cancelled) return;
      const next = { annual: offerings?.current?.annual ?? null, monthly: offerings?.current?.monthly ?? null };
      setPackages(next);
      journey.record('paywall_store_result', {
        result: packagePrice(next.annual) || packagePrice(next.monthly) ? 'available' : 'unavailable',
        annual_available: !!packagePrice(next.annual), monthly_available: !!packagePrice(next.monthly),
        load_ms: Math.max(0, Date.now() - startedAt), retry: storeAttempt > 0,
      });
      const ids = Object.values(next).flatMap((pkg) => pkg?.product?.identifier ? [pkg.product.identifier] : []);
      getTrialEligibility(ids).then((eligible) => {
        if (cancelled) return;
        setTrialEligibility(eligible);
        const eligibility = (pkg: PurchasesPackage | null) => {
          const value = pkg?.product?.identifier ? eligible[pkg.product.identifier] : undefined;
          return value === undefined ? 'unknown' : value ? 'eligible' : 'ineligible';
        };
        journey.record('paywall_trial_eligibility', { annual: eligibility(next.annual), monthly: eligibility(next.monthly) });
      });
    }).catch(() => {
      if (!cancelled) journey.record('paywall_store_result', { result: 'error', load_ms: Math.max(0, Date.now() - startedAt) });
    }).finally(() => { if (!cancelled) setStoreLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [visible, source, storeAttempt, journey]);

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
      journey.record('paywall_checkout_blocked', { reason: 'disabled', plan });
      Alert.alert('Subscriptions are off', 'Purchases are disabled in this build.');
      return;
    }
    if (!selected || !packagePrice(selected)) {
      journey.record('paywall_checkout_blocked', { reason: 'store_unavailable', plan });
      Alert.alert('Store unavailable', 'We couldn’t reach the App Store. Check your connection and try again.');
      return;
    }
    setPurchasing(true);
    const startedAt = Date.now();
    const product = packageProperties(selected);
    journey.record('paywall_checkout_started', { plan, ...product, trial_offered: !!trial });
    try {
      const outcome = await purchasePackageWithDetails(selected);
      journey.record('paywall_purchase', { plan, ...product, ...outcome, checkout_ms: Math.max(0, Date.now() - startedAt) });
      if (outcome.result === 'purchased') {
        await refresh();
        journey.close('access_granted');
        onClose();
      } else if (outcome.result === 'failed') {
        Alert.alert('Purchase didn’t go through', 'You weren’t charged. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    journey.record('paywall_restore_started');
    try {
      const restored = await restorePurchases();
      journey.record('paywall_restore', { result: restored.isPro ? 'pro' : 'none', pro_source: restored.source ?? 'none', store_environment: restored.storeEnvironment ?? 'unknown', subscription_period: restored.periodType ?? 'unknown' });
      if (restored.isPro) {
        applyStatus(restored);
        journey.close('restored');
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => close('system_close')} testID="pro-paywall">
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => close()} disabled={busy} hitSlop={10} testID="pro-paywall-close" accessibilityLabel="Close">
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
          {team && !status.isPro ? <ProOpportunityCard team={team} opportunity={opportunity} /> : null}

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
            <Text style={styles.link} onPress={() => void openLink(TERMS_URL, 'terms')} accessibilityRole="link">
              Terms of Use
            </Text>
            {PRIVACY_URL ? (
              <Text style={styles.link} onPress={() => void openLink(PRIVACY_URL, 'privacy')} accessibilityRole="link">
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
                  onPress={() => selectPlan('annual')}
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
                  onPress={() => selectPlan('monthly')}
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
                <Pressable onPress={() => { journey.record('paywall_store_retry'); setStoreAttempt((attempt) => attempt + 1); }} style={styles.restore} testID="pro-retry-store" accessibilityRole="button">
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
