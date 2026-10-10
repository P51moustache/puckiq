/**
 * "Similar players" on the player card: up to three probably-available players at his position
 * with the nearest value (chosen in services/fantasy/similarPlayers). Tapping one opens his card
 * in place. Hidden while there are no rows.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PickupCandidate } from '../../services/fantasy/pickups';
import { positionLabel } from '../../services/fantasy/positions';
import { formatValue } from '../../services/fantasy/scoring';
import { PlayerAvatar, PlayerName } from '../coach/PlayerAvatar';
import { Card, ColdBadge, colors, display, HotBadge, SectionLabel } from '../coach/ui';
import { sectionStyles } from './styles';

function valueLabel(row: PickupCandidate): string {
  return row.form.isGoalie ? 'VALUE / TEAM GM' : 'VALUE / GM';
}

function spokenLabel(row: PickupCandidate, position: string): string {
  const per = row.form.isGoalie ? 'per team game' : 'per game';
  return `${row.name}, ${position}, ${row.team}. Value ${formatValue(row.form.value)} ${per}. Opens his card.`;
}

export function SimilarPlayers({ rows, onOpen }: { rows: PickupCandidate[]; onOpen: (playerId: number) => void }) {
  if (rows.length === 0) return null;
  return (
    <>
      <SectionLabel title="Similar players" right={<Text style={sectionStyles.value}>likely available</Text>} />
      <Card style={styles.card} testID="player-similar">
        {rows.map((row, index) => {
          const position = positionLabel({ position: row.position });
          return (
            <Pressable
              key={row.playerId}
              onPress={() => onOpen(row.playerId)}
              style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && sectionStyles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={spokenLabel(row, position)}
              testID={`similar-player-${row.playerId}`}
            >
              <PlayerAvatar playerId={row.playerId} team={row.team} position={row.position} size={44} />
              <View style={styles.text}>
                <PlayerName name={row.name} size={16} />
                <View style={styles.meta}>
                  <Text style={styles.metaText}>{position} · {row.team}</Text>
                  {row.form.trend === 'hot' ? <HotBadge /> : row.form.trend === 'cold' ? <ColdBadge /> : null}
                </View>
              </View>
              <View style={styles.valueBox}>
                <Text style={styles.value}>{formatValue(row.form.value)}</Text>
                <Text style={styles.valueLabel}>{valueLabel(row)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          );
        })}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  text: {
    flex: 1,
    gap: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.sub,
  },
  valueBox: {
    alignItems: 'flex-end',
  },
  value: {
    ...display(22),
  },
  valueLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.muted,
  },
});
