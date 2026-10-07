import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { FREE_FEATURES } from '../../constants/monetization';
import { MANAGE_SUBSCRIPTIONS_URL } from '../../constants/legal';
import { restorePurchases } from '../../services/subscription';
import { proAccessCopy } from '../../services/proAccessCopy';
import { useSubscription } from '../SubscriptionProvider';
import { usePaywall } from '../PaywallProvider';
import { Card, colors, display, Pill, PrimaryButton, ProBadge } from '../coach/ui';

export function PlanCard() {
  const { isPremium, status, applyStatus } = useSubscription();
  const { openPaywall } = usePaywall();
  const [restoring, setRestoring] = useState(false);
  const restore = async () => {
    setRestoring(true);
    try {
      const next = await restorePurchases();
      applyStatus(next);
      Alert.alert(next.isPro ? 'Pro restored' : 'Access not found yet', next.isPro ? 'Welcome back.' : 'Check your original Apple ID. Contact support if your earlier purchase is missing.');
    } finally { setRestoring(false); }
  };
  return (
    <Card style={styles.card} testID="plan-section">
      <View style={styles.head}>
        {isPremium ? <ProBadge /> : <Pill label="FREE" tone="muted" solid />}
        <Text style={styles.title} testID="plan-tier">{isPremium ? 'PuckIQ Pro' : 'PuckIQ Free'}</Text>
      </View>
      {isPremium ? <Text style={styles.copy}>{proAccessCopy(status)}</Text> : (
        <>
          {FREE_FEATURES.map((line) => <Text key={line} style={styles.freeLine}>· {line}</Text>)}
          <PrimaryButton label="See Pro" icon="flash" onPress={() => openPaywall('settings')} style={styles.button} testID="settings-subscribe" />
        </>
      )}
      <View style={styles.links}>
        <Pressable onPress={restore} disabled={restoring} hitSlop={6} testID="settings-restore"><Text style={styles.link}>{restoring ? 'Restoring…' : 'Restore purchases'}</Text></Pressable>
        {status.source === 'subscription' ? <Pressable onPress={() => Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)} hitSlop={6}><Text style={styles.link}>Manage subscription</Text></Pressable> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 4, backgroundColor: colors.ink, borderRadius: 22, padding: 18 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { ...display(26), color: colors.onInk },
  copy: { fontSize: 14, lineHeight: 20, color: colors.onInkSub },
  freeLine: { fontSize: 14, lineHeight: 22, color: colors.onInkSub },
  button: { marginTop: 14 },
  links: { flexDirection: 'row', gap: 18, marginTop: 14 },
  link: { fontSize: 14, fontWeight: '800', color: colors.onInk },
});
