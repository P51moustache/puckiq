/**
 * Future sports-ad slot. Never loads AdMob.
 * Hidden unless EXPO_PUBLIC_SHOW_AD_SLOT=1 and the user is not Pro.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { rinkGlass } from '../constants/theme';
import { isAdSlotEnabled } from '../constants/monetization';
import { useSubscription } from './SubscriptionProvider';

export default function SportsAdSlot() {
  const { isPremium } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  if (!isAdSlotEnabled() || isPremium || dismissed) {
    return null;
  }

  return (
    <View style={styles.wrap} testID="sports-ad-slot">
      <View style={styles.row}>
        <Text style={styles.label}>AD SLOT</Text>
        <TouchableOpacity onPress={() => setDismissed(true)} testID="sports-ad-dismiss">
          <Text style={styles.dismiss}>Dismiss</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.copy}>
        Quiet slot only. Never a full-screen ad after a roster move. No AdMob.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    backgroundColor: rinkGlass.boards,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: rinkGlass.textMuted,
  },
  dismiss: {
    fontSize: 12,
    fontWeight: '600',
    color: rinkGlass.blueLight,
  },
  copy: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
    lineHeight: 16,
  },
});
