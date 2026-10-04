/**
 * Search real NHL players (official NHL search) to add to my roster, my opponent's
 * roster, or to link a name typed into PuckIQ 2.x.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FantasyPlayer, NhlSearchPlayer } from '../../types/fantasy';
import { searchNhlPlayers } from '../../services/nhlPlayerSearch';
import { addPlayers, MAX_ROSTER_PLAYERS, replacePlayer } from '../../services/teams';
import { positionLabel } from '../../services/fantasy/positions';
import { useTeams } from '../TeamsProvider';
import { PlayerAvatar, PlayerName } from '../coach/PlayerAvatar';
import { colors } from '../coach/ui';
import { track } from '../../services/analytics/track';

export type SearchMode =
  | { kind: 'add'; list: 'players' | 'opponent' }
  | { kind: 'link'; player: FantasyPlayer };

interface PlayerSearchSheetProps {
  visible: boolean;
  mode: SearchMode;
  onClose: () => void;
}

export function toFantasyPlayer(result: NhlSearchPlayer): FantasyPlayer {
  return {
    playerId: result.playerId,
    playerName: result.name,
    teamAbbrev: result.teamAbbrev,
    position: result.position,
    rosterPosition: 'BN',
  };
}

export default function PlayerSearchSheet({ visible, mode, onClose }: PlayerSearchSheetProps) {
  const { team, updateTeam } = useTeams();
  const initialQuery = mode.kind === 'link' ? mode.player.playerName : '';
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<NhlSearchPlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Edited locally and saved once: saving the team re-plans the week and queues a
  // backup, and doing that per keystroke drops letters.
  const [opponentName, setOpponentName] = useState(team?.opponentName ?? '');
  const requestId = useRef(0);
  const list = mode.kind === 'add' ? mode.list : 'players';

  useEffect(() => {
    if (visible) {
      track('player_search_open', { mode: mode.kind, list });
      setQuery(initialQuery);
      setResults([]);
      setError(null);
      setOpponentName(team?.opponentName ?? '');
    }
    // Reset only when the sheet opens, not on every team change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialQuery]);

  const saveOpponentName = () => {
    const next = opponentName.trim();
    if (team && next !== team.opponentName) updateTeam((current) => ({ ...current, opponentName: next }));
  };

  const close = () => {
    track('player_search_close', { mode: mode.kind, list });
    if (mode.kind === 'add' && mode.list === 'opponent') saveOpponentName();
    onClose();
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (!visible || trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const id = ++requestId.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      const startedAt = Date.now();
      try {
        const found = await searchNhlPlayers(trimmed, 25);
        if (id !== requestId.current) return;
        setResults(found);
        track('player_search', { query_length: trimmed.length, results: found.length, duration_ms: Date.now() - startedAt, result: 'success', list });
        setError(null);
      } catch {
        if (id !== requestId.current) return;
        setError('NHL search is unavailable. Check your connection.');
        track('player_search', { query_length: trimmed.length, duration_ms: Date.now() - startedAt, result: 'error', list });
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, visible, list]);

  const onList = useMemo(() => new Set((team?.[list] ?? []).map((player) => player.playerId)), [team, list]);
  const count = team?.[list].length ?? 0;
  const full = count >= MAX_ROSTER_PLAYERS;

  const handlePick = (result: NhlSearchPlayer) => {
    if (!team) return;
    if (mode.kind === 'link') {
      track('player_link', { source: 'legacy_roster' });
      updateTeam((current) => replacePlayer(current, mode.player.playerId, toFantasyPlayer(result)));
      onClose();
      return;
    }
    if (onList.has(result.playerId) || full) return;
    updateTeam((current) => addPlayers(current, [toFantasyPlayer(result)], mode.list));
  };

  const title = mode.kind === 'link'
    ? `Link “${mode.player.playerName}”`
    : mode.list === 'opponent' ? 'Opponent’s players' : 'Add players';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close} testID="player-search-sheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {mode.kind === 'add' ? (
              <Text style={styles.subtitle}>
                {count} of {MAX_ROSTER_PLAYERS} {mode.list === 'opponent' ? 'on their roster' : 'on your roster'}
              </Text>
            ) : (
              <Text style={styles.subtitle}>Pick the NHL player this name refers to.</Text>
            )}
          </View>
          <Pressable onPress={close} hitSlop={10} testID="player-search-done" accessibilityRole="button">
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.muted} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search NHL players"
            placeholderTextColor={colors.muted}
            autoFocus
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
            testID="player-search-input"
          />
          {searching ? <ActivityIndicator size="small" color={colors.accent} /> : null}
          {query.length > 0 && !searching ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={16} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {mode.kind === 'add' && mode.list === 'opponent' && team ? (
          <TextInput
            style={styles.opponentName}
            value={opponentName}
            onChangeText={(text) => setOpponentName(text.slice(0, 40))}
            onEndEditing={saveOpponentName}
            placeholder="Opponent’s team name (optional)"
            placeholderTextColor={colors.muted}
            testID="opponent-name-input"
          />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {full && mode.kind === 'add' ? <Text style={styles.error}>Roster is full ({MAX_ROSTER_PLAYERS}). Remove someone first.</Text> : null}

        <FlatList
          data={results}
          keyExtractor={(item) => String(item.playerId)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            query.trim().length >= 2 && !searching && !error ? (
              <Text style={styles.empty}>No NHL players match “{query.trim()}”.</Text>
            ) : query.trim().length < 2 ? (
              <Text style={styles.empty}>Type at least two letters of a first or last name.</Text>
            ) : null
          }
          renderItem={({ item }) => {
            const added = onList.has(item.playerId);
            return (
              <Pressable
                onPress={() => handlePick(item)}
                disabled={mode.kind === 'add' && (added || full)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                testID={`search-result-${item.playerId}`}
                accessibilityRole="button"
                accessibilityLabel={`${added ? 'Added' : mode.kind === 'link' ? 'Link' : 'Add'} ${item.name}`}
              >
                <PlayerAvatar playerId={item.playerId} team={item.teamAbbrev} position={item.position} size={44} />
                <View style={styles.rowText}>
                  <PlayerName name={item.name} size={16} color={item.active ? colors.text : colors.muted} />
                  <Text style={styles.meta}>
                    {[positionLabel({ position: item.position }), item.teamAbbrev || 'No team', item.active ? null : 'Inactive']
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                {mode.kind === 'link' ? (
                  <Ionicons name="link" size={20} color={colors.ink} />
                ) : added ? (
                  <Ionicons name="checkmark-circle" size={28} color={colors.good} />
                ) : (
                  <Ionicons name="add-circle" size={28} color={full ? colors.muted : colors.ink} />
                )}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -0.5,
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.sub,
    marginTop: 2,
  },
  done: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accent,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  opponentName: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
  },
  error: {
    color: colors.warn,
    fontSize: 13,
    marginHorizontal: 18,
    marginTop: 10,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  empty: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 30,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowText: {
    flex: 1,
  },
  meta: {
    fontSize: 12,
    color: colors.sub,
    marginTop: 2,
  },
});
