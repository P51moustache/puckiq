/**
 * Setup's roster step (concept A, design/concepts/2026-10-15-onboarding-quick-pick): screenshot
 * import on top, search, then a face grid of the players most leagues roster. Moving on needs at
 * least one player or the clearly named sample team, since empty rosters almost never came back.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { NhlSearchPlayer } from '../../types/fantasy';
import { positionLabel } from '../../services/fantasy/positions';
import { searchNhlPlayers } from '../../services/nhlPlayerSearch';
import { addPlayers, removePlayer } from '../../services/teams';
import { SAMPLE_PLAYERS, SAMPLE_TEAM_NAME } from '../../constants/sampleTeam';
import { track } from '../../services/analytics/track';
import { searchOutcome } from '../../services/analytics/searchOutcome';
import type { QuickPicks } from '../../hooks/useQuickPicks';
import { useTeams } from '../TeamsProvider';
import { toFantasyPlayer } from '../sheets/PlayerSearchSheet';
import { PlayerAvatar, PlayerName } from '../coach/PlayerAvatar';
import { colors, GhostButton, PrimaryButton } from '../coach/ui';
import { isPartialRoster, rosterContinueLabel, TYPICAL_ROSTER_SIZE } from '../../services/rosterImport/rosterProgress';
import { RosterImportSheet } from '../rosterImport/RosterImportSheet';
import { hostLinkFor } from '../../services/fantasy/hostLinks';
import { QuickPickGrid } from './QuickPickGrid';
import { styles } from './styles';

export type RosterChoice = 'continue' | 'sample';

/** Wait this long after typing stops before searching, so each keystroke isn't a request. */
const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_LIMIT = 15;

interface RosterStepProps {
  /** Loaded by the parent from the first onboarding screen, so the grid is warm on arrival. */
  picks: QuickPicks;
  bottomInset: number;
  onDone: (choice: RosterChoice, players: number) => void;
}

export function RosterStep({ picks, bottomInset, onDone }: RosterStepProps) {
  const { team, updateTeam } = useTeams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NhlSearchPlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const requestId = useRef(0);
  const roster = useMemo(() => team?.players ?? [], [team]);
  const rosterIds = useMemo(() => new Set(roster.map((player) => player.playerId)), [roster]);
  const typing = query.trim().length >= 2;
  // 1–4 players never came back (Oct 2026), so a partial roster says so and import stays the main move.
  const partial = isPartialRoster(roster.length);
  const hostName = useMemo(() => (team ? hostLinkFor(team)?.name : undefined), [team]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const id = ++requestId.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      const startedAt = Date.now();
      try {
        const found = await searchNhlPlayers(trimmed, SEARCH_LIMIT);
        if (id !== requestId.current) return;
        const active = found.filter((row) => row.active);
        setResults(active);
        track('player_search', searchOutcome({ queryLength: trimmed.length, results: active.length, durationMs: Date.now() - startedAt, result: 'success', list: 'players', source: 'onboarding' }));
      } catch {
        if (id !== requestId.current) return;
        setResults([]);
        track('player_search', searchOutcome({ queryLength: trimmed.length, durationMs: Date.now() - startedAt, result: 'error', list: 'players', source: 'onboarding' }));
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => { clearTimeout(timer); requestId.current += 1; };
  }, [query]);

  const toggle = (player: NhlSearchPlayer, source: 'quick_pick' | 'search') => {
    if (!team) return;
    const removing = rosterIds.has(player.playerId);
    if (removing) updateTeam((current) => removePlayer(current, player.playerId));
    else updateTeam((current) => addPlayers(current, [toFantasyPlayer(player)]));
    if (source === 'quick_pick') track('onboarding_quick_pick', { action: removing ? 'remove' : 'add', position: player.position });
  };

  const trySample = () => {
    // Always named as a sample, so it never passes for the user's own team.
    updateTeam((current) => ({ ...addPlayers(current, SAMPLE_PLAYERS), name: SAMPLE_TEAM_NAME }));
    onDone('sample', roster.length + SAMPLE_PLAYERS.length);
  };

  return (
    <Animated.View entering={FadeIn.duration(300)} style={[styles.page, styles.rosterPage, { paddingBottom: bottomInset + 20 }]}>
      <Text style={styles.stepTitle}>Add your players</Text>
      <Text style={styles.stepLede}>
        Tap everyone on your roster, bench too.{roster.length > 0 ? ` ${roster.length} added.` : ''}
      </Text>
      {partial ? (
        <View style={styles.wholeTeam} testID="onboarding-import-card">
          <View style={styles.wholeTeamRow}>
            <View style={styles.wholeTeamIcon}>
              <Ionicons name="document-attach-outline" size={26} color={colors.accent} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.wholeTeamTitle}>Bring in your whole team</Text>
              <Text style={styles.wholeTeamBody}>{`Screenshot your ${hostName ?? 'league'} roster to add everyone.`}</Text>
            </View>
          </View>
          <PrimaryButton label="Import roster" onPress={() => setImporting(true)} testID="onboarding-import" />
        </View>
      ) : (
      <Pressable onPress={() => setImporting(true)} style={({ pressed }) => [styles.importCard, pressed && styles.importPressed]} accessibilityRole="button" testID="onboarding-import">
        <View style={styles.importIcon}>
          <Ionicons name="scan-outline" size={20} color={colors.onAccent} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.importTitle}>Import from screenshots</Text>
          <Text style={styles.importDetail}>Your whole Yahoo, ESPN or Fantrax roster at once</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.onInkSub} />
      </Pressable>
      )}
      <RosterImportSheet visible={importing} source="onboarding" onClose={() => setImporting(false)} />
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search anyone else"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="words"
          clearButtonMode="while-editing"
          testID="onboarding-search"
        />
        {searching ? <ActivityIndicator size="small" color={colors.accent} /> : null}
      </View>
      {typing ? (
        <FlatList
          style={styles.flex}
          data={results}
          keyExtractor={(item) => String(item.playerId)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const on = rosterIds.has(item.playerId);
            return (
              <Pressable onPress={() => toggle(item, 'search')} style={styles.result} testID={`onboarding-result-${item.playerId}`}>
                <PlayerAvatar playerId={item.playerId} team={item.teamAbbrev} position={item.position} size={44} />
                <View style={styles.flex}>
                  <PlayerName name={item.name} size={16} />
                  <Text style={styles.resultMeta}>{positionLabel({ position: item.position })} · {item.teamAbbrev || 'No team'}</Text>
                </View>
                <Ionicons name={on ? 'checkmark-circle' : 'add-circle'} size={28} color={on ? colors.good : colors.ink} />
              </Pressable>
            );
          }}
          ListEmptyComponent={!searching ? <Text style={styles.noResults}>No active NHL players match.</Text> : null}
        />
      ) : (
        <QuickPickGrid
          groups={picks.groups}
          loading={picks.loading}
          error={picks.error}
          onRetry={picks.retry}
          selected={rosterIds}
          onToggle={(player) => toggle(player, 'quick_pick')}
        />
      )}
      {partial ? (
        <>
          <View style={styles.rosterProgress} testID="onboarding-roster-progress">
            <Text style={styles.rosterProgressText}>{roster.length} of ~{TYPICAL_ROSTER_SIZE} players</Text>
            <View style={styles.rosterProgressTrack}>
              <View style={[styles.rosterProgressFill, { width: `${Math.min(100, (roster.length / TYPICAL_ROSTER_SIZE) * 100)}%` }]} />
            </View>
          </View>
          <GhostButton label={rosterContinueLabel(roster.length)} tone="neutral" onPress={() => onDone('continue', roster.length)} testID="onboarding-roster-continue" />
          <Text style={styles.rosterProgressNote}>Add the rest anytime.</Text>
        </>
      ) : (
        <PrimaryButton
          label={rosterContinueLabel(roster.length)}
          onPress={() => onDone('continue', roster.length)}
          disabled={roster.length === 0}
          testID="onboarding-roster-continue"
        />
      )}
      {roster.length === 0 ? (
        <Pressable onPress={trySample} style={styles.skip} testID="onboarding-sample-team">
          <Text style={styles.sampleText}>Not sure yet? Try the sample team</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
