/**
 * This week's lines — one roster, tap into F / D / G / bench, copy last week.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../constants/theme';
import { useGroupedRosterPlayers, useWeeklyLines } from '../hooks/useWeeklyLines';
import type { FantasyPlayer } from '../types/fantasy';
import type { LineGroup } from '../types/lines';
import PageHeader from './PageHeader';
import RosterBuilder from './RosterBuilder';

const GROUPS: { key: LineGroup; title: string; testID: string }[] = [
  { key: 'F', title: 'Forwards', testID: 'lines-group-F' },
  { key: 'D', title: 'Defense', testID: 'lines-group-D' },
  { key: 'G', title: 'Goalies', testID: 'lines-group-G' },
  { key: 'bench', title: 'Bench', testID: 'lines-group-bench' },
];

const GROUP_CHIPS: { key: LineGroup; label: string }[] = [
  { key: 'F', label: 'F' },
  { key: 'D', label: 'D' },
  { key: 'G', label: 'G' },
  { key: 'bench', label: 'BN' },
];

function FirstAddRow({
  onAdd,
  busy,
}: {
  onAdd: (name: string) => Promise<void>;
  busy?: boolean;
}) {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const disabled = name.trim().length < 1 || adding || busy;

  const submit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      await onAdd(trimmed);
      setName('');
    } finally {
      setAdding(false);
    }
  }, [adding, name, onAdd]);

  return (
    <View style={styles.addBlock} testID="lines-first-add">
      <TextInput
        style={styles.nameInput}
        placeholder="Type a name"
        placeholderTextColor={rinkGlass.textMuted}
        value={name}
        onChangeText={setName}
        testID="lines-add-name-input"
        autoCorrect={false}
        autoCapitalize="words"
        onSubmitEditing={submit}
        returnKeyType="done"
        editable={!adding}
      />
      <TouchableOpacity
        style={[styles.addNameButton, disabled && styles.addNameButtonDisabled]}
        onPress={submit}
        disabled={disabled}
        testID="lines-add-name"
        accessibilityRole="button"
        accessibilityLabel="Add name to roster"
      >
        <Text style={styles.addNameButtonText}>{adding ? 'Adding…' : 'Add'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function PlayerRow({
  player,
  group,
  onAssign,
}: {
  player: FantasyPlayer;
  group: LineGroup;
  onAssign: (playerId: number, group: LineGroup) => void;
}) {
  return (
    <View style={styles.playerRow} testID={`lines-player-${player.playerId}`}>
      <View style={styles.playerText}>
        <Text style={styles.playerName}>{player.playerName}</Text>
        <Text style={styles.playerMeta}>
          {player.position || '—'}
          {player.teamAbbrev ? ` · ${player.teamAbbrev}` : ''}
        </Text>
      </View>
      <View style={styles.chips} testID={`lines-chips-${player.playerId}`}>
        {GROUP_CHIPS.map((chip) => {
          const active = group === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              onPress={() => onAssign(player.playerId, chip.key)}
              style={[styles.chip, active && styles.chipActive]}
              testID={`lines-assign-${player.playerId}-${chip.key}`}
              accessibilityRole="button"
              accessibilityLabel={`Put ${player.playerName} on ${chip.label}`}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{chip.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function ThisWeekLinesScreen() {
  const {
    isLoading,
    roster,
    hasRoster,
    weekLabel,
    canCopyLastWeek,
    error,
    groupOf,
    assign,
    addName,
    copyLastWeek,
    onRefresh,
  } = useWeeklyLines();
  const grouped = useGroupedRosterPlayers(roster, groupOf);
  const [showBuilder, setShowBuilder] = useState(false);

  const handleAssign = useCallback(
    (playerId: number, group: LineGroup) => {
      assign(playerId, group);
    },
    [assign],
  );

  const handleCopyLastWeek = useCallback(() => {
    if (!canCopyLastWeek) return;
    Alert.alert(
      'Copy last week?',
      'This week’s slots will match last week. You can still tap to move players.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Copy', onPress: () => { copyLastWeek(); } },
      ],
    );
  }, [canCopyLastWeek, copyLastWeek]);

  const handleSaved = useCallback(() => {
    setShowBuilder(false);
    onRefresh();
  }, [onRefresh]);

  if (isLoading) {
    return (
      <View style={styles.centered} testID="lines-loading">
        <ActivityIndicator size="large" color={rinkGlass.blueLight} />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="this-week-lines-screen">
      <PageHeader
        title="This week's lines"
        subtitle={weekLabel ? `${weekLabel} · your roster` : 'Your roster · this week'}
        right={
          hasRoster ? (
            <TouchableOpacity
              onPress={() => setShowBuilder(true)}
              style={styles.editButton}
              testID="lines-edit-roster"
            >
              <Ionicons name="pencil" size={16} color={rinkGlass.blueLight} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {!hasRoster ? (
        <View style={styles.empty} testID="lines-empty">
          <Ionicons name="people-outline" size={48} color={rinkGlass.blueLight} />
          <Text style={styles.emptyTitle}>Add a name</Text>
          <Text style={styles.emptyCopy}>
            Type the first player on YOUR roster. Then tap them onto F, D, G, or bench. No NHL search.
          </Text>
          <FirstAddRow onAdd={addName} />
          {error ? <Text style={styles.error} testID="lines-error">{error}</Text> : null}
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <FirstAddRow onAdd={addName} />
          <TouchableOpacity
            style={[styles.copyButton, !canCopyLastWeek && styles.copyButtonDisabled]}
            onPress={handleCopyLastWeek}
            disabled={!canCopyLastWeek}
            testID="copy-last-week"
          >
            <Ionicons
              name="copy-outline"
              size={16}
              color={canCopyLastWeek ? '#0a0e1a' : rinkGlass.textMuted}
            />
            <Text style={[styles.copyText, !canCopyLastWeek && styles.copyTextDisabled]}>
              Copy last week
            </Text>
          </TouchableOpacity>
          <Text style={styles.copyHint} testID="copy-last-week-hint">
            {canCopyLastWeek
              ? 'Last week is saved. Copy it forward, then tap to adjust.'
              : 'After this week, you can copy last week forward.'}
          </Text>
          {error ? <Text style={styles.error} testID="lines-error">{error}</Text> : null}

          {GROUPS.map((section) => {
            const players = grouped[section.key];
            return (
              <View key={section.key} style={styles.section} testID={section.testID}>
                <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
                {players.length === 0 ? (
                  <Text style={styles.sectionEmpty} testID={`${section.testID}-empty`}>
                    Tap a player to put them here
                  </Text>
                ) : (
                  players.map((player) => (
                    <PlayerRow
                      key={player.playerId}
                      player={player}
                      group={section.key}
                      onAssign={handleAssign}
                    />
                  ))
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <RosterBuilder
        visible={showBuilder}
        onDismiss={() => setShowBuilder(false)}
        onSaved={handleSaved}
        existingRoster={roster}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: rinkGlass.ice,
  },
  centered: {
    flex: 1,
    backgroundColor: rinkGlass.ice,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: rinkGlass.fonts.display,
    color: rinkGlass.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyCopy: {
    fontSize: 15,
    color: rinkGlass.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 320,
  },
  addBlock: {
    width: '100%',
    maxWidth: 400,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    alignSelf: 'center',
  },
  nameInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: rinkGlass.boards,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    fontSize: 16,
    color: rinkGlass.textPrimary,
  },
  addNameButton: {
    backgroundColor: rinkGlass.blueLight,
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addNameButtonDisabled: {
    opacity: 0.4,
  },
  addNameButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0a0e1a',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${rinkGlass.blueLight}1F`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: rinkGlass.blueLight,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  copyButtonDisabled: {
    backgroundColor: rinkGlass.boards,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  copyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0a0e1a',
  },
  copyTextDisabled: {
    color: rinkGlass.textMuted,
  },
  copyHint: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  error: {
    fontSize: 13,
    color: rinkGlass.redLine,
    marginBottom: 12,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: rinkGlass.blueLight,
    marginBottom: 8,
  },
  sectionEmpty: {
    fontSize: 13,
    color: rinkGlass.textMuted,
    paddingVertical: 8,
  },
  playerRow: {
    backgroundColor: rinkGlass.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  playerText: {
    gap: 2,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
  },
  playerMeta: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: rinkGlass.boards,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: rinkGlass.blueLight,
    borderColor: rinkGlass.blueLight,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: rinkGlass.textSecondary,
  },
  chipLabelActive: {
    color: '#0a0e1a',
  },
});
