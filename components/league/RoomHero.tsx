/**
 * The room's carbon hero: its name, the invite code and Invite, and how much of the league is in
 * — a segment per team, like a sector bar: lit = roster synced, dim = joined without a roster.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Room } from '../../types/league';
import type { RoomCoverage } from '../../services/league';
import { PLATFORM_LABEL } from '../../services/teams';
import { colors, DarkCard, display } from '../coach/ui';
import { CarbonIconButton, Kicker } from './Kicker';

export function RoomHero({
  room,
  coverage,
  onInvite,
  onMenu,
}: {
  room: Room;
  coverage: RoomCoverage;
  onInvite: () => void;
  onMenu: () => void;
}) {
  return (
    <DarkCard texture style={styles.hero} testID="room-hero">
      <Kicker
        dark
        label={`League Room · ${PLATFORM_LABEL[room.platform]}`}
        right={<CarbonIconButton icon="ellipsis-horizontal" label="Room menu" onPress={onMenu} testID="room-menu-open" />}
      />
      <Text style={styles.name} numberOfLines={2} testID="room-name">
        {room.name.toUpperCase()}
      </Text>
      <View style={styles.inviteRow}>
        <View style={styles.codePill} accessible accessibilityLabel={`Room code ${room.code.split('').join(' ')}`} testID="room-code">
          <Text style={styles.codeLabel}>CODE</Text>
          <Text style={styles.code}>{room.code}</Text>
        </View>
        <Pressable
          onPress={onInvite}
          accessibilityRole="button"
          accessibilityLabel="Invite your league"
          style={({ pressed }) => [styles.invite, pressed && styles.pressed]}
          testID="room-invite"
        >
          <Ionicons name="share-outline" size={16} color={colors.onAccent} />
          <Text style={styles.inviteText}>INVITE</Text>
        </Pressable>
      </View>
      <CoverageBar coverage={coverage} />
    </DarkCard>
  );
}

function CoverageBar({ coverage: { synced, joined, leagueSize } }: { coverage: RoomCoverage }) {
  const waiting = joined - synced;
  return (
    <View style={styles.coverage} testID="room-coverage">
      <Text style={styles.coverageText}>
        {synced} OF {leagueSize} TEAMS SYNCED{waiting > 0 ? ` · ${waiting} WAITING ON A ROSTER` : ''}
      </Text>
      <View style={styles.segments}>
        {Array.from({ length: leagueSize }, (_, index) => (
          <View key={index} style={[styles.segment, index < synced ? styles.synced : index < joined ? styles.joined : null]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 14 },
  name: { ...display(30), color: colors.onInk, lineHeight: 34 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.inkRaised,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  codeLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: colors.onInkSub },
  code: { ...display(20), color: colors.onInk, letterSpacing: 3 },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  inviteText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.8, color: colors.onAccent },
  pressed: { opacity: 0.8 },
  coverage: { gap: 8 },
  coverageText: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: colors.onInkSub },
  segments: { flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 6, borderRadius: 2, backgroundColor: colors.inkRaised },
  synced: { backgroundColor: colors.onInk },
  joined: { backgroundColor: colors.onInkSub },
});
