/**
 * Settings → Player alerts: a push when one of my players is scratched or scores.
 */

import React from 'react';
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAlerts } from '../AlertsProvider';
import { Card, colors, SectionLabel } from '../coach/ui';

export function AlertsCard() {
  const alerts = useAlerts();
  const { settings } = alerts;

  const toggle = async (on: boolean) => {
    if (!on) {
      await alerts.disable();
      return;
    }
    const ok = await alerts.enable();
    if (!ok) {
      Alert.alert('Alerts need notifications', 'Turn on notifications for PuckIQ in iOS Settings to get scratch and goal alerts.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
    }
  };

  const chips: { key: 'scratches' | 'goals'; label: string }[] = [
    { key: 'scratches', label: 'Scratches' },
    { key: 'goals', label: 'Goals' },
  ];

  return (
    <>
      <SectionLabel title="Player alerts" />
      <Card>
        <View style={styles.row}>
          <Ionicons name="notifications-outline" size={20} color={colors.text} />
          <View style={styles.text}>
            <Text style={styles.label}>Scratches and goals for my players</Text>
            <Text style={styles.detail}>A push the moment the NHL lists one of yours as scratched, or one of yours scores.</Text>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={toggle}
            trackColor={{ true: colors.accent, false: colors.raised }}
            testID="alerts-toggle"
          />
        </View>
        {settings.enabled ? (
          <View style={styles.chips}>
            {chips.map((chip) => {
              const on = settings[chip.key];
              return (
                <Pressable
                  key={chip.key}
                  onPress={() => alerts.update({ [chip.key]: !on })}
                  style={[styles.chip, on && styles.chipOn]}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: on }}
                  testID={`alerts-${chip.key}`}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{chip.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '700', color: colors.text },
  detail: { fontSize: 13, lineHeight: 18, color: colors.sub },
  chips: { flexDirection: 'row', gap: 8, marginTop: 12, marginLeft: 32 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.raised },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontSize: 13, fontWeight: '800', color: colors.sub },
  chipTextOn: { color: colors.onInk },
});
