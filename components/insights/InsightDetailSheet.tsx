import React, { useRef } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, PrimaryButton } from '../coach/ui';
import { PlayerAvatar } from '../coach/PlayerAvatar';
import type { InsightDetail, InsightPlayer } from './insightDetails';

/** Dismiss before navigating or presenting a player, so native modals never overlap. */
export function InsightDetailSheet({
  detail,
  onClose,
  onOpenPlayer,
  onAction,
}: {
  detail: InsightDetail | null;
  onClose: () => void;
  onOpenPlayer: (player: InsightPlayer) => void;
  onAction: (action: InsightDetail['action']) => void;
}) {
  const insets = useSafeAreaInsets();
  const pending = useRef<(() => void) | null>(null);
  const finishDismiss = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };
  const closeThen = (action: () => void) => {
    pending.current = action;
    onClose();
    if (Platform.OS !== 'ios') finishDismiss();
  };
  return (
    <Modal
      visible={!!detail}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={finishDismiss}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close insight details"
          accessibilityRole="button"
        />
        <View
          style={[styles.panel, { paddingBottom: Math.max(12, insets.bottom) }]}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          <View style={styles.heading}>
            <Text style={styles.kicker}>PUCKIQ INSIGHT</Text>
            <Pressable
              style={styles.close}
              onPress={onClose}
              testID="insight-close"
              accessibilityRole="button"
              accessibilityLabel="Close insight"
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          {detail ? (
            <>
              <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>{detail.title}</Text>
                <Text style={styles.detail}>{detail.detail}</Text>
                {detail.players.length ? (
                  <Text style={styles.label}>Players to review</Text>
                ) : null}
                {detail.players.map((player) => (
                  <Pressable
                    key={player.id}
                    testID={`insight-player-${player.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${player.name}`}
                    style={({ pressed }) => [
                      styles.player,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => closeThen(() => onOpenPlayer(player))}
                  >
                    <PlayerAvatar
                      playerId={player.id}
                      team={player.team}
                      position={player.position}
                      size={32}
                    />
                    <View style={styles.identity}>
                      <Text style={styles.name}>{player.name}</Text>
                      <Text style={styles.meta}>
                        {player.team} · {player.position}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={colors.sub}
                    />
                  </Pressable>
                ))}
              </ScrollView>
              <PrimaryButton
                testID="insight-action"
                label={
                  detail.action === 'pickups'
                    ? 'Find pickups for my lineup'
                    : 'Review my lineup'
                }
                onPress={() => closeThen(() => onAction(detail.action))}
              />
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  panel: {
    maxHeight: '80%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: { fontSize: 12, fontWeight: '600', color: colors.accent },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingBottom: 14, gap: 8 },
  title: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 23,
    color: colors.text,
  },
  detail: { fontSize: 14, lineHeight: 21, color: colors.sub },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 8 },
  player: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    borderRadius: 6,
  },
  identity: { flex: 1, gap: 2 },
  name: { fontSize: 14, color: colors.text, fontWeight: '500' },
  meta: { fontSize: 12, color: colors.sub },
  pressed: { backgroundColor: colors.raised },
});
