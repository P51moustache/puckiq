import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { FantasyTeam } from '../../types/fantasy';
import { needsPersonalRoster, opportunityCopy, type ProOpportunity } from '../../services/fantasy/proOpportunity';
import { Card, colors } from './ui';

export function ProOpportunityCard({ team, opportunity }: { team: FantasyTeam; opportunity?: ProOpportunity }) {
  if (needsPersonalRoster(team)) return null;
  const copy = opportunityCopy(team, opportunity);
  return (
    <Card style={styles.card} testID="pro-personal-preview">
      <Text style={styles.kicker}>FOR YOUR TEAM</Text>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.detail}>{copy.detail}</Text>
    </Card>
  );
}
const styles = StyleSheet.create({
  card: { gap: 6, marginTop: 12 },
  kicker: { color: colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  detail: { color: colors.sub, fontSize: 13, lineHeight: 19 },
});
