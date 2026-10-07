/**
 * "Before lock": the coach's moves for tonight or tomorrow. Grouped sits show the faces of
 * everyone who has no slot; free users see the first move and a Pro lock for the rest.
 */

import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { FantasyPlayer, SlotKey } from '../../types/fantasy';
import type { CoachMove } from '../../services/fantasy/coach';
import { STARTING_GOALIES_URL } from '../../constants/legal';
import { ART, ART_ASPECT } from '../../constants/art';
import { PlayerAvatar } from '../coach/PlayerAvatar';
import { Card, colors, ProLockCard, SectionLabel } from '../coach/ui';
import { HowItWorksButton } from '../sheets/HowItWorksSheet';

const MOVE_ICON: Record<CoachMove['kind'], keyof typeof Ionicons.glyphMap> = {
  scratch: 'close',
  injury: 'medkit',
  overflow: 'swap-vertical',
  empty: 'add',
  goalie: 'help',
  off: 'moon',
  clean: 'checkmark',
};

/** Faces on a grouped sit card: enough to recognise, never a second row. */
const MAX_FACES = 5;

function moveColor(move: CoachMove): string {
  if (move.kind === 'clean') return colors.good;
  if (move.severity <= 1) return colors.accent;
  if (move.severity === 2) return colors.warn;
  return colors.muted;
}

export function CoachMovesSection({
  title,
  moves,
  hiddenCount,
  when,
  byId,
  onFindPickup,
  onUnlock,
}: {
  title: string;
  moves: CoachMove[];
  hiddenCount: number;
  when: 'tonight' | 'tomorrow';
  byId: Map<number, FantasyPlayer>;
  onFindPickup: (move: CoachMove, slot?: SlotKey) => void;
  onUnlock: () => void;
}) {
  return (
    <>
      <SectionLabel title={title} right={<HowItWorksButton topic="tonight" />} />
      <View style={styles.stack}>
        {moves.map((move) => (
          <Card key={move.id} style={styles.move} testID={`move-${move.kind}`}>
            {move.kind === 'clean' ? (
              <Image source={ART.goalLampBadge} style={styles.cleanArt} contentFit="contain" accessible={false} testID="move-clean-art" />
            ) : (
              <View style={[styles.icon, { backgroundColor: moveColor(move) }]}>
                <Ionicons name={MOVE_ICON[move.kind]} size={16} color="#FFFFFF" />
              </View>
            )}
            <View style={styles.text}>
              <Text style={styles.title}>{move.title}</Text>
              <Text style={styles.detail}>{move.detail}</Text>
              {move.kind === 'overflow' && move.playerIds.length > 1 ? (
                <View style={styles.faces} testID="move-overflow-faces">
                  {move.playerIds.slice(0, MAX_FACES).map((id) => {
                    const player = byId.get(id);
                    return (
                      <PlayerAvatar key={id} playerId={id} team={player?.teamAbbrev ?? ''} position={player?.position ?? ''} size={34} />
                    );
                  })}
                </View>
              ) : null}
              {move.kind === 'goalie' ? (
                <Pressable onPress={() => Linking.openURL(STARTING_GOALIES_URL)} hitSlop={6} accessibilityRole="link">
                  <Text style={styles.link}>Projected starters · Daily Faceoff ↗</Text>
                </Pressable>
              ) : null}
              {move.kind === 'empty' && move.slots && move.slots.length > 1 ? (
                <View style={styles.slotLinks}>
                  {move.slots.map((slot) => (
                    <Pressable key={slot} onPress={() => onFindPickup(move, slot)} hitSlop={6} style={styles.slotLink} testID={`move-empty-find-${slot}`}>
                      <Text style={styles.slotLinkText}>Find {slot === 'UTIL' ? 'a skater' : slot} →</Text>
                    </Pressable>
                  ))}
                </View>
              ) : move.kind === 'empty' ? (
                <Pressable onPress={() => onFindPickup(move)} hitSlop={6}>
                  <Text style={styles.link}>Find a {move.slot === 'UTIL' ? 'skater' : move.slot} who plays {when} →</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>
        ))}
        {hiddenCount > 0 ? (
          <ProLockCard
            title={`${hiddenCount} more ${hiddenCount === 1 ? 'move' : 'moves'} ${when}`}
            detail="Overflow sits, empty slots, goalie start rates, and every injury check — the full list before lock."
            onPress={onUnlock}
            testID="tonight-more-moves"
          />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  move: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cleanArt: { width: 34, height: 34 / ART_ASPECT.goalLampBadge },
  text: { flex: 1, gap: 3 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  detail: { fontSize: 14, lineHeight: 19, color: colors.sub },
  faces: { flexDirection: 'row', gap: 6, marginTop: 8 },
  link: { fontSize: 14, fontWeight: '800', color: colors.accent, marginTop: 4 },
  slotLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  slotLink: { borderRadius: 999, borderWidth: 1.5, borderColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6 },
  slotLinkText: { fontSize: 13, fontWeight: '900', color: colors.accent },
});
