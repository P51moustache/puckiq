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
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
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
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return (
    <PremiumGate feature="My Team">
      <View style={styles.container}>
        {/* Empty state: no roster */}
        {!hasRoster ? (
          <Animated.View
            entering={FadeIn.duration(500)}
            style={styles.emptyState}
            testID="my-team-empty"
          >
            {/* Glowing icon */}
            <View style={styles.emptyIconWrapper}>
              <View style={styles.emptyIconGlow} />
              <Ionicons name="trophy-outline" size={56} color="#60a5fa" />
            </View>

            <Text style={styles.emptyTitle}>Build Your Roster</Text>
            <Text style={styles.emptyDescription}>
              Get personalized start/sit recommendations, projected points, and waiver wire picks
            </Text>

            {/* CTA Button */}
            <TouchableOpacity
              onPress={() => setShowRosterBuilder(true)}
              activeOpacity={0.85}
              testID="setup-roster-button"
            >
              <LinearGradient
                colors={['#60a5fa', '#3b82f6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaButton}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.ctaText}>Add Players</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Preview teaser cards */}
            <View style={styles.previewCards}>
              <Animated.View
                entering={FadeInDown.delay(200).duration(400)}
                style={styles.previewCard}
              >
                <View style={[styles.previewBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                  <Text style={[styles.previewBadgeText, { color: '#10b981' }]}>START</Text>
                </View>
                <Text style={styles.previewPlayerName}>C. McDavid</Text>
                <Text style={styles.previewPoints}>4.2 pts</Text>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(300).duration(400)}
                style={styles.previewCard}
              >
                <View style={[styles.previewBadge, { backgroundColor: 'rgba(96, 165, 250, 0.2)' }]}>
                  <Text style={[styles.previewBadgeText, { color: '#60a5fa' }]}>PROJ</Text>
                </View>
                <Text style={styles.previewPlayerName}>N. MacKinnon</Text>
                <Text style={styles.previewPoints}>3.8 pts</Text>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(400).duration(400)}
                style={styles.previewCard}
              >
                <View style={[styles.previewBadge, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                  <Text style={[styles.previewBadgeText, { color: '#f59e0b' }]}>WAIVER</Text>
                </View>
                <Text style={styles.previewPlayerName}>M. Boldy</Text>
                <Text style={styles.previewPoints}>2.6 pts</Text>
              </Animated.View>
            </View>
          </Animated.View>
        ) : (
          /* Roster view */
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={onRefresh}
                tintColor="#60a5fa"
                colors={['#60a5fa']}
              />
            }
            testID="my-team-roster"
          >
            {/* Header */}
            <Animated.View
              entering={FadeIn.duration(300)}
              style={styles.headerRow}
            >
              <View>
                <Text style={styles.headerTitle}>My Team</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.weekBadge}>
                    <Text style={styles.weekBadgeText}>Week {weekNumber}</Text>
                  </View>
                  <LinearGradient
                    colors={['#60a5fa', '#3b82f6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.formatBadge}
                  >
                    <Text style={styles.formatBadgeText}>
                      {formatScoringBadge(roster?.scoringFormat)}
                    </Text>
                  </LinearGradient>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowRosterBuilder(true)}
                style={styles.editButton}
                testID="edit-roster-button"
              >
                <Ionicons name="pencil" size={16} color="#60a5fa" />
              </TouchableOpacity>
            </Animated.View>

            {/* Today's Lineup */}
            {lineup.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>TODAY'S LINEUP</Text>
                  <View style={styles.sectionUnderline} />
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
                  <Text style={styles.sectionTitle}>BENCH</Text>
                  <View style={[styles.sectionUnderline, { backgroundColor: '#98a6bf' }]} />
                </View>
                {bench.map((p, idx) => (
                  <StartSitCard key={p.playerId} projection={p} index={idx} />
                ))}
              </View>
            )}

            {/* No projections at all */}
            {lineup.length === 0 && bench.length === 0 && (
              <Animated.View
                entering={FadeIn.duration(300)}
                style={styles.noProjections}
              >
                <Ionicons name="time-outline" size={28} color="#98a6bf" />
                <Text style={styles.noProjectionsText}>
                  No projections available for today. Check back when games are scheduled.
                </Text>
              </Animated.View>
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
    backgroundColor: '#071023',
  },
  centered: {
    flex: 1,
    backgroundColor: '#071023',
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
  },
  emptyIconGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#e6eef8',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 15,
    color: '#98a6bf',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 320,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#3b82f6',
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
    backgroundColor: 'rgba(25, 46, 94, 0.6)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(42, 64, 128, 0.5)',
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
    color: 'rgba(230, 238, 248, 0.5)',
    marginBottom: 4,
    textAlign: 'center',
  },
  previewPoints: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(96, 165, 250, 0.5)',
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
    color: '#e6eef8',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  weekBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#98a6bf',
  },
  formatBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  formatBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
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
    color: '#98a6bf',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  sectionUnderline: {
    height: 2,
    width: 32,
    borderRadius: 1,
    backgroundColor: '#60a5fa',
  },
  noProjections: {
    backgroundColor: '#192e5e',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a4080',
    gap: 10,
  },
  noProjectionsText: {
    fontSize: 14,
    color: '#98a6bf',
    textAlign: 'center',
    lineHeight: 20,
  },
});
