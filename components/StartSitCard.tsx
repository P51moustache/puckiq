/**
 * StartSitCard
 * Compact player row showing start/sit recommendation with projected fantasy points.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';
import type { PlayerProjection, StartSitRec } from '../types/fantasy';

interface StartSitCardProps {
  projection: PlayerProjection;
  gameTime?: string;
}

const BADGE_COLORS: Record<StartSitRec, string> = {
  START: '#10b981',
  SIT: '#ef4444',
  UPSIDE: '#fbbf24',
  FLEX: '#60a5fa',
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

export default function StartSitCard({ projection, gameTime }: StartSitCardProps) {
  const badgeColor = BADGE_COLORS[projection.recommendation] ?? BADGE_COLORS.FLEX;
  const matchupText = projection.opponentAbbrev
    ? `${projection.isHome ? 'vs' : '@'} ${projection.opponentAbbrev}`
    : '';
  const timeText = gameTime ? formatGameTime(gameTime) : '';
  const contextParts = [matchupText, timeText].filter(Boolean);
  const contextText = contextParts.join(' \u2022 ');

  return (
    <View style={styles.container} testID="start-sit-card">
      <View style={styles.left}>
        <View style={styles.nameRow}>
          <Text style={styles.playerName} numberOfLines={1}>
            {projection.playerName}
          </Text>
          <Text style={styles.meta}>
            {projection.teamAbbrev} \u2022 {projection.position}
          </Text>
        </View>
        {contextText ? (
          <Text style={styles.context}>{contextText}</Text>
        ) : null}
        {projection.reason ? (
          <Text style={styles.reason} numberOfLines={1}>
            {projection.reason}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={styles.points}>{projection.fantasyPoints.toFixed(1)}</Text>
        <Text style={styles.range}>
          {projection.floor.toFixed(1)}-{projection.ceiling.toFixed(1)}
        </Text>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{projection.recommendation}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  left: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    flexShrink: 1,
  },
  meta: {
    fontSize: 12,
    color: theme.subtext,
  },
  context: {
    fontSize: 12,
    color: theme.subtext,
    marginTop: 2,
  },
  reason: {
    fontSize: 12,
    color: theme.accent,
    marginTop: 2,
    fontStyle: 'italic',
  },
  right: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  points: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  range: {
    fontSize: 11,
    color: theme.subtext,
    marginTop: 1,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
});
