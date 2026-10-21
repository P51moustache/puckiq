/**
 * "Enjoying PuckIQ?" from the bottom of Tonight, after a good night shows in the recap
 * (hooks/useReviewPrompt decides when; services/engagement/reviewPrompt words it). Reference:
 * concept B in docs/design/review-prompt — the night's stamp, then two equal answers. "Loving it"
 * only hands over to Apple, which may not show anything, so the sheet never promises a dialog.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NightScore } from '../../services/fantasy/nightScore';
import { reviewAskCopy } from '../../services/engagement/reviewPrompt';
import { colors, display, GhostButton, PrimaryButton } from '../coach/ui';
import { PromptSheet, promptText } from './PromptSheet';

interface ReviewSheetProps {
  visible: boolean;
  /** The recap the ask follows; the stamp is left off without it. */
  recap: NightScore | null;
  isPro: boolean;
  onYes: () => void;
  onNotReally: () => void;
  onDismiss: () => void;
}

export function ReviewSheet({ visible, recap, isPro, onYes, onNotReally, onDismiss }: ReviewSheetProps) {
  const copy = reviewAskCopy(recap, isPro);
  return (
    <PromptSheet visible={visible} onDismiss={onDismiss} dismissLabel="Close" testID="tonight-review-prompt" backdropTestID="tonight-review-backdrop">
      {copy.stamp || copy.points ? (
        <View style={styles.stampRow}>
          {copy.stamp ? (
            <View style={styles.stamp}>
              <Text style={styles.stampText} numberOfLines={1}>{copy.stamp}</Text>
            </View>
          ) : null}
          {copy.points ? <Text style={styles.points}>{copy.points}</Text> : null}
        </View>
      ) : null}
      <Text style={promptText.title}>
        {copy.title === 'Enjoying PuckIQ?' ? copy.title : `${copy.title}\nEnjoying PuckIQ?`}
      </Text>
      <Text style={promptText.body}>Tell us either way.</Text>
      <View style={styles.answers}>
        <GhostButton label="Not really" icon="thumbs-down-outline" tone="neutral" onPress={onNotReally} style={styles.answer} testID="review-prompt-no" />
        <PrimaryButton label="Loving it" icon="thumbs-up-outline" onPress={onYes} style={styles.answer} testID="review-prompt-yes" />
      </View>
    </PromptSheet>
  );
}

const styles = StyleSheet.create({
  stampRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stamp: { backgroundColor: colors.good, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, flexShrink: 1 },
  stampText: { ...display(14), color: colors.bg, letterSpacing: 0.4 },
  points: { ...display(22), color: colors.text },
  answers: { flexDirection: 'row', gap: 10 },
  answer: { flex: 1 },
});
