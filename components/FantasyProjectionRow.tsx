import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../constants/theme';
import type { PlayerProjection } from '../types/fantasy';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FantasyProjectionRowProps {
  projection: PlayerProjection;
  onPress?: (playerId: number) => void;
}

// ---------------------------------------------------------------------------
// Recommendation badge colors
// ---------------------------------------------------------------------------

const REC_COLORS: Record<string, { bg: string; text: string }> = {
  START: { bg: rinkGlass.faceoffDot + '26', text: rinkGlass.faceoffDot },
  UPSIDE: { bg: rinkGlass.blueLight + '26', text: rinkGlass.blueLight },
  FLEX: { bg: rinkGlass.powerPlay + '26', text: rinkGlass.powerPlay },
  SIT: { bg: rinkGlass.redLine + '26', text: rinkGlass.redLine },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FantasyProjectionRow({ projection, onPress }: FantasyProjectionRowProps) {
  const recColor = REC_COLORS[projection.recommendation] || REC_COLORS.FLEX;
  const opponentLabel = projection.opponentAbbrev
    ? `${projection.isHome ? 'vs' : '@'} ${projection.opponentAbbrev}`
    : '';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress?.(projection.playerId)}
      activeOpacity={0.7}
      testID={`fantasy-projection-row-${projection.playerId}`}
    >
      {/* Left: Name, team, position, opponent */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.playerName} numberOfLines={1}>
            {projection.playerName}
          </Text>
          <View style={styles.positionBadge}>
            <Text style={styles.positionText}>{projection.position}</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.teamText}>{projection.teamAbbrev}</Text>
          {opponentLabel !== '' && (
            <Text style={styles.opponentText}>{opponentLabel}</Text>
          )}
          {projection.recommendation && (
            <View style={[styles.recBadge, { backgroundColor: recColor.bg }]}>
              <Text style={[styles.recText, { color: recColor.text }]}>
                {projection.recommendation}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.rangeText}>
          Floor: {projection.floor.toFixed(1)} — Ceil: {projection.ceiling.toFixed(1)}
        </Text>
      </View>

      {/* Right: Projected points */}
      <View style={styles.pointsContainer}>
        <Text style={styles.pointsValue}>{projection.fantasyPoints.toFixed(1)}</Text>
        <Text style={styles.pointsLabel}>FPts</Text>
      </View>

      <Ionicons name="chevron-forward" size={14} color={rinkGlass.textSecondary} />
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: rinkGlass.glass,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    flexShrink: 1,
  },
  positionBadge: {
    backgroundColor: rinkGlass.blueLight + '22',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  positionText: {
    fontSize: 10,
    fontWeight: '800',
    color: rinkGlass.blueLight,
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  teamText: {
    fontSize: 12,
    fontWeight: '600',
    color: rinkGlass.textSecondary,
  },
  opponentText: {
    fontSize: 12,
    fontWeight: '600',
    color: rinkGlass.textSecondary,
  },
  recBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  recText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rangeText: {
    fontSize: 11,
    fontWeight: '500',
    color: rinkGlass.textSecondary,
    fontFamily: rinkGlass.fonts.mono,
  },
  pointsContainer: {
    alignItems: 'center',
    marginRight: 8,
  },
  pointsValue: {
    fontSize: 20,
    fontWeight: '900',
    color: rinkGlass.blueLight,
    fontFamily: rinkGlass.fonts.mono,
    fontVariant: ['tabular-nums'] as any,
  },
  pointsLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: rinkGlass.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
