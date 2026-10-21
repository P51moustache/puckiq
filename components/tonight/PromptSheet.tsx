/**
 * The frame Tonight's asks share (game-night reminders, the review ask): a dimmed backdrop that
 * dismisses on tap and a raised sheet that slides up above the tab bar. Drawn inside the screen
 * rather than as a native Modal, so it can't collide with the player sheet or paywall presenting
 * at the same time.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../coach/ui';
import { useBottomTabOverflow } from '../ui/TabBarBackground';

interface PromptSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Read out for the backdrop, which closes the sheet. */
  dismissLabel: string;
  testID: string;
  backdropTestID: string;
  children: React.ReactNode;
}

export function PromptSheet({ visible, onDismiss, dismissLabel, testID, backdropTestID, children }: PromptSheetProps) {
  // The iOS tab bar floats over the screen; keep the buttons above it.
  const tabBarHeight = useBottomTabOverflow();
  const progress = useEnter(visible);
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
        <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityLabel={dismissLabel} testID={backdropTestID} />
      </Animated.View>
      <Animated.View
        style={[styles.sheet, { paddingBottom: tabBarHeight + 16, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [SLIDE_FROM, 0] }) }] }]} testID={testID}>
        <View style={styles.handle} />
        {children}
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

/** Headline and body type both asks use. */
export const promptText = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 21, color: colors.sub, marginBottom: 6 },
});

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.raised, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 10, gap: 10 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.track, marginBottom: 6 },
});
