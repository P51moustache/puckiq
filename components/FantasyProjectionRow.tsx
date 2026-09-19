import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../constants/theme';
import { arenaType } from '../constants/arenaTypography';
import { getArenaPalette, type ArenaPalette } from '../constants/arenaTheme';
import type { PlayerProjection } from '../types/fantasy';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FantasyProjectionRowProps {
  projection: PlayerProjection;
  onPress?: (playerId: number) => void;
  palette?: ArenaPalette;
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

export default function FantasyProjectionRow({ projection, onPress, palette }: FantasyProjectionRowProps) {
  const p = palette ?? getArenaPalette();
  const recColor = projection.recommendation ? REC_COLORS[projection.recommendation] : null;
  const opponentLabel = projection.opponentAbbrev
    ? `${projection.isHome ? 'vs' : '@'} ${projection.opponentAbbrev}`
    : '';

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: p.paper, borderColor: p.edge }]}
      onPress={() => onPress?.(projection.playerId)}
      activeOpacity={0.7}
      testID={`fantasy-projection-row-${projection.playerId}`}
    >
      {/* Left: Name, team, position, opponent */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.playerName, { color: p.ink, fontFamily: arenaType.body }]} numberOfLines={1}>
            {projection.playerName}
          </Text>
          <View style={[styles.positionBadge, { backgroundColor: p.soft }]}>
            <Text style={[styles.positionText, { color: p.link }]}>{projection.position}</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.teamText, { color: p.muted }]}>{projection.teamAbbrev}</Text>
          {opponentLabel !== '' && (
            <Text style={[styles.opponentText, { color: p.muted }]}>{opponentLabel}</Text>
          )}
          {projection.recommendation && recColor ? (
            <View style={[styles.recBadge, { backgroundColor: recColor.bg }]}>
              <Text style={[styles.recText, { color: recColor.text }]}>
                {projection.recommendation}
              </Text>
            </View>
          ) : (
            <Text style={[styles.unavailableText, { color: p.muted }]}>Forecast only / recommendation unavailable</Text>
          )}
        </View>
        <Text style={[styles.rangeText, { color: p.muted, fontFamily: arenaType.body }]}>
          Floor: {projection.floor.toFixed(1)} — Ceil: {projection.ceiling.toFixed(1)}
        </Text>
      </View>

      {/* Right: Projected points */}
      <View style={styles.pointsContainer}>
        <Text style={[styles.pointsValue, { color: p.ink, fontFamily: arenaType.display }]}>{projection.fantasyPoints.toFixed(1)}</Text>
        <Text style={[styles.pointsLabel, { color: p.muted }]}>FPts</Text>
      </View>

      <Ionicons name="chevron-forward" size={14} color={p.link} />
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
  unavailableText: {
    fontSize: 10,
    fontWeight: '600',
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
