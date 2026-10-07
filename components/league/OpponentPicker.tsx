/**
 * This week's opponent, picked from the room. One pick pairs both teams; Week fills in the
 * opponent's roster and keeps it current. Black pill = the current opponent.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RoomMember } from '../../types/league';
import type { RoomOpponent } from '../../services/league';
import { Card, colors, display } from '../coach/ui';
import type { LeagueResult } from './useRoomActions';

function caption(opponent: RoomOpponent | null, choices: number): string {
  if (choices === 0) return 'Your opponent shows up here once they join the room.';
  if (!opponent) return 'Pick who you play this week. Week fills in their roster and keeps it current.';
  if (opponent.pickedBy === 'them') return `${opponent.teamName} picked you, so Week has their roster.`;
  return 'Week has their roster and keeps it current. Tap them again to clear.';
}

export function OpponentPicker({
  choices,
  opponent,
  onPick,
}: {
  /** Everyone else in the room, by team name. */
  choices: RoomMember[];
  opponent: RoomOpponent | null;
  onPick: (userId: string | null) => Promise<LeagueResult>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (userId: string) => {
    // Tapping my own pick clears it; tapping the team that picked me confirms the pairing.
    const next = opponent?.userId === userId && opponent.pickedBy === 'me' ? null : userId;
    setBusy(true);
    setError(null);
    const failed = await onPick(next);
    setBusy(false);
    if (failed) setError(failed.message);
  };

  return (
    <Card style={styles.card} testID="room-opponent">
      <Text style={[styles.versus, !opponent && styles.versusNone]} numberOfLines={1} testID="room-opponent-name">
        {opponent ? `VS ${opponent.teamName.toUpperCase()}` : 'NO OPPONENT YET'}
      </Text>
      <Text style={styles.caption}>{caption(opponent, choices.length)}</Text>
      {choices.length > 0 ? (
        <View style={styles.pills}>
          {choices.map((member) => {
            const selected = opponent?.userId === member.userId;
            return (
              <Pressable
                key={member.userId}
                onPress={() => pick(member.userId)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={member.teamName}
                style={({ pressed }) => [styles.pill, selected && styles.pillSelected, pressed && styles.pressed]}
                testID={`opponent-${member.userId}`}
              >
                {selected ? <Ionicons name="checkmark" size={14} color={colors.onInk} /> : null}
                <Text style={[styles.pillText, selected && styles.pillTextSelected]} numberOfLines={1}>
                  {member.teamName}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  versus: { ...display(24) },
  versusNone: { color: colors.muted },
  caption: { fontSize: 14, lineHeight: 20, color: colors.sub },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.track,
  },
  pillSelected: { backgroundColor: colors.ink },
  pillText: { flexShrink: 1, fontSize: 13, fontWeight: '800', color: colors.ink },
  pillTextSelected: { color: colors.onInk },
  pressed: { opacity: 0.75 },
  error: { fontSize: 13, fontWeight: '600', color: colors.bad },
});
