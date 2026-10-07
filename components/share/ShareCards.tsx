/**
 * Shareable F1-style cards for league group chats: tonight's lineup and the week ahead.
 * Rendered in a preview sheet, snapshotted to PNG, and handed to the iOS share sheet.
 */

import React, { forwardRef, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { ART } from '../../constants/art';
import { shareViewImage } from '../../services/shareImage';
import { PlayerAvatar, splitName } from '../coach/PlayerAvatar';
import { BrandMark, colors, display, PrimaryButton } from '../coach/ui';
import { track } from '../../services/analytics/track';

export interface ShareCardPlayer {
  playerId: number;
  name: string;
  team: string;
  position: string;
  /** Under the name: "vs COL", "4 GP". */
  detail?: string;
}

export interface ShareCardContent {
  /** Which card, for analytics. */
  kind: 'tonight' | 'week' | 'recap' | 'room';
  kicker: string;
  teamName: string;
  /** The big numeral: a count ("16") or points ("31.5"). */
  count: number | string;
  countSuffix?: string;
  caption: string;
  players: ShareCardPlayer[];
}

const CARD_WIDTH = 340;
const MAX_TILES = 8;

export const ShareCard = forwardRef<View, { content: ShareCardContent }>(function ShareCard({ content }, ref) {
  const tiles = content.players.slice(0, MAX_TILES);
  return (
    <View ref={ref} collapsable={false} style={styles.card} testID="share-card">
      <Image source={ART.rink} style={styles.texture} contentFit="cover" accessible={false} />
      <View style={styles.top}>
        <BrandMark height={15} />
        <Text style={styles.brand}>PUCKIQ</Text>
        <Text style={styles.kicker} numberOfLines={1}>{content.kicker}</Text>
      </View>
      <Text style={styles.teamName} numberOfLines={1}>{content.teamName.toUpperCase()}</Text>
      <View style={styles.countRow}>
        <Text style={styles.count}>{content.count}</Text>
        <View style={styles.countText}>
          {content.countSuffix ? <Text style={styles.countSuffix}>{content.countSuffix}</Text> : null}
          <Text style={styles.caption}>{content.caption}</Text>
        </View>
      </View>
      <View style={styles.grid}>
        {tiles.map((player) => (
          <View key={player.playerId} style={styles.tile}>
            <PlayerAvatar playerId={player.playerId} team={player.team} position={player.position} size={64} />
            <Text style={styles.tileName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {splitName(player.name).last.toUpperCase()}
            </Text>
            {player.detail ? <Text style={styles.tileDetail} numberOfLines={1}>{player.detail}</Text> : null}
          </View>
        ))}
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>SET YOUR LINEUP WITH PUCKIQ</Text>
        <Text style={styles.footerSub}>Fantasy hockey coach · App Store</Text>
      </View>
    </View>
  );
});

export function ShareCardSheet({
  visible,
  content,
  onClose,
}: {
  visible: boolean;
  content: ShareCardContent | null;
  onClose: () => void;
}) {
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const share = async () => {
    setBusy(true);
    setFailed(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const outcome = await shareViewImage(cardRef);
    track('share_card', { kind: content?.kind ?? 'unknown', outcome });
    setBusy(false);
    if (outcome === 'failed') setFailed(true);
    if (outcome === 'shared') onClose();
  };

  return (
    <Modal visible={visible && content !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop} testID="share-sheet">
        <StatusBar style="light" />
        {content ? (
          <View style={styles.previewFrame}>
            <ShareCard ref={cardRef} content={content} />
          </View>
        ) : null}
        <View style={styles.sheetActions}>
          {failed ? <Text style={styles.failed}>Couldn’t create the image. Try again.</Text> : null}
          <PrimaryButton label="Share to your league" icon="share-outline" onPress={share} loading={busy} testID="share-card-send" />
          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" testID="share-card-close">
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Small circular share affordance for the top-right of carbon hero cards. */
export function ShareButton({ onPress, testID }: { onPress: () => void; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Share card"
      testID={testID}
      style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
    >
      <Ionicons name="share-outline" size={16} color={colors.onInk} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** Square so the exported PNG has no transparent corners in chat apps. */
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.ink,
    paddingTop: 22,
  },
  texture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  previewFrame: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 22,
  },
  brand: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.2,
    color: colors.onInk,
  },
  kicker: {
    flex: 1,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: colors.onInkSub,
  },
  teamName: {
    ...display(20),
    color: colors.onInkSub,
    paddingHorizontal: 22,
    marginHorizontal: 0,
    marginTop: 18,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: 22,
  },
  count: {
    ...display(88),
    color: colors.onInk,
    lineHeight: 96,
    letterSpacing: -3,
  },
  countText: {
    flex: 1,
    paddingBottom: 16,
  },
  countSuffix: {
    ...display(22),
    color: colors.onInkSub,
  },
  caption: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.onInk,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 22,
    marginTop: 14,
  },
  tile: {
    width: 64,
    alignItems: 'center',
  },
  tileName: {
    width: 70,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '900',
    color: colors.onInk,
    marginTop: 6,
  },
  tileDetail: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.onInkSub,
    marginTop: 1,
  },
  footer: {
    marginTop: 22,
    paddingHorizontal: 22,
    paddingVertical: 14,
    backgroundColor: colors.accent,
  },
  footerText: {
    ...display(16),
    color: colors.onAccent,
  },
  footerSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFFCC',
    marginTop: 2,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0B10',
    paddingHorizontal: 24,
  },
  sheetActions: {
    alignSelf: 'stretch',
    marginTop: 24,
  },
  failed: {
    color: colors.onInk,
    textAlign: 'center',
    marginBottom: 10,
  },
  close: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  closeText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onInkSub,
  },
  shareButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.inkRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
