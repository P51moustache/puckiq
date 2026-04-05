/**
 * WaiverWireSection
 * Shows top waiver wire pickup recommendations.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../constants/theme';
import type { PlayerProjection } from '../types/fantasy';

interface WaiverWireSectionProps {
  picks: PlayerProjection[];
  onSeeAll?: () => void;
}

export default function WaiverWireSection({ picks, onSeeAll }: WaiverWireSectionProps) {
  if (picks.length === 0) return null;

  return (
    <View style={styles.container} testID="waiver-wire-section">
      <View style={styles.headerRow}>
        <Text style={styles.header}>Waiver Wire Picks</Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} testID="waiver-see-all">
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        )}
      </View>
      {picks.map(player => (
        <View key={player.playerId} style={styles.playerRow}>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName} numberOfLines={1}>
              {player.playerName}
            </Text>
            <Text style={styles.playerMeta}>
              {player.teamAbbrev} \u2022 {player.position}
            </Text>
          </View>
          <View style={styles.pointsCol}>
            <Text style={styles.points}>{player.fantasyPoints.toFixed(1)}</Text>
            <Text style={styles.pointsLabel}>pts</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  header: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.accent,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  playerMeta: {
    fontSize: 12,
    color: theme.subtext,
    marginTop: 1,
  },
  pointsCol: {
    alignItems: 'flex-end',
    minWidth: 48,
  },
  points: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.accent,
  },
  pointsLabel: {
    fontSize: 10,
    color: theme.subtext,
  },
});
