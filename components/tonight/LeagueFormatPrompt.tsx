/**
 * One question for teams set up before PuckIQ coached category leagues: points or categories?
 * Answered once, with one tap. Teams that answered in setup or League settings never see it.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LeagueFormat } from '../../types/fantasy';
import { Card, colors, GhostButton, PrimaryButton } from '../coach/ui';
import { Kicker } from './Kicker';

export function LeagueFormatPrompt({ onAnswer }: { onAnswer: (format: LeagueFormat) => void }) {
  return (
    <Card style={styles.card} testID="tonight-format-prompt">
      <Kicker onInk={false} label="NEW · CATEGORY LEAGUES" />
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name="grid-outline" size={20} color={colors.onAccent} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>Points or categories?</Text>
          <Text style={styles.detail}>
            PuckIQ now coaches category leagues: every category counts when it ranks players, and your night shows category by
            category. How does your league score?
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <PrimaryButton label="Categories" onPress={() => onAnswer('categories')} style={styles.button} testID="format-prompt-categories" />
        <GhostButton label="Points" tone="neutral" onPress={() => onAnswer('points')} style={styles.button} testID="format-prompt-points" />
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
