/**
 * WaiverWireSection
 * Premium waiver wire recommendations with broadcast-quality card design.
 * Top 3 compact pickup cards with trending indicators.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import type { PlayerProjection } from '../types/fantasy';

interface WaiverWireSectionProps {
  picks: PlayerProjection[];
  onSeeAll?: () => void;
}

export default function WaiverWireSection({ picks, onSeeAll }: WaiverWireSectionProps) {
  if (picks.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(300).duration(400).springify()}
      style={styles.container}
      testID="waiver-wire-section"
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>WAIVER WIRE</Text>
            <Text style={styles.fireEmoji}>{'\ud83d\udd25'}</Text>
          </View>
          <View style={styles.headerUnderline} />
        </View>
        {onSeeAll && (
          <TouchableOpacity
            onPress={onSeeAll}
            style={styles.seeAllButton}
            testID="waiver-see-all"
          >
            <Text style={styles.seeAllText}>See All</Text>
            <Ionicons name="chevron-forward" size={14} color="#60a5fa" />
          </TouchableOpacity>
        )}
      </View>

      {/* Player cards */}
      {picks.map((player, idx) => (
        <View key={player.playerId} style={styles.playerCard}>
          {/* Rank number */}
          <View style={styles.rankCol}>
            <LinearGradient
              colors={['#60a5fa', '#3b82f6']}
              style={styles.rankBadge}
            >
              <Text style={styles.rankText}>{idx + 1}</Text>
            </LinearGradient>
          </View>

          {/* Player info */}
          <View style={styles.playerInfo}>
            <Text style={styles.playerName} numberOfLines={1}>
              {player.playerName}
            </Text>
            <View style={styles.playerMetaRow}>
              <Text style={styles.playerMeta}>
                {player.teamAbbrev} \u00b7 {player.position}
              </Text>
              {player.opponentAbbrev ? (
                <Text style={styles.matchupText}>
                  {player.isHome ? 'vs' : '@'} {player.opponentAbbrev}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Points + Trending */}
          <View style={styles.pointsCol}>
            <Text style={styles.points}>{player.fantasyPoints.toFixed(1)}</Text>
            <Text style={styles.pointsLabel}>pts</Text>
            <View style={styles.trendBadge}>
              <Ionicons name="trending-up" size={10} color="#10b981" />
              <Text style={styles.trendText}>HOT</Text>
            </View>
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#192e5e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a4080',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'column',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#e6eef8',
    letterSpacing: 1.5,
  },
  fireEmoji: {
    fontSize: 14,
  },
  headerUnderline: {
    height: 2,
    width: 40,
    borderRadius: 1,
    backgroundColor: '#f59e0b',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#60a5fa',
  },
  // Player cards
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  rankCol: {
    marginRight: 12,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  playerInfo: {
    flex: 1,
    marginRight: 12,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e6eef8',
    marginBottom: 2,
  },
  playerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerMeta: {
    fontSize: 12,
    color: '#98a6bf',
    fontWeight: '500',
  },
  matchupText: {
    fontSize: 12,
    color: '#98a6bf',
    fontWeight: '500',
  },
  pointsCol: {
    alignItems: 'flex-end',
    minWidth: 52,
  },
  points: {
    fontSize: 20,
    fontWeight: '800',
    color: '#60a5fa',
    lineHeight: 24,
  },
  pointsLabel: {
    fontSize: 10,
    color: '#98a6bf',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  trendText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.5,
  },
});
