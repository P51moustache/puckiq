/**
 * What a roster import found: players to add (ticked; "check" on loose readings), same-name
 * questions answered with a tap, and names it couldn't match.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ImportReview } from '../../services/rosterImport/review';
import { positionLabel } from '../../services/fantasy/positions';
import { PlayerAvatar } from '../coach/PlayerAvatar';
import { Card, colors, Pill, SectionLabel } from '../coach/ui';

export interface ImportReviewListProps {
  review: ImportReview;
  onToggle: (playerId: number) => void;
  onPick: (entry: number, playerId: number) => void;
}

export function ImportReviewList({ review, onToggle, onPick }: ImportReviewListProps) {
  const { match, alreadyOnTeam, checked, picks } = review;
  return (
    <View style={styles.list}>
      {match.matched.length > 0 ? (
        <Card style={styles.card}>
          {match.matched.map(({ player, confidence }, index) => {
            const onTeam = alreadyOnTeam.has(player.playerId);
            const on = checked.has(player.playerId);
            return (
              <Pressable
                key={player.playerId}
                onPress={() => onToggle(player.playerId)}
                disabled={onTeam}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on || onTeam, disabled: onTeam }}
                accessibilityLabel={`${player.firstName} ${player.lastName}, ${player.team}`}
                testID={`import-player-${player.playerId}`}
                style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed]}
              >
                <PlayerAvatar playerId={player.playerId} team={player.team} position={player.position} size={40} />
                <View style={styles.text}>
                  <Text style={[styles.name, !on && !onTeam && styles.off]} numberOfLines={1}>{player.firstName} {player.lastName}</Text>
                  <Text style={styles.meta}>{player.team} · {positionLabel({ position: player.position })}</Text>
                </View>
                {confidence === 'likely' && !onTeam ? <Pill label="CHECK" tone="warn" /> : null}
                {onTeam ? (
                  <Text style={styles.onTeam}>On your team</Text>
                ) : (
                  <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={on ? colors.accent : colors.muted} />
                )}
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {match.ambiguous.length > 0 ? (
        <>
          <SectionLabel title="Which one?" />
          {match.ambiguous.map((entry, index) => (
            <Card key={`${entry.source}-${index}`} style={styles.question} testID={`import-question-${index}`}>
              <Text style={styles.questionText}>Which {entry.options[0]?.lastName ?? entry.source}?</Text>
              <View style={styles.options}>
                {entry.options.map((option) => {
                  const on = picks[index] === option.playerId;
                  return (
                    <Pressable
                      key={option.playerId}
                      onPress={() => onPick(index, option.playerId)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={[styles.option, on && styles.optionOn]}
                      testID={`import-option-${option.playerId}`}
                    >
                      <Text style={[styles.optionText, on && styles.optionTextOn]}>
                        {option.firstName} · {option.team} {positionLabel({ position: option.position })}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {match.unmatched.length > 0 ? (
        <Text style={styles.unmatched}>
          Couldn’t match {match.unmatched.slice(0, 4).join(', ')}{match.unmatched.length > 4 ? ` and ${match.unmatched.length - 4} more` : ''}. Add them with search afterwards.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  card: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  off: { color: colors.muted },
  meta: { fontSize: 13, color: colors.sub },
  onTeam: { fontSize: 12, fontWeight: '700', color: colors.muted },
  question: { marginBottom: 10, gap: 10 },
  questionText: { fontSize: 15, fontWeight: '800', color: colors.text },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.raised },
  optionOn: { backgroundColor: colors.ink },
  optionText: { fontSize: 14, fontWeight: '700', color: colors.text },
  optionTextOn: { color: colors.onInk },
  unmatched: { marginTop: 12, fontSize: 13, lineHeight: 19, color: colors.sub },
});
