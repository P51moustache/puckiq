import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { FantasyPlayer } from '../../types/fantasy';
import { positionLabel } from '../../services/fantasy/positions';
import type { PlayerProfile } from '../../services/nhl/player';
import { USE_NHL_HEADSHOTS } from '../../constants/legal';
import { colors, ErrorBanner, LoadingRows, Pill } from '../coach/ui';

export function PlayerHero({
  profile,
  rosterPlayer,
  onClose,
}: {
  profile: PlayerProfile;
  rosterPlayer: FantasyPlayer | null;
  onClose: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <View style={styles.hero} testID="player-hero">
      <View style={styles.header}>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close"
          testID="player-sheet-close"
          hitSlop={4}
          style={styles.close}
        >
          <Ionicons name="chevron-back" size={23} color={colors.text} />
        </Pressable>
        <Text style={styles.heading}>Player Details</Text>
        <View style={{ width: 44 }} />
      </View>
      <Text style={styles.jersey} accessible={false}>
        {profile.sweaterNumber ?? ''}
      </Text>
      <View style={styles.main}>
        <View style={styles.portrait}>
          {profile.headshot && USE_NHL_HEADSHOTS && !imageFailed ? (
            <Image
              source={{ uri: profile.headshot }}
              style={styles.portraitCrop}
              contentFit="cover"
              contentPosition="top"
              transition={150}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <Ionicons name="person" size={100} color={colors.muted} />
          )}
          <LinearGradient
            colors={['transparent', colors.bg]}
            locations={[0.58, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={styles.identity}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.meta}>
            {positionLabel(rosterPlayer ?? { position: profile.position })} ·{' '}
            {profile.teamName || profile.team}
          </Text>
          <Text style={styles.meta}>
            {rosterPlayer ? 'On your roster' : 'NHL player'}
            {profile.sweaterNumber != null
              ? ` · #${profile.sweaterNumber}`
              : ''}
          </Text>
          {rosterPlayer?.injuredReserve ? (
            <Pill label="ON IR" tone="warn" />
          ) : null}
        </View>
      </View>
    </View>
  );
}
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
    <View style={{ padding: 18 }}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close"
        testID="player-sheet-close"
        style={styles.close}
      >
        <Ionicons name="close" size={24} color={colors.text} />
      </Pressable>
      {loading ? <LoadingRows count={5} /> : null}
      {error ? (
        <ErrorBanner message="Couldn’t load this player." onRetry={onRetry} />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  hero: { overflow: 'hidden', backgroundColor: colors.bg, paddingTop: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  close: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { fontSize: 16, fontWeight: '600', color: colors.text },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 96,
  },
  portrait: {
    width: '35%',
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  // NHL cutouts include transparent space above the head. Trim it in the view.
  portraitCrop: {
    position: 'absolute',
    width: '100%',
    aspectRatio: 1,
    top: -24,
  },
  identity: { flex: 1, paddingLeft: 8, gap: 4, paddingRight: 8 },
  name: { fontSize: 23, lineHeight: 26, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, lineHeight: 16, color: colors.sub },
  jersey: {
    position: 'absolute',
    right: 12,
    top: 42,
    fontSize: 86,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.045)',
  },
});
