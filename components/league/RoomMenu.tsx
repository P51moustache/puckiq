/**
 * The room menu. Owner: rename the room, make a new invite code, remove a team. Everyone: leave
 * the room, or report it to support (rooms have no chat, so a report is about names or members).
 */

import React, { useState } from 'react';
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ROOM_NAME_MAX, type RoomSnapshot } from '../../types/league';
import { byTeamName, cleanRoomText, otherMembers, roomTextMessage } from '../../services/league';
import { colors, PrimaryButton } from '../coach/ui';
import { reportRoomMailto } from './format';
import type { LeagueResult } from './useRoomActions';

type Page = 'menu' | 'rename' | 'remove';

/** What leaving means, said before it happens. */
export function leaveMessage(isOwner: boolean, memberCount: number): string {
  if (memberCount <= 1) return 'You’re the last team here, so the room closes.';
  if (isOwner) return 'Ownership passes to the longest-standing team. You can rejoin with the code.';
  return 'Your team leaves the board and the dues list. You can rejoin with the code.';
}

export function RoomMenu({
  visible,
  snapshot,
  onClose,
  onRename,
  onRotateCode,
  onRemove,
  onLeave,
}: {
  visible: boolean;
  snapshot: RoomSnapshot;
  onClose: () => void;
  onRename: (name: string) => Promise<LeagueResult>;
  onRotateCode: () => Promise<LeagueResult>;
  onRemove: (userId: string) => Promise<LeagueResult>;
  onLeave: () => Promise<LeagueResult>;
}) {
  const [page, setPage] = useState<Page>('menu');
  const [error, setError] = useState<string | null>(null);
  const { room } = snapshot;
  const isOwner = room.ownerId === snapshot.me;
  const others = otherMembers(snapshot).sort(byTeamName);

  const close = () => {
    setPage('menu');
    setError(null);
    onClose();
  };
  const run = async (action: () => Promise<LeagueResult>) => {
    setError(null);
    const failed = await action();
    if (failed) setError(failed.message);
    else close();
  };
  const confirm = (title: string, message: string, label: string, action: () => Promise<LeagueResult>) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: label, style: 'destructive', onPress: () => void run(action) },
    ]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close room menu">
        <Pressable style={styles.sheet} onPress={() => undefined} testID="room-menu">
          {page === 'rename' ? (
            <RenamePage current={room.name} onSave={(name) => run(() => onRename(name))} onBack={() => setPage('menu')} />
          ) : page === 'remove' ? (
            <>
              <Text style={styles.title}>REMOVE A TEAM</Text>
              {others.map((member) => (
                <Row
                  key={member.userId}
                  icon="person-remove-outline"
                  label={member.teamName}
                  tone="bad"
                  onPress={() =>
                    confirm(`Remove ${member.teamName}?`, 'They leave the board and the dues list. Make a new code if they shouldn’t rejoin.', 'Remove', () =>
                      onRemove(member.userId),
                    )
                  }
                  testID={`room-remove-${member.userId}`}
                />
              ))}
              <Row icon="chevron-back" label="Back" onPress={() => setPage('menu')} testID="room-menu-back" />
            </>
          ) : (
            <>
              <Text style={styles.title}>{room.name.toUpperCase()}</Text>
              {isOwner ? (
                <>
                  <Row icon="create-outline" label="Rename room" onPress={() => setPage('rename')} testID="room-menu-rename" />
                  <Row
                    icon="refresh"
                    label="New invite code"
                    onPress={() => confirm('Make a new invite code?', 'The old code and invite links stop working.', 'New code', onRotateCode)}
                    testID="room-menu-new-code"
                  />
                  {others.length > 0 ? (
                    <Row icon="person-remove-outline" label="Remove a team" onPress={() => setPage('remove')} testID="room-menu-remove" />
                  ) : null}
                  <View style={styles.divider} />
                </>
              ) : null}
              <Row
                icon="exit-outline"
                label="Leave room"
                tone="bad"
                onPress={() => confirm(`Leave ${room.name}?`, leaveMessage(isOwner, snapshot.members.length), 'Leave', onLeave)}
                testID="room-menu-leave"
              />
              <Row
                icon="flag-outline"
                label="Report room"
                onPress={() => {
                  Linking.openURL(reportRoomMailto(room)).catch(() => undefined);
                  close();
                }}
                testID="room-menu-report"
              />
              <Text style={styles.footnote}>Rooms have no chat, only preset reactions. Report a name or a team that isn’t friendly.</Text>
            </>
          )}
          {error ? (
            <Text style={styles.error} testID="room-menu-error">
              {error}
            </Text>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function RenamePage({ current, onSave, onBack }: { current: string; onSave: (name: string) => Promise<void>; onBack: () => void }) {
  const [name, setName] = useState(current);
  const [saving, setSaving] = useState(false);
  const checked = cleanRoomText(name);
  const problem = !checked.ok && name.trim() !== '' ? roomTextMessage(checked.reason) : null;
  const save = async () => {
    if (!checked.ok) return;
    setSaving(true);
    await onSave(checked.value);
    setSaving(false);
  };
  return (
    <View style={styles.rename}>
      <Text style={styles.title}>RENAME ROOM</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        autoFocus
        maxLength={ROOM_NAME_MAX * 2}
        returnKeyType="done"
        onSubmitEditing={save}
        style={styles.input}
        accessibilityLabel="Room name"
        testID="room-rename-input"
      />
      {problem ? (
        <Text style={styles.error} testID="room-rename-problem">
          {problem}
        </Text>
      ) : null}
      <PrimaryButton label="Save name" onPress={save} loading={saving} disabled={!checked.ok} style={styles.renameButton} testID="room-rename-save" />
      <Row icon="chevron-back" label="Back" onPress={onBack} testID="room-menu-back" />
    </View>
  );
}

function Row({
  icon,
  label,
  onPress,
  tone,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: 'bad';
  testID?: string;
}) {
  const color = tone === 'bad' ? colors.bad : colors.text;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.pressed]} testID={testID}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.rowText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(21,21,30,0.45)', justifyContent: 'flex-end', padding: 16, paddingBottom: 40 },
  sheet: { backgroundColor: colors.card, borderRadius: 22, paddingVertical: 12 },
  title: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: colors.muted, paddingHorizontal: 16, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  rowText: { flex: 1, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 6 },
  footnote: { fontSize: 12, lineHeight: 17, color: colors.muted, paddingHorizontal: 16, paddingTop: 6 },
  rename: { gap: 10 },
  renameButton: { marginHorizontal: 16 },
  input: {
    marginHorizontal: 16,
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  error: { fontSize: 13, fontWeight: '600', color: colors.bad, paddingHorizontal: 16, paddingTop: 4 },
});
