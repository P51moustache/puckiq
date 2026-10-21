/**
 * Asks for game-night reminders from the bottom of Tonight, once the lineup call or recap has
 * shown (hooks/useReminderPrompt decides when; services/engagement/reminderPrompt words it). Reference: concept A in
 * design/concepts/2026-10-15-onboarding-quick-pick. The frame is PromptSheet.
 */

import React, { useState } from 'react';
import { Text } from 'react-native';
import { reminderOfferCopy, type ReminderMoment } from '../../services/engagement/reminderPrompt';
import { GhostButton, PrimaryButton } from '../coach/ui';
import { PromptSheet, promptText } from './PromptSheet';

interface ReminderSheetProps {
  visible: boolean;
  /** Which offer to make; the sheet stays hidden without one. */
  moment: ReminderMoment | null;
  /** First puck drop among my players tonight (UTC), or null when it isn't known. */
  firstPuck: string | null;
  minutesBefore: number;
  onAccept: () => Promise<unknown>;
  onDismiss: () => void;
}

export function ReminderSheet({ visible, moment, firstPuck, minutesBefore, onAccept, onDismiss }: ReminderSheetProps) {
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    try {
      await onAccept();
    } finally {
      setBusy(false);
    }
  };
  const copy = moment ? reminderOfferCopy(moment, minutesBefore, firstPuck, Date.now()) : null;
  return (
    <PromptSheet visible={visible && !!copy} onDismiss={onDismiss} dismissLabel="Not now" testID="tonight-reminder-prompt" backdropTestID="tonight-reminder-backdrop">
      {copy ? (
        <>
          <Text style={promptText.title}>{copy.title}</Text>
          <Text style={promptText.body}>{copy.body}</Text>
          <PrimaryButton label="Remind me" icon="notifications-outline" onPress={accept} loading={busy} testID="reminder-prompt-on" />
          <GhostButton label="Not now" tone="neutral" onPress={onDismiss} testID="reminder-prompt-later" />
        </>
      ) : null}
    </PromptSheet>
  );
}
