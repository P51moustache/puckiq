/**
 * MyTeamScreen
 * Premium Fantasy Command Center "My Team" tab.
 * Broadcast-quality sports analytics dashboard design.
 * Shows enticing empty state or full roster with start/sit, outlook, waiver wire.
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
import { rinkGlass } from '../constants/theme';
import PremiumGate from './PremiumGate';
import StartSitCard from './StartSitCard';
import WeeklyOutlook from './WeeklyOutlook';
import WaiverWireSection from './WaiverWireSection';
import RosterBuilder from './RosterBuilder';
import { useMyTeamData } from '../hooks/useMyTeamData';
import type { PlayerProjection } from '../types/fantasy';
import { useArena } from './arena/ArenaProvider';
import { arenaType } from '../constants/arenaTypography';

interface UnavailableRosterPlayer {
  playerId: number;
  playerName: string;
  teamAbbrev: string;
  position: string;
}

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
  const { palette: p } = useArena();
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
  const { lineup, bench, unavailable } = useMemo(() => {
    if (!roster) {
      return {
        lineup: [] as PlayerProjection[],
        bench: [] as PlayerProjection[],
        unavailable: [] as UnavailableRosterPlayer[],
      };
    }

    const projectedPlayerIds = new Set(projections.map(p => p.playerId));
    const lineupPlayers = projections
      .filter(p => p.recommendation !== 'SIT')
      .sort((a, b) => b.fantasyPoints - a.fantasyPoints);
    const benchPlayers = projections
      .filter(p => p.recommendation === 'SIT')
      .sort((a, b) => b.fantasyPoints - a.fantasyPoints);

    const unavailablePlayers = roster.players
      .filter(p => !projectedPlayerIds.has(p.playerId))
      .map(p => ({
        playerId: p.playerId,
        playerName: p.playerName,
        teamAbbrev: p.teamAbbrev,
        position: p.position,
      }));

    return {
      lineup: lineupPlayers,
      bench: benchPlayers,
      unavailable: unavailablePlayers,
    };
  }, [roster, projections]);

  const weekNumber = getWeekNumber();

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: p.page }]} testID="my-team-loading">
        <ActivityIndicator size="large" color={p.action} />
      </View>
    );
  }

  return (
    <PremiumGate feature="My Team">
      <View style={[styles.container, { backgroundColor: p.page }]}>
        {/* Empty state: no roster */}
        {!hasRoster ? (
          <View
            style={styles.emptyState}
            testID="my-team-empty"
          >
            {/* Glowing icon */}
            <View style={[styles.emptyIconWrapper, { backgroundColor: p.soft, borderColor: p.edge }]}>
              <Ionicons name="people-outline" size={44} color={p.link} />
            </View>

            <Text accessibilityRole="header" style={[styles.emptyTitle, { color: p.ink, fontFamily: arenaType.display }]}>BUILD YOUR ROSTER</Text>
            <Text style={[styles.emptyDescription, { color: p.muted, fontFamily: arenaType.body }]}>
              Get personalized start/sit recommendations, projected points, and waiver wire picks
            </Text>

            {/* CTA Button */}
            <TouchableOpacity
              onPress={() => setShowRosterBuilder(true)}
              activeOpacity={0.85}
              testID="setup-roster-button"
              accessibilityRole="button"
              accessibilityLabel="Add players to roster"
            >
              <View style={[styles.ctaButton, { backgroundColor: p.action, borderColor: p.frame, shadowColor: p.frame }]}>
                <Ionicons name="add-circle" size={20} color={p.actionInk} />
                <Text style={[styles.ctaText, { color: p.actionInk, fontFamily: arenaType.body }]}>Add Players</Text>
              </View>
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
                tintColor={p.action}
                colors={[p.action]}
              />
            }
            testID="my-team-roster"
          >
            {/* Header */}
            <View
              style={styles.headerRow}
            >
              <View>
                <Text accessibilityRole="header" style={[styles.headerTitle, { color: p.ink, fontFamily: arenaType.display }]}>MY TEAM</Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.weekBadge, { backgroundColor: p.soft }]}>
                    <Text style={[styles.weekBadgeText, { color: p.muted }]}>Week {weekNumber}</Text>
                  </View>
                  <View style={[styles.formatBadge, { backgroundColor: p.action }]}>
                    <Text style={[styles.formatBadgeText, { color: p.actionInk }]}>
                      {formatScoringBadge(roster?.scoringFormat)}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowRosterBuilder(true)}
                style={[styles.editButton, { backgroundColor: p.soft, borderColor: p.edge }]}
                testID="edit-roster-button"
                accessibilityRole="button"
                accessibilityLabel="Edit roster"
              >
                <Ionicons name="pencil" size={19} color={p.link} />
              </TouchableOpacity>
            </View>

            {/* Today's Lineup */}
            {lineup.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: p.muted, fontFamily: arenaType.display }]}>TODAY'S LINEUP</Text>
                  <View style={[styles.sectionUnderline, { backgroundColor: p.action }]} />
                </View>
                {lineup.map((p, idx) => (
                  <StartSitCard key={p.playerId} projection={p} index={idx} />
                ))}
              </View>
            )}

            {/* Bench / No Game */}
            {bench.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: p.muted, fontFamily: arenaType.display }]}>BENCH</Text>
                  <View style={[styles.sectionUnderline, { backgroundColor: p.muted }]} />
                </View>
                {bench.map((p, idx) => (
                  <StartSitCard key={p.playerId} projection={p} index={idx} />
                ))}
              </View>
            )}

            {unavailable.length > 0 && (
              <View style={styles.section} testID="my-team-unavailable-roster">
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: p.muted, fontFamily: arenaType.display }]}>FORECAST UNAVAILABLE</Text>
                  <View style={[styles.sectionUnderline, { backgroundColor: p.muted }]} />
                </View>
                {unavailable.map((player) => (
                  <View key={player.playerId} style={[styles.unavailablePlayer, { backgroundColor: p.paper, borderColor: p.edge }]} testID={`unavailable-roster-player-${player.playerId}`}>
                    <Text style={[styles.unavailablePlayerName, { color: p.ink, fontFamily: arenaType.body }]}>{player.playerName}</Text>
                    <Text style={[styles.unavailablePlayerMeta, { color: p.muted }]}>
                      {player.position} · {player.teamAbbrev}
                    </Text>
                    <Text style={[styles.unavailablePlayerReason, { color: p.muted }]}>Projection unavailable</Text>
                  </View>
                ))}
              </View>
            )}

            {/* No projections at all */}
            {lineup.length === 0 && bench.length === 0 && unavailable.length === 0 && (
              <View
                style={[styles.noProjections, { backgroundColor: p.paper, borderColor: p.edge }]}
              >
                <Ionicons name="time-outline" size={28} color={p.muted} />
                <Text style={[styles.noProjectionsText, { color: p.muted }]}>
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
    backgroundColor: rinkGlass.ice,
  },
  centered: {
    flex: 1,
    backgroundColor: rinkGlass.ice,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Empty state ──────────────────────────────────────────
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
    borderWidth: 1,
    borderRadius: 24,
  },
  emptyIconGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: rinkGlass.cardGlow,
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
    shadowColor: rinkGlass.blueLight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  // Preview teaser cards
  previewCards: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 36,
    paddingHorizontal: 8,
  },
  previewCard: {
    flex: 1,
    backgroundColor: rinkGlass.glass,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  previewBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 8,
  },
  previewBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  previewPlayerName: {
    fontSize: 12,
    fontWeight: '600',
    color: rinkGlass.textMuted,
    marginBottom: 4,
    textAlign: 'center',
  },
  previewPoints: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: rinkGlass.fonts.display,
    color: rinkGlass.textSecondary,
  },
  // ── Scroll & Header ──────────────────────────────────────
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
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekBadge: {
    backgroundColor: rinkGlass.glass,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  weekBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: rinkGlass.textSecondary,
  },
  formatBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: rinkGlass.blueLight,
  },
  formatBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  editButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: `${rinkGlass.blueLight}1F`,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  // ── Sections ─────────────────────────────────────────────
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: rinkGlass.fonts.display,
    color: rinkGlass.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  sectionUnderline: {
    height: 2,
    width: 32,
    borderRadius: 1,
    backgroundColor: rinkGlass.blueLight,
  },
  unavailablePlayer: {
    backgroundColor: rinkGlass.glass,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  unavailablePlayerName: {
    fontSize: 15,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    marginBottom: 4,
  },
  unavailablePlayerMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: rinkGlass.textSecondary,
    marginBottom: 6,
  },
  unavailablePlayerReason: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
  },
  noProjections: {
    backgroundColor: rinkGlass.glass,
    borderRadius: 12,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    gap: 10,
  },
  noProjectionsText: {
    fontSize: 14,
    color: rinkGlass.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
