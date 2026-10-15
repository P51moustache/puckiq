import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { FantasyTeam } from '../../types/fantasy';
import { rosterConfirmationState } from '../../services/rosterImport/rosterConfirmation';
import { Card, colors, GhostButton } from '../coach/ui';

export function RosterConfirmationCard({ team, onReview }: { team: FantasyTeam; onReview: () => void }) {
  const state = rosterConfirmationState(team);
  const check = team.rosterConfirmation;
  const date = check ? new Date(check.confirmedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;
  return <Card style={styles.card} testID="roster-confirmation">
    <Text style={styles.title}>{state === 'none' ? 'Check your roster' : state === 'changed' ? 'Roster changed since your last check' : state === 'complete' ? 'Roster names confirmed' : 'Partial roster check'}</Text>
    <Text style={styles.body}>{date ? `Last user confirmation: ${date}. ` : ''}{state === 'partial' ? `${check?.reviewedPlayerIds.length} names reviewed. ` : ''}Import your current team to review additions and departures together.</Text>
    <Text style={styles.body}>Names only · IR and league eligibility stay in player settings.</Text>
    <GhostButton label="Update from your league" icon="scan-outline" tone="neutral" onPress={onReview} testID="roster-check-update" />
  </Card>;
}
const styles = StyleSheet.create({
  card: { gap: 8, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 13, lineHeight: 19, color: colors.sub },
});
