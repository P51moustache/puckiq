/** For my own players: league position eligibility (skaters) and the league-IR toggle. */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FantasyPlayer, SlotPosition } from '../../types/fantasy';
import { basePositions, isGoalie } from '../../services/fantasy/positions';
import { Card, colors, SectionLabel } from '../coach/ui';
import { sectionStyles } from './styles';

const EDITABLE_POSITIONS: SlotPosition[] = ['C', 'LW', 'RW', 'D'];

export function RosterSettings({
  rosterPlayer,
  onToggleEligible,
  onToggleIr,
}: {
  rosterPlayer: FantasyPlayer;
  onToggleEligible: (pos: SlotPosition) => void;
  onToggleIr: () => void;
}) {
  const eligible = basePositions(rosterPlayer);
  return (
    <>
      {!isGoalie(rosterPlayer) ? (
        <>
          <SectionLabel title="League eligibility" />
          <Card>
            <Text style={sectionStyles.help}>Match your league (e.g. Yahoo C/LW). Used for lineup slots.</Text>
            <View style={styles.chips}>
              {EDITABLE_POSITIONS.map((pos) => {
                const on = eligible.includes(pos);
                return (
                  <Pressable
                    key={pos}
                    onPress={() => onToggleEligible(pos)}
                    style={[styles.chip, on && styles.chipOn]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`Eligible at ${pos}`}
                    testID={`eligible-${pos}`}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{pos}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </>
      ) : null}
      <Card style={styles.irCard} onPress={onToggleIr} testID="player-ir-toggle">
        <Ionicons name={rosterPlayer.injuredReserve ? 'checkbox' : 'square-outline'} size={20} color={colors.accent} />
        <View style={styles.irText}>
          <Text style={styles.irTitle}>On my league’s IR</Text>
          <Text style={sectionStyles.help}>IR players never count toward lineups or games.</Text>
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  chipOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.sub,
  },
  chipTextOn: {
    color: colors.onAccent,
  },
  irCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  irText: {
    flex: 1,
  },
  irTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
});
