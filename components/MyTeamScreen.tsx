/**
 * MyTeamScreen
 * Main screen component for the Fantasy Command Center "My Team" tab.
 * Shows empty state when no roster, full roster view with start/sit, outlook, waiver wire.
 * Wrapped in PremiumGate.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import PremiumGate from './PremiumGate';
import StartSitCard from './StartSitCard';
import WeeklyOutlook from './WeeklyOutlook';
import WaiverWireSection from './WaiverWireSection';
import RosterBuilder from './RosterBuilder';
import { useMyTeamData } from '../hooks/useMyTeamData';
import type { PlayerProjection } from '../types/fantasy';

function getWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
}

function formatScoringBadge(format?: string): string {
  if (format === 'espn') return 'ESPN';
  return 'Yahoo';
}

export default function MyTeamScreen() {
  const {
    isLoading,
    roster,
    projections,
    waiverPicks,
    hasRoster,
    onRefresh,
  } = useMyTeamData();

  const [showRosterBuilder, setShowRosterBuilder] = useState(false);

  const handleRosterSaved = useCallback(() => {
    setShowRosterBuilder(false);
    onRefresh();
  }, [onRefresh]);

  // Split projections into active lineup (has game today) vs bench
  const { lineup, bench } = useMemo(() => {
    if (!roster || projections.length === 0) {
      return { lineup: [] as PlayerProjection[], bench: [] as PlayerProjection[] };
    }

    const projectedPlayerIds = new Set(projections.map(p => p.playerId));
    const lineupPlayers = projections
      .filter(p => p.recommendation !== 'SIT')
      .sort((a, b) => b.fantasyPoints - a.fantasyPoints);
    const benchPlayers = projections
      .filter(p => p.recommendation === 'SIT')
      .sort((a, b) => b.fantasyPoints - a.fantasyPoints);

    // Players on roster without projections go to bench
    const rosterWithoutProjections = roster.players
      .filter(p => !projectedPlayerIds.has(p.playerId))
      .map(p => ({
        playerId: p.playerId,
        playerName: p.playerName,
        teamAbbrev: p.teamAbbrev,
        position: p.position,
        fantasyPoints: 0,
        floor: 0,
        ceiling: 0,
        predGoals: 0,
        predAssists: 0,
        predSog: 0,
        predHits: 0,
        predBlocks: 0,
        recommendation: 'SIT' as const,
        confidence: 'low',
        reason: 'No game today',
        gameId: 0,
        opponentAbbrev: '',
        isHome: false,
      }));

    return {
      lineup: lineupPlayers,
      bench: [...benchPlayers, ...rosterWithoutProjections],
    };
  }, [roster, projections]);

  const weekNumber = getWeekNumber();

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.centered} testID="my-team-loading">
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <PremiumGate feature="My Team">
      <View style={styles.container}>
        {/* Empty state: no roster */}
        {!hasRoster ? (
          <View style={styles.emptyState} testID="my-team-empty">
            <Ionicons name="people-outline" size={56} color={theme.subtext} />
            <Text style={styles.emptyTitle}>Set Up Your Roster</Text>
            <Text style={styles.emptyDescription}>
              Add your fantasy players to get personalized start/sit recommendations
            </Text>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => setShowRosterBuilder(true)}
              testID="setup-roster-button"
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.ctaText}>Build My Roster</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Roster view */
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={onRefresh}
                tintColor={theme.accent}
              />
            }
            testID="my-team-roster"
          >
            {/* Header */}
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.headerTitle}>My Team — Week {weekNumber}</Text>
                <View style={styles.formatBadge}>
                  <Text style={styles.formatBadgeText}>
                    {formatScoringBadge(roster?.scoringFormat)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowRosterBuilder(true)}
                testID="edit-roster-button"
              >
                <Ionicons name="pencil-outline" size={20} color={theme.accent} />
              </TouchableOpacity>
            </View>

            {/* Today's Lineup */}
            {lineup.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Today's Lineup ({lineup.length})
                </Text>
                {lineup.map(p => (
                  <StartSitCard key={p.playerId} projection={p} />
                ))}
              </View>
            )}

            {/* Bench / No Game */}
            {bench.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Bench ({bench.length})
                </Text>
                {bench.map(p => (
                  <StartSitCard key={p.playerId} projection={p} />
                ))}
              </View>
            )}

            {/* No projections at all */}
            {lineup.length === 0 && bench.length === 0 && (
              <View style={styles.noProjections}>
                <Text style={styles.noProjectionsText}>
                  No projections available for today. Check back when games are scheduled.
                </Text>
              </View>
            )}

            {/* Weekly Outlook */}
            <WeeklyOutlook projections={projections} />

            {/* Waiver Wire */}
            <WaiverWireSection picks={waiverPicks} />
          </ScrollView>
        )}

        {/* Roster Builder Modal */}
        <RosterBuilder
          visible={showRosterBuilder}
          onDismiss={() => setShowRosterBuilder(false)}
          onSaved={handleRosterSaved}
          existingRoster={roster}
        />
      </View>
    </PremiumGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centered: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 15,
    color: theme.subtext,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.accent,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    gap: 8,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 12,
    paddingBottom: 40,
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.text,
  },
  formatBadge: {
    backgroundColor: theme.factbox,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  formatBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.accent,
  },
  // Sections
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.subtext,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noProjections: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  noProjectionsText: {
    fontSize: 14,
    color: theme.subtext,
    textAlign: 'center',
    lineHeight: 20,
  },
});
