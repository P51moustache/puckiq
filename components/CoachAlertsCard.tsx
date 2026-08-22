import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { rinkGlass } from '../constants/theme';
import { COACH_ALERT_COPY } from '../services/coachSuggestions';
import { requestNotificationPermissions } from '../services/notifications';

export default function CoachAlertsCard() {
  const [status, setStatus] = useState<string | null>(null);

  const handleAllow = async () => {
    const ok = await requestNotificationPermissions();
    setStatus(ok
      ? 'Alerts allowed. Copy is ready; server push still attaches to YOUR roster later.'
      : 'Permission not granted. You can still use Tonight without alerts.');
  };

  return (
    <View style={styles.card} testID="coach-alerts">
      <Text style={styles.kicker}>PRO ALERTS</Text>
      <Text style={styles.title}>Only for MY players</Text>
      {COACH_ALERT_COPY.map((item) => (
        <View key={item.id} style={styles.row} testID={`coach-alert-${item.id}`}>
          <Text style={styles.alertTitle}>{item.title}</Text>
          <Text style={styles.alertBody}>{item.body}</Text>
        </View>
      ))}
      <TouchableOpacity style={styles.button} onPress={handleAllow} testID="coach-alerts-permission">
        <Text style={styles.buttonText}>Allow roster alerts</Text>
      </TouchableOpacity>
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: rinkGlass.glass,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    padding: 16,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: rinkGlass.blueLight,
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    marginBottom: 12,
  },
  row: {
    marginBottom: 10,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
  },
  alertBody: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  button: {
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: rinkGlass.blueLight,
    alignItems: 'center',
  },
  buttonText: {
    color: '#0a0e1a',
    fontWeight: '800',
  },
  status: {
    marginTop: 8,
    fontSize: 12,
    color: rinkGlass.textMuted,
    lineHeight: 16,
  },
});
