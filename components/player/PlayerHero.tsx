/**
 * The top of the player card: his cutout on his team's jersey color with "Connor MCDAVID"
 * naming (the F1 driver treatment), plus the bare close header shown while he loads.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { FantasyPlayer } from '../../types/fantasy';
import { positionLabel } from '../../services/fantasy/positions';
import type { PlayerProfile } from '../../services/nhl/player';
import { USE_NHL_HEADSHOTS } from '../../constants/legal';
import { teamTile } from '../../constants/teamTiles';
import { splitName } from '../coach/PlayerAvatar';
import { colors, display, ErrorBanner, LoadingRows, Pill, useWide } from '../coach/ui';

export function PlayerHero({
  profile,
  rosterPlayer,
  onClose,
}: {
  profile: PlayerProfile;
  rosterPlayer: FantasyPlayer | null;
  onClose: () => void;
}) {
  const wide = useWide();
  const tile = teamTile(profile.team);
  const names = splitName(profile.name);
  const meta = [
    profile.sweaterNumber != null ? `#${profile.sweaterNumber}` : null,
    rosterPlayer ? positionLabel(rosterPlayer) : positionLabel({ position: profile.position }),
    profile.age != null ? `${profile.age} yrs` : null,
  ].filter(Boolean).join('  ·  ');
  return (
    <View style={[styles.heroPanel, { backgroundColor: tile.tile }]}>
      <View style={styles.heroTop}>
        <Text style={[styles.heroTeam, { color: tile.on }]} numberOfLines={1}>{(profile.teamName || profile.team).toUpperCase()}</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" testID="player-sheet-close" style={styles.closeButton}>
          <Ionicons name="close" size={20} color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.heroMain}>
        <View style={styles.heroNames}>
          {names.first ? <Text style={[styles.heroFirst, { color: tile.on }]}>{names.first}</Text> : null}
          <Text style={[styles.heroLast, { color: tile.on }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {names.last.toUpperCase()}
          </Text>
          <Text style={[styles.heroMeta, { color: tile.on }]}>{meta}</Text>
          {rosterPlayer?.injuredReserve ? <Pill label="ON IR" tone="warn" solid /> : null}
        </View>
        {profile.headshot && USE_NHL_HEADSHOTS ? (
          <Image
            source={{ uri: profile.headshot }}
            style={[styles.heroImage, wide && styles.heroImageWide]}
            contentFit="contain"
            contentPosition="bottom"
            transition={150}
          />
        ) : null}
      </View>
    </View>
  );
}

/** Before his profile arrives: a close button, skeleton rows, or the load error with Retry. */
export function PlayerLoading({
  loading,
  error,
  onRetry,
  onClose,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.loadingWrap}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" testID="player-sheet-close">
          <Ionicons name="close" size={24} color={colors.sub} />
        </Pressable>
      </View>
      {loading ? <LoadingRows count={5} /> : null}
      {error ? <ErrorBanner message="Couldn’t load this player." onRetry={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    paddingHorizontal: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  heroPanel: {
    paddingTop: 18,
    paddingHorizontal: 18,
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTeam: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    opacity: 0.85,
    flex: 1,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMain: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 190,
  },
  heroNames: {
    flex: 1,
    paddingBottom: 22,
    gap: 2,
  },
  heroFirst: {
    fontSize: 22,
    fontWeight: '400',
  },
  heroLast: {
    ...display(40),
    letterSpacing: -1,
  },
  heroMeta: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 6,
  },
  heroImage: {
    width: 180,
    height: 190,
    marginRight: -18,
  },
  heroImageWide: {
    width: 260,
    height: 250,
    marginRight: 24,
  },
});
