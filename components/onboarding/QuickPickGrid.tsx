/**
 * Setup's face grid: the players most leagues roster, by position, tapped to add or remove.
 * Reference: design/concepts/2026-10-15-onboarding-quick-pick (concept A).
 */

import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NhlSearchPlayer } from '../../types/fantasy';
import { QUICK_PICK_GROUPS, type QuickPickGroup } from '../../services/fantasy/quickPick';
import { PlayerAvatar, splitName } from '../coach/PlayerAvatar';
import { SegmentedControl } from '../coach/SegmentedControl';
import { colors, pressedStyle } from '../coach/theme';

const COLUMNS = 3;
/** Placeholder tiles while the list loads: three rows reads as "a grid is coming". */
const PLACEHOLDER_TILES = 9;
const AVATAR = 52;
const GROUP_LABEL: Record<QuickPickGroup, string> = { F: 'Forwards', D: 'Defense', G: 'Goalies' };

interface QuickPickGridProps {
  groups: Record<QuickPickGroup, NhlSearchPlayer[]> | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  selected: ReadonlySet<number>;
  onToggle: (player: NhlSearchPlayer) => void;
}

export function QuickPickGrid({ groups, loading, error, onRetry, selected, onToggle }: QuickPickGridProps) {
  const [group, setGroup] = useState<QuickPickGroup>('F');
  const players = groups?.[group] ?? [];
  return (
    <View style={styles.flex} testID="quick-pick">
      <View style={styles.tabsRow}>
        <SegmentedControl
          options={QUICK_PICK_GROUPS.map((value) => ({ value, label: GROUP_LABEL[value] }))}
          value={group}
          onChange={setGroup}
          style={styles.flex}
          testID="quick-pick-group"
        />
      </View>
      <Text style={styles.caption}>Most owned in fantasy leagues</Text>
      {!groups && error ? (
        <View style={styles.problem} testID="quick-pick-error">
          <Text style={styles.problemText}>Couldn’t load popular players. Search still works.</Text>
          <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
            <Text style={styles.retry}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          key={group}
          style={styles.flex}
          data={!groups && loading ? PLACEHOLDERS : players}
          numColumns={COLUMNS}
          keyExtractor={(item) => String(item.playerId)}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) =>
            item.playerId < 0 ? <View style={[styles.tile, styles.placeholder]} /> : (
              <Tile player={item} on={selected.has(item.playerId)} onPress={() => onToggle(item)} />
            )
          }
        />
      )}
    </View>
  );
}

const PLACEHOLDERS: NhlSearchPlayer[] = Array.from({ length: PLACEHOLDER_TILES }, (_, index) => ({
  playerId: -(index + 1), name: '', teamAbbrev: '', position: '', active: true,
}));

function Tile({ player, on, onPress }: { player: NhlSearchPlayer; on: boolean; onPress: () => void }) {
  const { last } = splitName(player.name);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && pressedStyle]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${player.name}, ${player.teamAbbrev}`}
      testID={`quick-pick-${player.playerId}`}
    >
      <PlayerAvatar playerId={player.playerId} team={player.teamAbbrev} position={player.position} size={AVATAR} />
      <Text style={styles.name} numberOfLines={1}>{last}</Text>
      <Text style={styles.team}>{player.teamAbbrev}</Text>
      {on ? (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={12} color={colors.bg} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabsRow: { flexDirection: 'row', marginTop: 12 },
  caption: { fontSize: 12, color: colors.muted, marginTop: 8, marginBottom: 8 },
  grid: { gap: 8, paddingBottom: 12 },
  gridRow: { gap: 8 },
  tile: {
    flex: 1 / COLUMNS,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tileOn: { borderColor: colors.good },
  placeholder: { height: AVATAR + 50, backgroundColor: colors.raised },
  name: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 6 },
  team: { fontSize: 11, color: colors.muted, marginTop: 1 },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.good,
  },
  problem: { alignItems: 'center', gap: 8, marginTop: 20 },
  problemText: { fontSize: 14, color: colors.sub, textAlign: 'center' },
  retry: { fontSize: 14, fontWeight: '700', color: colors.accent },
});
