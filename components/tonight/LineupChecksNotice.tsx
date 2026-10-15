import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { incompleteChecks, type NamedCheck } from '../../services/fantasy/lineupChecks';
import { Card, colors, GhostButton } from '../coach/ui';

/** Free, visible before the advice. Fresh checks do not imply a guaranteed healthy lineup. */
export function LineupChecksNotice({ checks, now, refreshing, onRetry }: {
  checks: readonly NamedCheck[]; now: number; refreshing: boolean; onRetry: () => void;
}) {
  const issues = incompleteChecks(checks, now);
  if (!issues.length) return null;
  return (
    <Card style={styles.card} testID="lineup-checks-notice">
      <Text style={styles.title}>Some lineup checks are incomplete</Text>
      <Text style={styles.body}>{issues.join('\n')}</Text>
      <Text style={styles.body}>Advice uses the information available. Verify availability in your fantasy league before lock.</Text>
      {refreshing ? <Text style={styles.body}>Checking…</Text> : <GhostButton label="Retry checks" icon="refresh" tone="neutral" onPress={onRetry} testID="lineup-checks-retry" />}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, marginBottom: 12, borderColor: colors.warn },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  body: { color: colors.sub, fontSize: 13, lineHeight: 19 },
});
