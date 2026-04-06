/**
 * StartSitCard
 * Premium player recommendation card with broadcast-quality design.
 * The hero component -- users see these every day.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { rinkGlass } from '../constants/theme';
import type { PlayerProjection, StartSitRec } from '../types/fantasy';

interface StartSitCardProps {
  projection: PlayerProjection;
  gameTime?: string;
  index?: number;
}

const BADGE_CONFIG: Record<StartSitRec, { color: string; label: string }> = {
  START: { color: rinkGlass.faceoffDot, label: 'START' },
  SIT: { color: rinkGlass.redLine, label: 'SIT' },
  UPSIDE: { color: rinkGlass.powerPlay, label: 'UPSIDE' },
  FLEX: { color: rinkGlass.blueLight, label: 'FLEX' },
};

const STRIPE_COLORS: Record<StartSitRec, string> = {
  START: rinkGlass.faceoffDot,
  SIT: rinkGlass.redLine,
  UPSIDE: rinkGlass.powerPlay,
  FLEX: rinkGlass.blueLight,
};

function formatGameTime(startTimeUTC?: string): string {
  if (!startTimeUTC) return '';
  try {
    const d = new Date(startTimeUTC);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function StartSitCard({ projection, gameTime, index = 0 }: StartSitCardProps) {
  const badge = BADGE_CONFIG[projection.recommendation] ?? BADGE_CONFIG.FLEX;
  const stripeColor = STRIPE_COLORS[projection.recommendation] ?? STRIPE_COLORS.FLEX;

  const matchupText = projection.opponentAbbrev
    ? `${projection.isHome ? 'vs' : '@'} ${projection.opponentAbbrev}`
    : '';
  const timeText = gameTime ? formatGameTime(gameTime) : '';
  const contextParts = [matchupText, timeText].filter(Boolean);
  const contextLine = contextParts.join(' \u00b7 ');

  const rangeWidth = projection.ceiling - projection.floor;
  const pointsInRange = rangeWidth > 0
    ? ((projection.fantasyPoints - projection.floor) / rangeWidth) * 100
    : 50;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(400).springify()}
      style={styles.wrapper}
      testID="start-sit-card"
    >
      {/* Left color stripe */}
      <View style={[styles.stripe, { backgroundColor: stripeColor }]} />

      <View style={styles.container}>
        {/* Top row: Badge + Player info */}
        <View style={styles.topRow}>
          <View style={[styles.badge, { backgroundColor: badge.color }]}>
            <Text style={styles.badgeText}>{badge.label}</Text>
          </View>
          <View style={styles.positionTeam}>
            <Text style={styles.positionText}>
              {projection.position} \u00b7 {projection.teamAbbrev}
            </Text>
          </View>
        </View>

        {/* Player name */}
        <Text style={styles.playerName} numberOfLines={1}>
          {projection.playerName}
        </Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Stats row: Projected points + Floor/Ceiling */}
        <View style={styles.statsRow}>
          <View style={styles.projectedCol}>
            <Text style={styles.projectedPoints}>
              {projection.fantasyPoints.toFixed(1)}
            </Text>
            <Text style={styles.projectedLabel}>pts projected</Text>
          </View>
          <View style={styles.rangeCol}>
            <View style={styles.rangeLabels}>
              <Text style={styles.rangeText}>
                Floor: {projection.floor.toFixed(1)}
              </Text>
              <Text style={styles.rangeText}>
                Ceil: {projection.ceiling.toFixed(1)}
              </Text>
            </View>
            {/* Range bar */}
            <View style={styles.rangeBarTrack}>
              <View
                style={[
                  styles.rangeBarFill,
                  {
                    width: `${Math.min(Math.max(pointsInRange, 5), 95)}%`,
                    backgroundColor: stripeColor,
                  },
                ]}
              />
              <View
                style={[
                  styles.rangeBarMarker,
                  {
                    left: `${Math.min(Math.max(pointsInRange, 5), 95)}%`,
                    backgroundColor: stripeColor,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Bottom row: Matchup + Reason */}
        <View style={styles.bottomRow}>
          {contextLine ? (
            <Text style={styles.contextText}>{contextLine}</Text>
          ) : null}
          {projection.reason ? (
            <Text style={styles.reasonText} numberOfLines={1}>
              {projection.reason}
            </Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    backgroundColor: rinkGlass.glass,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  stripe: {
    width: 4,
  },
  container: {
    flex: 1,
    padding: 14,
    paddingLeft: 12,
  },
  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  positionTeam: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  positionText: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
    fontWeight: '500',
  },
  // Player name
  playerName: {
    fontSize: 17,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    marginBottom: 8,
  },
  // Divider
  divider: {
    height: 1,
    backgroundColor: rinkGlass.glassBorder,
    marginBottom: 10,
  },
  // Stats row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  projectedCol: {
    marginRight: 20,
  },
  projectedPoints: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: rinkGlass.fonts.display,
    color: rinkGlass.textPrimary,
    lineHeight: 28,
  },
  projectedLabel: {
    fontSize: 11,
    color: rinkGlass.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  rangeCol: {
    flex: 1,
    paddingTop: 2,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rangeText: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
    fontWeight: '500',
  },
  rangeBarTrack: {
    height: 4,
    backgroundColor: rinkGlass.boards,
    borderRadius: 2,
    position: 'relative',
  },
  rangeBarFill: {
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  rangeBarMarker: {
    position: 'absolute',
    top: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
  },
  // Bottom row
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  contextText: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
    fontWeight: '500',
  },
  reasonText: {
    fontSize: 12,
    color: rinkGlass.blueLight,
    fontStyle: 'italic',
    fontWeight: '500',
    flexShrink: 1,
  },
});
