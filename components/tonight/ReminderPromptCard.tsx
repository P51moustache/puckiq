/**
 * Offers game-night reminders on Tonight, on a night when my players play — the moment the
 * reminder is obviously useful (hooks/useReminderPrompt decides when).
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, colors, GhostButton, PrimaryButton } from '../coach/ui';
import { Kicker } from './Kicker';

export function ReminderPromptCard({ onAccept, onDismiss }: { onAccept: () => Promise<unknown>; onDismiss: () => void }) {
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    try {
      await onAccept();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={styles.card} testID="tonight-reminder-prompt">
      <Kicker onInk={false} label="GAME NIGHT" />
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name="notifications" size={20} color={colors.onAccent} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>Want a heads-up tonight?</Text>
          <Text style={styles.detail}>One before your first puck drop, and one when your night goes live.</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <PrimaryButton label="Turn on" icon="notifications-outline" onPress={accept} loading={busy} style={styles.button} testID="reminder-prompt-on" />
        <GhostButton label="Not now" tone="neutral" onPress={onDismiss} style={styles.button} testID="reminder-prompt-later" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  text: { flex: 1, gap: 3 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  detail: { fontSize: 13, lineHeight: 18, color: colors.sub },
  actions: { flexDirection: 'row', gap: 10 },
  button: { flex: 1 },
});
