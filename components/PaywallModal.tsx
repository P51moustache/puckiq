import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme } from '../constants/theme';
import { purchasePackage, restorePurchases, getOfferings } from '../services/subscription';
import { useSubscription } from './SubscriptionProvider';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  featureHeadline?: string;
}

export default function PaywallModal({
  visible,
  onClose,
  featureHeadline = 'Unlock Premium Analytics',
}: PaywallModalProps) {
  const { refresh } = useSubscription();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

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
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            testID="paywall-close"
            disabled={isLoading}
          >
            <Text style={styles.closeText}>X</Text>
          </TouchableOpacity>

          {/* Header */}
          <Text style={styles.headline}>{featureHeadline}</Text>
          <Text style={styles.subheadline}>
            Get deeper insights, advanced models, and premium predictions to elevate your hockey analytics.
          </Text>

          {/* Benefits */}
          <View style={styles.benefitsContainer}>
            {['ML-powered game predictions', 'Advanced player analytics', 'Custom model builder', 'Ad-free experience'].map((benefit) => (
              <View key={benefit} style={styles.benefitRow}>
                <Text style={styles.checkmark}>{'✓'}</Text>
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>

          {/* Pricing options */}
          <TouchableOpacity
            style={styles.annualButton}
            onPress={() => handlePurchase('annual')}
            testID="paywall-annual"
            disabled={isLoading}
          >
            {purchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.annualLabel}>Annual</Text>
                <Text style={styles.annualPrice}>$49.99/yr</Text>
                <Text style={styles.annualSave}>Save 40%</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.monthlyButton}
            onPress={() => handlePurchase('monthly')}
            testID="paywall-monthly"
            disabled={isLoading}
          >
            <Text style={styles.monthlyLabel}>Monthly</Text>
            <Text style={styles.monthlyPrice}>$6.99/mo</Text>
          </TouchableOpacity>

          {/* Trial CTA */}
          <Text style={styles.trialText}>Start 7-Day Free Trial</Text>

          {/* Restore */}
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            testID="paywall-restore"
            disabled={isLoading}
          >
            {restoring ? (
              <ActivityIndicator color={theme.subtext} size="small" />
            ) : (
              <Text style={styles.restoreText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  container: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.factbox,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  closeText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '700',
  },
  headline: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  subheadline: {
    fontSize: 14,
    color: theme.subtext,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  benefitsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  checkmark: {
    color: theme.accent,
    fontSize: 16,
    fontWeight: '700',
    marginRight: 10,
  },
  benefitText: {
    color: theme.text,
    fontSize: 15,
  },
  annualButton: {
    width: '100%',
    backgroundColor: theme.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  annualLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  annualPrice: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  annualSave: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  monthlyButton: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.accent,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  monthlyLabel: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  monthlyPrice: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  trialText: {
    color: theme.subtext,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 16,
  },
  restoreButton: {
    paddingVertical: 8,
  },
  restoreText: {
    color: theme.subtext,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
