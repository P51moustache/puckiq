import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FantasyTeam } from '../../types/fantasy';
import { applyRosterReconciliation, reconcileRoster, type RosterProposal } from '../../services/rosterImport/reconcileRoster';
import type { RosterCoverage } from '../../services/rosterImport/rosterConfirmation';
import { newInstallId } from '../../services/analytics/posthog';
import { Card, colors, GhostButton, PrimaryButton } from '../coach/ui';

export function RosterReconcileReview({ team, proposal, onUpdate, onBack, onApplied }: {
  team: FantasyTeam; proposal: RosterProposal;
  onUpdate: (update: (current: FantasyTeam) => FantasyTeam, teamId: string) => void;
  onBack: () => void; onApplied: () => void;
}) {
  const [coverage, setCoverage] = useState<RosterCoverage>('partial');
  const [removeIds, setRemoveIds] = useState<ReadonlySet<number>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const completed = useRef(false);
  const changes = reconcileRoster(team, proposal, coverage, removeIds);
  useEffect(() => {
    if (!pendingId || completed.current) return;
    if (team.id === proposal.teamId && team.rosterConfirmation?.id === pendingId) {
      completed.current = true;
      onApplied();
    } else {
      setPendingId(null);
      setCommitError('The update was not applied. Go back and review your current roster again.');
    }
  }, [pendingId, team, proposal.teamId, onApplied]);

  const apply = () => {
    if (changes.error || pendingId) return;
    const receipt = { id: newInstallId(), confirmedAt: new Date().toISOString() };
    setPendingId(receipt.id);
    setCommitError(null);
    onUpdate((current) => applyRosterReconciliation(current, proposal, coverage, removeIds, receipt), proposal.teamId);
  };
  return (
    <View style={styles.stack} testID="roster-reconciliation">
      <Text style={styles.title}>Review roster changes</Text>
      <Text style={styles.body}>Apply this snapshot to {team.name}. Make sure it belongs to this league.</Text>
      <Card style={styles.stack}>
        <Text style={styles.label}>ADD {changes.additions.length} · KEEP {changes.retained.length} MATCHED</Text>
        {changes.additions.map((player) => <Text style={styles.body} key={player.playerId}>+ {player.playerName} · {player.teamAbbrev}</Text>)}
        {!changes.additions.length ? <Text style={styles.body}>No new players to add.</Text> : null}
        <Text style={styles.body}>Existing IR, league eligibility and local slots stay as saved. New players enter your PuckIQ bench; review their settings after applying.</Text>
      </Card>
      {changes.identityUpdates.length ? <Card style={styles.stack}>
        <Text style={styles.label}>NHL PLAYER DETAILS UPDATED</Text>
        {changes.identityUpdates.map(({ before, after }) => <Text key={after.playerId} style={styles.body}>{after.playerName}: {before.teamAbbrev} {before.position} → {after.teamAbbrev} {after.position}</Text>)}
      </Card> : null}
      <Card style={styles.stack}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: coverage === 'complete', disabled: proposal.unresolved > 0 }}
          disabled={proposal.unresolved > 0} testID="roster-full-snapshot" style={styles.choice}
          onPress={() => { setCoverage(coverage === 'complete' ? 'partial' : 'complete'); setRemoveIds(new Set()); }}>
          <Text style={styles.check}>{coverage === 'complete' ? '☑' : '☐'}</Text>
          <Text style={styles.choiceText}>This includes my whole roster, bench and IR</Text>
        </Pressable>
        <Text style={styles.body}>{proposal.unresolved > 0 ? `${proposal.unresolved} unresolved ${proposal.unresolved === 1 ? 'name' : 'names'}. Go back to resolve them, or apply a partial update that keeps unseen players.` : 'Leave this unchecked for cropped screenshots or an incomplete list. Unseen players will stay.'}</Text>
      </Card>
      {changes.unseen.length ? <Card style={styles.stack}>
        <Text style={styles.label}>NOT SHOWN IN THIS IMPORT · {changes.unseen.length}</Text>
        <Text style={styles.body}>{coverage === 'complete' ? 'Select only players you have verified are no longer on your real roster.' : 'These players stay in PuckIQ. A partial import never removes them.'}</Text>
        {changes.unseen.map((player) => coverage === 'complete' ? (
          <Pressable key={player.playerId} accessibilityRole="checkbox" accessibilityState={{ checked: removeIds.has(player.playerId) }}
            testID={`roster-remove-${player.playerId}`} style={styles.choice}
            onPress={() => setRemoveIds((current) => { const next = new Set(current); if (next.has(player.playerId)) next.delete(player.playerId); else next.add(player.playerId); return next; })}>
            <Text style={styles.check}>{removeIds.has(player.playerId) ? '☑' : '☐'}</Text>
            <Text style={styles.choiceText}>Remove {player.playerName}{player.injuredReserve ? ' · saved on IR' : ''}</Text>
          </Pressable>
        ) : <Text key={player.playerId} style={styles.body}>Keep {player.playerName}{player.injuredReserve ? ' · saved on IR' : ''}</Text>)}
      </Card> : null}
      <Text style={styles.body}>{changes.coverage === 'complete' ? 'This will record a full roster-name confirmation.' : 'This will record a partial roster-name check. Unseen names kept above are not confirmed by this import.'} This updates your PuckIQ team only.</Text>
      {changes.error || commitError ? <Text style={styles.error} accessibilityRole="alert">{changes.error ?? commitError}</Text> : null}
      <PrimaryButton label={pendingId ? 'Applying…' : changes.additions.length || changes.removed.length || changes.identityUpdates.length
        ? `Apply · add ${changes.additions.length}, remove ${changes.removed.length}` : 'Confirm roster names'}
        disabled={!!changes.error || !!pendingId} onPress={apply} testID="roster-reconcile-apply" />
      <GhostButton label="Back to matched names" tone="neutral" onPress={onBack} testID="roster-reconcile-back" />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  title: { fontSize: 21, fontWeight: '800', color: colors.text },
  label: { fontSize: 12, fontWeight: '800', color: colors.text },
  body: { fontSize: 14, lineHeight: 20, color: colors.sub },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  choiceText: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.text, fontWeight: '600' },
  check: { color: colors.accent, fontSize: 23 },
  error: { color: colors.accent, fontSize: 14, lineHeight: 20 },
});
