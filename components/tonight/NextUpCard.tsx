/**
 * "Up next" at the bottom of Tonight: the one most useful next step, a single tap away
 * (services/fantasy/nextUp.ts decides which).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NextUpItem, NextUpKind } from '../../services/fantasy/nextUp';
import { colors } from '../coach/ui';
import { Kicker } from './Kicker';

const ICON: Record<NextUpKind, keyof typeof Ionicons.glyphMap> = {
  fill_slot: 'add-circle-outline',
  hot_player: 'flame-outline',
  tomorrow: 'calendar-outline',
  matchup: 'git-compare-outline',
  week: 'grid-outline',
};

export function NextUpCard({ item, onPress }: { item: NextUpItem; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Up next: ${item.title}. ${item.detail}`}
      testID="tonight-next-up"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Kicker label="UP NEXT" />
      <View style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name={ICON[item.kind]} size={20} color={colors.onInk} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.detail}>{item.detail}</Text>
        </View>
        <View style={styles.go}>
          <Ionicons name="arrow-forward" size={18} color={colors.onAccent} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 18, borderRadius: 18, padding: 16, gap: 12, backgroundColor: colors.ink },
  pressed: { opacity: 0.85 },
  body: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.inkRaised },
  text: { flex: 1, gap: 3 },
  title: { fontSize: 17, fontWeight: '800', color: colors.onInk },
  detail: { fontSize: 13, lineHeight: 18, color: colors.onInkSub },
  go: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
});
