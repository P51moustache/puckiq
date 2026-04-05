import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
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
  START: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
  UPSIDE: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
  FLEX: { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24' },
  SIT: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
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

      <Ionicons name="chevron-forward" size={14} color={theme.subtext} />
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
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
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
    color: theme.text,
    flexShrink: 1,
  },
  positionBadge: {
    backgroundColor: theme.accent + '22',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  positionText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.accent,
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
    color: theme.subtext,
  },
  opponentText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.subtext,
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
    color: theme.subtext,
  },
  pointsContainer: {
    alignItems: 'center',
    marginRight: 8,
  },
  pointsValue: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.accent,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
  pointsLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.subtext,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
