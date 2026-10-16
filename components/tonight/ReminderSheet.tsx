/**
 * Asks for game-night reminders from the bottom of Tonight, once the lineup call has shown
 * (hooks/useReminderPrompt decides when). Reference: concept A in
 * design/concepts/2026-10-15-onboarding-quick-pick. Drawn inside the screen rather than as a
 * native Modal, so it can't collide with the player sheet or paywall presenting at the same time.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatPuckDrop } from '../../services/nhl/dates';
import { reminderOfferLine } from '../../services/engagement/reminderPrompt';
import { colors, GhostButton, PrimaryButton } from '../coach/ui';
import { useBottomTabOverflow } from '../ui/TabBarBackground';

interface ReminderSheetProps {
  visible: boolean;
  /** First puck drop among my players tonight (UTC), or null when it isn't known. */
  firstPuck: string | null;
  minutesBefore: number;
  onAccept: () => Promise<unknown>;
  onDismiss: () => void;
}

export function ReminderSheet({ visible, firstPuck, minutesBefore, onAccept, onDismiss }: ReminderSheetProps) {
  // The iOS tab bar floats over the screen; keep the buttons above it.
  const tabBarHeight = useBottomTabOverflow();
  const [busy, setBusy] = useState(false);
  const progress = useEnter(visible);
  const accept = async () => {
    setBusy(true);
    try {
      await onAccept();
    } finally {
      setBusy(false);
    }
  };
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
        <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityLabel="Not now" testID="tonight-reminder-backdrop" />
      </Animated.View>
      <Animated.View
        style={[styles.sheet, { paddingBottom: tabBarHeight + 16, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [SLIDE_FROM, 0] }) }] }]} testID="tonight-reminder-prompt">
        <View style={styles.handle} />
        <Text style={styles.title}>{firstPuck ? `Lineup locks at ${formatPuckDrop(firstPuck)}` : 'Your players play tonight'}</Text>
        <Text style={styles.body}>{reminderOfferLine(minutesBefore, firstPuck, Date.now())}</Text>
        <PrimaryButton label="Remind me" icon="notifications-outline" onPress={accept} loading={busy} testID="reminder-prompt-on" />
        <GhostButton label="Not now" tone="neutral" onPress={onDismiss} testID="reminder-prompt-later" />
      </Animated.View>
    </View>
  );
}

/** Starts the sheet below the screen edge; the slide covers the sheet's own height and then some. */
const SLIDE_FROM = 320;
const ENTER_MS = 280;

/** 0 → 1 once on mount: drives the backdrop fade and the sheet's slide up. */
function useEnter(visible: boolean): Animated.Value {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }
    Animated.timing(progress, { toValue: 1, duration: ENTER_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, progress]);
  return progress;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.raised, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 10, gap: 10 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.track, marginBottom: 6 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 21, color: colors.sub, marginBottom: 6 },
});
