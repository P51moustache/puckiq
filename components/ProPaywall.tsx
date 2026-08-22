/**
 * RevenueCat-ready Subscribe / Restore sheet.
 * Free users keep the core app; this only sells Pro extras.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { rinkGlass } from '../constants/theme';
import {
  LIST_PRICE_ANNUAL,
  LIST_PRICE_MONTHLY,
  PRO_UNLOCKS,
  isPaywallEnabled,
} from '../constants/monetization';
import { getOfferings, purchasePackage, restorePurchases } from '../services/subscription';
import { useSubscription } from './SubscriptionProvider';

interface ProPaywallProps {
  visible: boolean;
  onClose: () => void;
}

export default function ProPaywall({ visible, onClose }: ProPaywallProps) {
  const { refresh } = useSubscription();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [plan, setPlan] = useState<'annual' | 'monthly'>('annual');
  const busy = purchasing || restoring;

  const handlePurchase = async () => {
    if (!isPaywallEnabled()) {
      Alert.alert('Paywall off', 'Subscribe is flagged off in this build.');
      return;
    }
    setPurchasing(true);
    try {
      const offerings = await getOfferings();
      const pkg = plan === 'monthly'
        ? offerings?.current?.monthly
        : offerings?.current?.annual;
      if (!pkg) {
        Alert.alert(
          'Store not configured',
          `List price ${plan === 'annual' ? LIST_PRICE_ANNUAL : LIST_PRICE_MONTHLY}. Add RevenueCat / App Store products to complete purchase.`,
        );
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
      } else {
        Alert.alert('No Pro subscription found', 'Restore completed. Free tier is still available.');
      }
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      testID="pro-paywall"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} testID="pro-paywall-close" disabled={busy}>
            <Text style={styles.close}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.title}>PuckIQ Pro</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.lede}>
            Free keeps Tonight, News, and your manual roster. Pro is the hockey-season extras.
          </Text>

          {PRO_UNLOCKS.map((line) => (
            <Text key={line} style={styles.unlock}>{`• ${line}`}</Text>
          ))}

          <View style={styles.plans}>
            <TouchableOpacity
              style={[styles.plan, plan === 'annual' && styles.planOn]}
              onPress={() => setPlan('annual')}
              testID="pro-plan-annual"
            >
              <Text style={styles.planName}>Season</Text>
              <Text style={styles.planPrice}>{LIST_PRICE_ANNUAL}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.plan, plan === 'monthly' && styles.planOn]}
              onPress={() => setPlan('monthly')}
              testID="pro-plan-monthly"
            >
              <Text style={styles.planName}>Monthly</Text>
              <Text style={styles.planPrice}>{LIST_PRICE_MONTHLY}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.subscribe}
            onPress={handlePurchase}
            disabled={busy}
            testID="pro-subscribe"
          >
            {purchasing ? (
              <ActivityIndicator color="#0a0e1a" />
            ) : (
              <Text style={styles.subscribeText}>Subscribe</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.restore}
            onPress={handleRestore}
            disabled={busy}
            testID="pro-restore"
          >
            {restoring ? (
              <ActivityIndicator color={rinkGlass.textSecondary} />
            ) : (
              <Text style={styles.restoreText}>Restore purchases</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: rinkGlass.ice,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  close: {
    fontSize: 16,
    color: rinkGlass.textSecondary,
    width: 64,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.display,
  },
  headerSpacer: {
    width: 64,
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  lede: {
    fontSize: 15,
    lineHeight: 22,
    color: rinkGlass.textSecondary,
    marginBottom: 16,
  },
  unlock: {
    fontSize: 14,
    lineHeight: 22,
    color: rinkGlass.textPrimary,
    marginBottom: 6,
  },
  plans: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 20,
  },
  plan: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    backgroundColor: rinkGlass.glass,
  },
  planOn: {
    borderColor: rinkGlass.blueLight,
  },
  planName: {
    fontSize: 12,
    fontWeight: '700',
    color: rinkGlass.textSecondary,
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: rinkGlass.textPrimary,
  },
  subscribe: {
    backgroundColor: rinkGlass.blueLight,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  subscribeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0a0e1a',
  },
  restore: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  restoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: rinkGlass.blueLight,
  },
});
