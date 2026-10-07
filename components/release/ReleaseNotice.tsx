import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { RELEASE_FEATURES, RELEASE_NOTICE_ID } from '../../constants/release';
import { proAccessCopy } from '../../services/proAccessCopy';
import { RELEASE_NOTICE_KEY, shouldShowReleaseNotice } from '../../services/releaseNotice';
import { getOriginalDownloadDate, restorePurchases } from '../../services/subscription';
import { track } from '../../services/analytics/track';
import { useSubscription } from '../SubscriptionProvider';
import { BrandMark, colors, display, GhostButton, PrimaryButton } from '../coach/ui';

export function ReleaseNotice({ hadSavedSetup, replay = false, onClose }: {
  hadSavedSetup: boolean;
  replay?: boolean;
  onClose?: () => void;
}) {
  const { status, loading, applyStatus } = useSubscription();
  const [visible, setVisible] = useState(replay);
  const [restoring, setRestoring] = useState(false);
  useEffect(() => { if (visible) track('release_notice_view', { replay }); }, [visible, replay]);

  useEffect(() => {
    if (loading || replay) return;
    let cancelled = false;
    Promise.all([AsyncStorage.getItem(RELEASE_NOTICE_KEY), getOriginalDownloadDate()]).then(([seen, date]) => {
      if (!cancelled) setVisible(shouldShowReleaseNotice(seen, date, hadSavedSetup));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [loading, hadSavedSetup, replay]);

  const close = async () => {
    track('release_notice_dismiss', { replay });
    try { await AsyncStorage.setItem(RELEASE_NOTICE_KEY, RELEASE_NOTICE_ID); } catch { /* Retry next launch. */ }
    setVisible(false);
    onClose?.();
  };

  const restore = async () => {
    setRestoring(true);
    try {
      const restored = await restorePurchases();
      track('loyalty_restore', { is_pro: restored.isPro });
      applyStatus(restored);
      if (!restored.isPro) Alert.alert('Access not found yet', 'Check that you are using your original Apple ID. Contact support in Settings if your earlier purchase is still missing.');
    } finally { setRestoring(false); }
  };

  if (!visible) return null;
  const giftCopy = proAccessCopy(status);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close} testID="release-notice">
      <View style={styles.frame}>
        <ScrollView contentContainerStyle={styles.body}>
          <BrandMark height={22} />
          <Text style={styles.kicker}>WELCOME BACK · PUCKIQ 3.0</Text>
          <Text style={styles.title}>YOUR NEW{'\n'}NIGHTLY COACH.</Text>
          <Text style={styles.intro}>PuckIQ has been rebuilt for your fantasy roster. Fantasy coaching replaces the earlier game-prediction and pick-tracking screens. Add your players, then make the moves in your usual fantasy app.</Text>
          {RELEASE_FEATURES.map((feature) => (
            <View key={feature.title} style={styles.feature}>
              <Ionicons name={feature.icon} size={23} color={colors.accent} />
              <View style={styles.copy}><Text style={styles.featureTitle}>{feature.title}</Text><Text style={styles.detail}>{feature.body}</Text></View>
            </View>
          ))}
          <View style={styles.gift}><Text style={styles.giftTitle}>A thank-you for being early</Text><Text style={styles.giftCopy}>{giftCopy}</Text></View>
          <PrimaryButton label="Meet my coach" onPress={close} testID="release-notice-continue" />
          <GhostButton label={restoring ? 'Restoring…' : 'Restore purchases'} onPress={() => { if (!restoring) void restore(); }} testID="release-notice-restore" />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 28, paddingTop: 42, paddingBottom: 48, gap: 22, maxWidth: 620, width: '100%', alignSelf: 'center' },
  kicker: { color: colors.sub, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { ...display(40), lineHeight: 43 },
  intro: { color: colors.sub, fontSize: 16, lineHeight: 24 },
  feature: { flexDirection: 'row', gap: 14 },
  copy: { flex: 1, gap: 4 },
  featureTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  detail: { color: colors.sub, fontSize: 14, lineHeight: 21 },
  gift: { backgroundColor: colors.ink, padding: 20, borderRadius: 18, gap: 10 },
  giftTitle: { color: colors.onInk, fontWeight: '800', fontSize: 18 },
  giftCopy: { color: colors.onInkSub, fontSize: 15, lineHeight: 23 },
});
