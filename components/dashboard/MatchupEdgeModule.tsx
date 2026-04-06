import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../../constants/theme';

export interface MatchupEdge {
  id: number;
  playerName: string;
  team: string;
  opponent: string;
  edgeRating: number;     // 1-10 scale
  projectedPoints: number;
  reasons: string[];
}

interface MatchupEdgeModuleProps {
  matchups: MatchupEdge[];
}

/** Map edgeRating (1-10) to a green with increasing intensity */
function getEdgeBadgeColor(rating: number): string {
  const clamped = Math.max(1, Math.min(10, rating));
  const opacity = 0.3 + (clamped / 10) * 0.7; // 0.3 to 1.0
  // Blend from muted to vivid green
  const r = Math.round(6 * (1 - opacity) + 6 * opacity);
  const g = Math.round(100 + (214 - 100) * (opacity));
  const b = Math.round(80 + (160 - 80) * (opacity));
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** High-edge cards (>= 7) get a subtle green-tinted background */
function getCardBackground(rating: number): string {
  if (rating >= 7) {
    return 'rgba(6, 214, 160, 0.08)';
  }
  return rinkGlass.glass;
}

function MatchupCard({ matchup, index }: { matchup: MatchupEdge; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Animated.View entering={FadeInUp.delay(index * 80).duration(400)}>
      <TouchableOpacity
        testID={`matchup-card-${matchup.id}`}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        style={[styles.card, { backgroundColor: getCardBackground(matchup.edgeRating) }]}
      >
        {/* Main row */}
        <View style={styles.cardRow}>
          {/* Left: player info */}
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{matchup.playerName}</Text>
            <Text style={styles.teamLabel}>{matchup.team}</Text>
          </View>

          {/* Center: opponent */}
          <View style={styles.opponentInfo}>
            <Text style={styles.opponentText}>vs {matchup.opponent}</Text>
          </View>

          {/* Right: edge badge + projected */}
          <View style={styles.ratingInfo}>
            <View
              testID={`edge-badge-${matchup.id}`}
              style={[styles.edgeBadge, { backgroundColor: getEdgeBadgeColor(matchup.edgeRating) }]}
            >
              <Text style={styles.edgeRatingText}>{matchup.edgeRating}</Text>
            </View>
            <Text style={styles.projectedPoints}>{matchup.projectedPoints}</Text>
            <Text style={styles.projLabel}>proj pts</Text>
          </View>
        </View>

        {/* Expanded reasons */}
        {expanded && (
          <View style={styles.reasonsContainer}>
            {matchup.reasons.map((reason, i) => (
              <View key={i} style={styles.reasonRow}>
                <Text style={styles.bulletDot}>{'\u2022'}</Text>
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MatchupEdgeModule({ matchups }: MatchupEdgeModuleProps) {
  const displayed = matchups.slice(0, 5);

  if (matchups.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.accentStripe, { backgroundColor: rinkGlass.moduleAccents.matchupEdge }]} />
          <Text style={styles.title}>Matchup Edge</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="shield-outline" size={32} color={rinkGlass.textMuted} />
          <Text style={styles.emptyText}>No matchup edges tonight</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.accentStripe, { backgroundColor: rinkGlass.moduleAccents.matchupEdge }]} />
        <Text style={styles.title}>Matchup Edge</Text>
      </View>
      <View style={styles.list}>
        {displayed.map((matchup, index) => (
          <MatchupCard key={matchup.id} matchup={matchup} index={index} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  accentStripe: {
    width: 3,
    height: 20,
    borderRadius: 2,
    marginRight: 10,
  },
  title: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 18,
    color: rinkGlass.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  list: {
    paddingHorizontal: 16,
    gap: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    borderRadius: 12,
    padding: 14,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 15,
    color: rinkGlass.textPrimary,
    fontWeight: '700',
  },
  teamLabel: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  opponentInfo: {
    flex: 1,
    alignItems: 'center',
  },
  opponentText: {
    fontSize: 13,
    color: rinkGlass.textMuted,
  },
  ratingInfo: {
    alignItems: 'center',
    minWidth: 60,
  },
  edgeBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  edgeRatingText: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 16,
    color: '#fff',
    fontWeight: '800',
  },
  projectedPoints: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 18,
    color: rinkGlass.textPrimary,
    lineHeight: 22,
  },
  projLabel: {
    fontSize: 9,
    color: rinkGlass.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reasonsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: rinkGlass.glassBorder,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bulletDot: {
    fontSize: 14,
    color: rinkGlass.moduleAccents.matchupEdge,
    marginRight: 8,
    lineHeight: 18,
  },
  reasonText: {
    flex: 1,
    fontSize: 13,
    color: rinkGlass.textSecondary,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: rinkGlass.textMuted,
  },
});
