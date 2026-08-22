/**
 * Roster tab — add/remove the players on MY fantasy team.
 * Tonight status lives on the home tab; this screen is just the roster.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../constants/theme';
import { useMyTeamData } from '../hooks/useMyTeamData';
import RosterBuilder from './RosterBuilder';

export default function MyTeamScreen() {
  const { isLoading, roster, hasRoster, onRefresh } = useMyTeamData();
  const [showRosterBuilder, setShowRosterBuilder] = useState(false);

  const handleRosterSaved = useCallback(() => {
    setShowRosterBuilder(false);
    onRefresh();
  }, [onRefresh]);

  if (isLoading) {
    return (
      <View style={styles.centered} testID="my-team-loading">
        <ActivityIndicator size="large" color={rinkGlass.blueLight} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!hasRoster ? (
        <View style={styles.emptyState} testID="my-team-empty">
          <View style={styles.emptyIconWrapper}>
            <Ionicons name="trophy-outline" size={56} color={rinkGlass.blueLight} />
          </View>
          <Text style={styles.emptyTitle}>Build Your Roster</Text>
          <Text style={styles.emptyDescription}>
            Search NHL players and save the names on your fantasy team. Tonight and News only follow those players.
          </Text>
          <TouchableOpacity
            onPress={() => setShowRosterBuilder(true)}
            activeOpacity={0.85}
            testID="setup-roster-button"
          >
            <View style={styles.ctaButton}>
              <Ionicons name="add-circle" size={20} color="#0a0e1a" />
              <Text style={styles.ctaText}>Add Players</Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} testID="my-team-roster">
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Roster</Text>
              <Text style={styles.headerMeta}>
                {`${roster?.players.length ?? 0} players · ${roster?.scoringFormat === 'espn' ? 'ESPN' : 'Yahoo'} scoring`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowRosterBuilder(true)}
              style={styles.editButton}
              testID="edit-roster-button"
            >
              <Ionicons name="pencil" size={16} color={rinkGlass.blueLight} />
            </TouchableOpacity>
          </View>

          {roster?.players.map((player) => (
            <View key={player.playerId} style={styles.playerRow} testID="roster-player-row">
              <View style={styles.playerText}>
                <Text style={styles.playerName}>{player.playerName}</Text>
                <Text style={styles.playerMeta}>
                  {player.position} · {player.teamAbbrev}
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
    backgroundColor: rinkGlass.ice,
  },
  centered: {
    flex: 1,
    backgroundColor: rinkGlass.ice,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconWrapper: {
    width: 96,
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: rinkGlass.fonts.display,
    color: rinkGlass.textPrimary,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 15,
    color: rinkGlass.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 320,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: rinkGlass.blueLight,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 10,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0a0e1a',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 12,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: rinkGlass.fonts.display,
    color: rinkGlass.textPrimary,
    marginBottom: 6,
  },
  headerMeta: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
    fontWeight: '600',
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${rinkGlass.blueLight}1F`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerRow: {
    backgroundColor: rinkGlass.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    padding: 14,
    marginBottom: 8,
  },
  playerText: {
    gap: 4,
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
});
