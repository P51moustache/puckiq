/**
 * "B2B" just under a goalie's bar on a back-to-back night, when tandems usually split the
 * starts. It hangs below the bar without taking layout space, so every bar in a row stays
 * level. The row's VoiceOver label names the nights (stints.rowAccessibilityLabel).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../coach/ui';
import { BACK_TO_BACK_MARK, PAST_OPACITY } from './gridMetrics';

export function BackToBackMark({ past, testID, children }: { past: boolean; testID?: string; children: React.ReactNode }) {
  return (
    <View style={styles.slot}>
      {children}
      <Text style={[styles.mark, past && styles.past]} maxFontSizeMultiplier={1} testID={testID}>
        B2B
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    // Full day width, like the bar it wraps.
    alignSelf: 'stretch',
  },
  mark: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: BACK_TO_BACK_MARK.gap,
    textAlign: 'center',
    fontSize: BACK_TO_BACK_MARK.size,
    lineHeight: BACK_TO_BACK_MARK.lineHeight,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: colors.sub,
  },
  past: {
    opacity: PAST_OPACITY,
  },
});
