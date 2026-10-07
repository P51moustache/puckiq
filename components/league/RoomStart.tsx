/**
 * No room yet: create one for the active team, or join a league-mate's with the 6-character code
 * (validated live). Disabled, with the reason, when the team can't go to a room yet.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isLeagueUnavailable, isValidRoomCode } from '../../services/league';
import { Card, colors, PrimaryButton } from '../coach/ui';
import { JoinCodeInput } from './JoinCodeInput';
import type { LeagueResult } from './useRoomActions';

export function RoomStart({
  teamName,
  disabled = false,
  note = null,
  onCreate,
  onJoin,
}: {
  teamName: string;
  disabled?: boolean;
  /** Why create / join are off, shown above them. */
  note?: string | null;
  onCreate: () => Promise<LeagueResult>;
  onJoin: (code: string) => Promise<LeagueResult>;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'create' | 'join', action: () => Promise<LeagueResult>) => {
    setBusy(kind);
    setError(null);
    const failed = await action();
    setBusy(null);
    // "Not switched on yet" swaps this card for the coming-soon state; it isn't an error to show.
    if (failed && !isLeagueUnavailable(failed)) setError(failed.message);
  };

  return (
    <Card style={styles.card} testID="room-start">
      {note ? (
        <Text style={styles.note} testID="room-start-note">
          {note}
        </Text>
      ) : null}
      <PrimaryButton
        label={`Create a room for ${teamName}`}
        icon="add"
        onPress={() => run('create', onCreate)}
        loading={busy === 'create'}
        disabled={disabled || busy !== null}
        testID="room-create"
      />
      <Text style={styles.sub}>You get a code and a link to send your league.</Text>
      <View style={styles.or}>
        <View style={styles.rule} />
        <Text style={styles.orText}>OR JOIN WITH A CODE</Text>
        <View style={styles.rule} />
      </View>
      <JoinCodeInput value={code} onChange={setCode} editable={!disabled} testID="room-code-input" />
      <PrimaryButton
        label="Join room"
        variant="black"
        icon="enter-outline"
        onPress={() => run('join', () => onJoin(code))}
        loading={busy === 'join'}
        disabled={disabled || busy !== null || !isValidRoomCode(code)}
        testID="room-join"
      />
      {error ? (
        <Text style={styles.error} testID="room-start-error">
          {error}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, marginTop: 12 },
  note: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.warn },
  sub: { fontSize: 13, color: colors.sub, textAlign: 'center', marginTop: -4 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  orText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: colors.muted },
  error: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.bad, textAlign: 'center' },
});
