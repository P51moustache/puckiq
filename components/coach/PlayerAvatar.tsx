/**
 * Player identity on a neutral dark tile, with a position fallback when a headshot fails.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { USE_NHL_HEADSHOTS } from '../../constants/legal';
import { headshotUrl } from '../../services/nhl/player';
import { seasonIdFor, todayNhl } from '../../services/nhl/dates';
import { colors } from './ui';
import { splitName } from '../../services/fantasy/names';

interface PlayerAvatarProps {
  playerId: number;
  team: string;
  position: string;
  size?: number;
  uri?: string | null;
  /** Rounded-square tile (default) or circle. */
  shape?: 'tile' | 'circle';
}

export function PlayerAvatar({
  playerId,
  team,
  position,
  size = 48,
  uri,
  shape = 'tile',
}: PlayerAvatarProps) {
  const [failed, setFailed] = useState(false);
  const source = USE_NHL_HEADSHOTS
    ? (uri ?? headshotUrl(playerId, team, seasonIdFor(todayNhl())))
    : null;
  const radius = shape === 'circle' ? size / 2 : Math.round(size * 0.24);

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: colors.raised,
        },
      ]}
    >
      {source && !failed ? (
        <Image
          source={{ uri: source }}
          style={{
            position: 'absolute',
            width: size * 1.35,
            height: size * 1.35,
            top: -size * 0.25,
          }}
          contentFit="cover"
          contentPosition="top"
          transition={120}
          cachePolicy="disk"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text
          style={[
            styles.monogram,
            { fontSize: size * 0.32, color: colors.text },
          ]}
        >
          {(position || '—').slice(0, 2).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

export { splitName };

/** "Connor MCDAVID" — first name light, last name heavy caps (the F1 driver treatment). */
export function PlayerName({
  name,
  size = 16,
  color = colors.text,
  style,
  initial = false,
  numberOfLines = 1,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  /** "C. MCDAVID" for tight spaces. */
  initial?: boolean;
  numberOfLines?: number;
}) {
  const { first, last } = splitName(name);
  const lead = initial && first ? `${first[0]}. ` : first ? `${first} ` : '';
  return (
    <Text
      style={[{ fontSize: size, color }, style]}
      numberOfLines={numberOfLines}
    >
      <Text style={styles.first}>{lead}</Text>
      <Text style={styles.last}>{last}</Text>
    </Text>
  );
}

/** Small team badge: jersey color chip with the abbreviation (no NHL marks). */
export function TeamChip({ team, prefix }: { team: string; prefix?: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: colors.raised }]}>
      <Text style={[styles.chipText, { color: colors.text }]}>
        {prefix ? `${prefix} ` : ''}
        {team || '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  monogram: {
    fontWeight: '900',
    fontStyle: 'italic',
  },
  first: {
    fontWeight: '400',
  },
  last: {
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  chip: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
