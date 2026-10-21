import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FantasyTeam } from '../../types/fantasy';
import type { FreeLineupCall } from '../../services/fantasy/freeLineupCall';
import type { CallReason, CallReasonTone } from '../../services/fantasy/callReasons';
import { formatValue } from '../../services/fantasy/scoring';
import { hostLinkFor } from '../../services/fantasy/hostLinks';
import { Card, colors, GhostButton, PrimaryButton } from '../coach/ui';
import { PlayerAvatar } from '../coach/PlayerAvatar';
import { hasSamplePlayers } from '../../constants/sampleTeam';

const NO_REASONS: CallReason[] = [];

/** Up arrow for a soft matchup, flame for a hot streak, down arrow for a caution, a dot for the rest. */
const REASON_ICONS: Record<CallReasonTone, { name: React.ComponentProps<typeof Ionicons>['name']; color: string; size: number }> = {
  good: { name: 'arrow-up', color: colors.good, size: 15 },
  hot: { name: 'flame', color: colors.warn, size: 15 },
  bad: { name: 'arrow-down', color: colors.bad, size: 15 },
  neutral: { name: 'ellipse', color: colors.muted, size: 7 },
};

export function FreeLineupCallCard({ call, team, locked, pending, onSave, onOpenHost, reasons = NO_REASONS }: {
  call: FreeLineupCall | null; team: FantasyTeam; locked: boolean; pending: boolean; onSave: () => void; onOpenHost: () => void;
  /** Why this call (services/fantasy/callReasons.ts); without any, the card keeps its general line. */
  reasons?: CallReason[];
}) {
  if (!call) return null;
  const start = team.players.find((player) => player.playerId === call.startId);
  const bench = team.players.find((player) => player.playerId === call.benchId);
  if (!start) return null;
  const host = hostLinkFor(team);
  return (
    <Card style={styles.card} testID="free-lineup-call">
      <Text style={styles.kicker}>{hasSamplePlayers(team) ? 'SAMPLE LINEUP CALL' : 'YOUR FREE LINEUP CALL'}</Text>
      <View style={styles.row}>
        <PlayerAvatar playerId={start.playerId} team={start.teamAbbrev} position={start.position} size={44} />
        <View style={styles.copy}>
          <Text style={styles.title}>Start {start.playerName}</Text>
          <Text style={styles.body}>{bench ? `Bench ${bench.playerName} · ${call.slot} slot` : `For your ${call.slot} slot`}</Text>
        </View>
      </View>
      {reasons.length > 0 ? (
        <View style={styles.reasons} testID="free-lineup-reasons">
          {reasons.map((reason) => (
            <View key={reason.text} style={styles.reason}>
              <View style={styles.reasonIcon}>
                <Ionicons {...REASON_ICONS[reason.tone]} />
              </View>
              <Text style={styles.reasonText}>{reason.text}</Text>
            </View>
          ))}
          {start.position === 'G' ? <Text style={styles.note}>Goalie starts are estimates—verify the starter before lock.</Text> : null}
        </View>
      ) : (
        <Text style={styles.body}>
          {call.estimatedGain !== null ? `+${formatValue(call.estimatedGain)} estimated scoring value over your saved plan.` : 'He plays on this date and fits your league’s positions. Ranked using your scoring and recent form.'}
          {start.position === 'G' ? ' Goalie starts are estimates—verify the starter before lock.' : ''}
        </Text>
      )}
      {locked ? null : (
        <PrimaryButton label={call.saved ? 'Call saved in PuckIQ' : 'Save this call'} onPress={onSave} disabled={call.saved || pending} testID="free-lineup-save" />
      )}
      {host ? <GhostButton label={`Open ${host.name} to make the move`} icon="open-outline" tone="neutral" onPress={onOpenHost} testID="free-lineup-host" /> : null}
      <Text style={styles.note}>
        {locked ? 'Local plans are locked after the first puck drop. Make any move in your league.' : 'Saving updates your PuckIQ plan. Make the move in your league too.'}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, marginVertical: 8 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  copy: { flex: 1, gap: 3 },
  kicker: { color: colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  body: { color: colors.sub, fontSize: 13, lineHeight: 19 },
  reasons: { gap: 6 },
  reason: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  reasonIcon: { width: 16, height: 19, alignItems: 'center', justifyContent: 'center' },
  reasonText: { flex: 1, color: colors.sub, fontSize: 13, lineHeight: 19 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
