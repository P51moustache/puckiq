/**
 * Roster tab — the one roster this week's lines uses.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BARN_NAME, barn, barnLines, splitHero } from '../constants/barn';
import { useMyTeamData } from '../hooks/useMyTeamData';
import { addNhlSearchPlayer } from '../services/fantasyRoster';
import type { NhlSearchPlayer } from '../types/fantasy';
import NhlPlayerSearch from './NhlPlayerSearch';
import PageHeader from './PageHeader';
import RinkMarkings from './RinkMarkings';
import RosterBuilder from './RosterBuilder';

export default function MyTeamScreen() {
  const { isLoading, roster, hasRoster, onRefresh } = useMyTeamData();
  const [showRosterBuilder, setShowRosterBuilder] = useState(false);

  const handleRosterSaved = useCallback(() => {
    setShowRosterBuilder(false);
    onRefresh();
  }, [onRefresh]);

  const handleAddNhl = useCallback(async (hit: NhlSearchPlayer) => {
    try {
      await addNhlSearchPlayer(hit);
      onRefresh();
    } catch (error) {
      console.warn('[MY_TEAM] Could not add NHL player:', error);
    }
  }, [onRefresh]);

  if (isLoading) {
    return (
      <View style={styles.centered} testID="my-team-loading">
        <ActivityIndicator size="large" color={barn.signal} />
        <Text style={styles.loadingCopy}>{barnLines.loading}</Text>
      </View>
    );
  }

  const [heroTop, heroBottom] = splitHero(barnLines.emptyBoard);

  return (
    <View style={styles.container}>
      <RinkMarkings />
      <PageHeader
        title={BARN_NAME}
        subtitle={
          hasRoster
            ? `${roster?.players.length ?? 0} on the board`
            : 'The board'
        }
        right={
          hasRoster ? (
            <TouchableOpacity
              onPress={() => setShowRosterBuilder(true)}
              style={styles.editButton}
              testID="edit-roster-button"
            >
              <Text style={styles.editLabel}>BOARD</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />
      {!hasRoster ? (
        <View style={styles.emptyState} testID="my-team-empty">
          <Text style={styles.hero}>{heroTop}</Text>
          {heroBottom ? <Text style={styles.hero}>{heroBottom}</Text> : null}
          <View style={styles.centerIce} />
          <View style={styles.emptySearch}>
            <NhlPlayerSearch onAdd={(hit) => { handleAddNhl(hit); }} />
          </View>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} testID="my-team-roster">
          <NhlPlayerSearch
            onAdd={(hit) => { handleAddNhl(hit); }}
            alreadyOnRoster={new Set((roster?.players ?? []).map((player) => player.playerId))}
          />
          {roster?.players.map((player) => (
            <View key={player.playerId} style={styles.playerRow} testID="roster-player-row">
              <View style={styles.playerText}>
                <Text style={styles.playerName}>{player.playerName}</Text>
                <Text style={styles.playerMeta}>
                  {[player.position, player.teamAbbrev].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <RosterBuilder
        visible={showRosterBuilder}
        onDismiss={() => setShowRosterBuilder(false)}
        onSaved={handleRosterSaved}
        existingRoster={roster}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: barn.ground,
  },
  centered: {
    flex: 1,
    backgroundColor: barn.ground,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingCopy: {
    color: barn.ink,
    fontFamily: barn.fonts.body,
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    zIndex: 1,
  },
  hero: {
    fontSize: 56,
    lineHeight: 54,
    fontWeight: '800',
    letterSpacing: -2,
    color: barn.ink,
    fontFamily: barn.fonts.display,
    textTransform: 'uppercase',
  },
  centerIce: {
    marginTop: 20,
    marginBottom: 32,
    height: 4,
    width: 88,
    backgroundColor: barn.signal,
    shadowColor: barn.signal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 18,
  },
  emptySearch: {
    width: '100%',
  },
  scroll: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 8,
  },
  editButton: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: barn.ink,
    fontFamily: barn.fonts.mono,
  },
  playerRow: {
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderColor: barn.rule,
    paddingVertical: 16,
  },
  playerText: {
    gap: 4,
  },
  playerName: {
    fontSize: 31,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: barn.ink,
    fontFamily: barn.fonts.display,
    textTransform: 'uppercase',
  },
  playerMeta: {
    fontSize: 11,
    letterSpacing: 1.2,
    color: barn.ghost,
    fontFamily: barn.fonts.mono,
    textTransform: 'uppercase',
  },
});
