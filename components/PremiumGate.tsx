import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { useSubscription } from './SubscriptionProvider';

export interface PremiumGateProps {
  children: React.ReactNode;
  feature: string;
  onUpgrade?: () => void;
}

export default function PremiumGate({ children, feature, onUpgrade }: PremiumGateProps) {
  const { isPremium } = useSubscription();

  if (isPremium) return <>{children}</>;

  return (
    <View style={styles.wrapper} testID="premium-gate">
      <View style={styles.contentDimmed} pointerEvents="none">
        {children}
      </View>
      <View style={styles.overlay} testID="premium-gate-overlay">
        <Ionicons name="lock-closed" size={32} color={theme.accent} />
        <Text style={styles.featureText}>{feature}</Text>
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={onUpgrade}
          testID="premium-gate-upgrade"
          activeOpacity={0.8}
        >
          <Text style={styles.upgradeText}>Unlock with PuckIQ Pro</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
  },
  contentDimmed: {
    opacity: 0.3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 16, 35, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    padding: 24,
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
  },
  upgradeButton: {
    backgroundColor: theme.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 4,
  },
  upgradeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
