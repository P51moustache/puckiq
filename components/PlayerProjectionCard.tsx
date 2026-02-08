/**
 * PlayerProjectionCard — Tonight's Edge projection card.
 * Shows a player's projected stat line for tonight's game with
 * OVER/UNDER arrows, confidence badge, and matchup info.
 */

import React, { useCallback, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import type {
  PlayerProjection,
  StatProjection,
  ProjectionConfidence,
  StatCategory,
} from '../services/playerTrends';

// ---------------------------------------------------------------------------
// Color mappings
// ---------------------------------------------------------------------------

const TREND_COLORS: Record<string, string> = {
  HOT: '#ef4444',
  WARM: '#f97316',
  STEADY: '#60a5fa',
  COOL: '#38bdf8',
  COLD: '#6366f1',
};

const CONFIDENCE_COLORS: Record<ProjectionConfidence, string> = {
  HIGH: theme.semantic.positive,
  MEDIUM: '#fbbf24',
  LOW: '#6b7280',
};

const STAT_LABELS: Record<StatCategory, string> = {
  goals: 'G',
  assists: 'A',
  points: 'P',
  shots: 'SOG',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlayerProjectionCardProps {
  projection: PlayerProjection;
  /** Which stat categories to feature (defaults to top 3 projections) */
  featuredStats?: StatCategory[];
  onPress: (playerId: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default React.memo(function PlayerProjectionCard({
  projection,
  featuredStats,
  onPress,
}: PlayerProjectionCardProps) {
  const teamColors = getTeamColors(projection.teamAbbrev);
  const trendColor = TREND_COLORS[projection.trendLabel] || theme.accent;
  const confColor = CONFIDENCE_COLORS[projection.confidence];

  const handlePress = useCallback(
    () => onPress(projection.playerId),
    [onPress, projection.playerId],
  );

  // Pick projections to display: featured stats or top 3
  const displayProjections = useMemo(() => {
    if (featuredStats && featuredStats.length > 0) {
      return projection.projections.filter(p => featuredStats.includes(p.stat));
    }
    return projection.projections.slice(0, 3);
  }, [projection.projections, featuredStats]);

  const gameTimeStr = useMemo(
    () => formatGameTime(projection.matchup.gameTime),
    [projection.matchup.gameTime],
  );

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={handlePress}
      testID={`projection-card-${projection.playerId}`}
    >
      {/* Team color accent bar */}
      <View style={[styles.accentBar, { backgroundColor: teamColors.primary }]} />

      <View style={styles.cardContent}>
        {/* Header row: headshot, name, matchup, badges */}
        <View style={styles.headerRow}>
          <Image
            source={{ uri: projection.headshotUrl }}
            style={[styles.headshot, { borderColor: teamColors.primary + '44' }]}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={`proj-${projection.playerId}`}
            accessibilityLabel={`${projection.playerName} headshot`}
          />
          <View style={styles.nameContainer}>
            <Text style={styles.playerName} numberOfLines={1}>
              {projection.firstName} {projection.lastName}
            </Text>
            <Text style={styles.matchupText}>
              {projection.position} · {projection.teamAbbrev}
              {' vs '}{projection.matchup.opponent}
            </Text>
            {gameTimeStr && (
              <Text style={styles.gameTimeText}>
                {gameTimeStr}
                {projection.matchup.isHome ? ' · HOME' : ' · AWAY'}
              </Text>
            )}
          </View>

          {/* Badges column */}
          <View style={styles.badgeColumn}>
            <View style={[styles.confidenceBadge, { backgroundColor: confColor + '22', borderColor: confColor }]}>
              <Text style={[styles.confidenceBadgeText, { color: confColor }]}>
                {projection.confidence}
              </Text>
            </View>
            <View style={[styles.trendBadge, { backgroundColor: trendColor + '22', borderColor: trendColor }]}>
              <Text style={[styles.trendBadgeText, { color: trendColor }]}>
                {projection.trendLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* Projection rows */}
        <View style={styles.projectionsContainer}>
          {displayProjections.map((proj) => (
            <ProjectionRow key={proj.stat} projection={proj} />
          ))}
        </View>

        {/* Streak info */}
        {projection.pointStreak > 0 && (
          <View style={styles.streakRow}>
            <Ionicons name="flame" size={14} color="#f97316" />
            <Text style={styles.streakText}>
              {projection.pointStreak}-game point streak
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// ProjectionRow sub-component
// ---------------------------------------------------------------------------

function ProjectionRow({ projection }: { projection: StatProjection }) {
  const isOver = projection.direction === 'OVER';
  const arrowColor = isOver ? theme.semantic.positive : theme.semantic.negative;
  const arrowIcon = isOver ? 'arrow-up' : 'arrow-down';

  return (
    <View style={styles.projRow}>
      <Text style={styles.projStatLabel}>{STAT_LABELS[projection.stat]}</Text>
      <View style={styles.projValues}>
        <View style={styles.projectedContainer}>
          <Text style={[styles.projectedValue, { color: arrowColor }]}>
            {projection.projected.toFixed(2)}
          </Text>
          <Ionicons
            name={arrowIcon}
            size={12}
            color={arrowColor}
            style={styles.projArrow}
          />
        </View>
        <Text style={styles.projSeasonAvg}>
          avg {projection.seasonAvg.toFixed(2)}
        </Text>
      </View>
      <View style={[styles.directionBadge, { backgroundColor: arrowColor + '18' }]}>
        <Text style={[styles.directionText, { color: arrowColor }]}>
          {projection.direction === 'OVER' ? 'ABOVE' : 'BELOW'}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatGameTime(utcTime: string): string {
  if (!utcTime) return '';
  try {
    const date = new Date(utcTime);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  cardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  accentBar: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headshot: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.subtle,
    borderWidth: 2,
  },
  nameContainer: {
    flex: 1,
    marginLeft: 10,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 2,
  },
  matchupText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.subtext,
  },
  gameTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.accent,
    marginTop: 1,
  },

  // Badges
  badgeColumn: {
    alignItems: 'flex-end',
    gap: 4,
    marginLeft: 8,
  },
  confidenceBadge: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  confidenceBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  trendBadge: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  trendBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Projections
  projectionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  projRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projStatLabel: {
    width: 32,
    fontSize: 12,
    fontWeight: '700',
    color: theme.subtext,
    textTransform: 'uppercase',
  },
  projValues: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  projectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectedValue: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
  projArrow: {
    marginLeft: 2,
    marginTop: 1,
  },
  projSeasonAvg: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
  },
  directionBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  directionText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Streak
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  streakText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
  },
});
