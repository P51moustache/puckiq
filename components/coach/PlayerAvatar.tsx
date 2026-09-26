/**
 * F1-style player identity: the NHL cutout headshot on his team's jersey color,
 * and "Connor MCDAVID" naming. Falls back to a position monogram on the tile.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { Image } from 'expo-image';
import { USE_NHL_HEADSHOTS } from '../../constants/legal';
import { teamTile } from '../../constants/teamTiles';
import { headshotUrl } from '../../services/nhl/player';
import { seasonIdFor, todayNhl } from '../../services/nhl/dates';
import { colors } from './ui';

interface PlayerAvatarProps {
  playerId: number;
  team: string;
  position: string;
  size?: number;
  uri?: string | null;
  /** Rounded-square tile (default) or circle. */
  shape?: 'tile' | 'circle';
}

export function PlayerAvatar({ playerId, team, position, size = 48, uri, shape = 'tile' }: PlayerAvatarProps) {
  const [failed, setFailed] = useState(false);
  const source = USE_NHL_HEADSHOTS ? uri ?? headshotUrl(playerId, team, seasonIdFor(todayNhl())) : null;
  const { tile, on } = teamTile(team);
  const radius = shape === 'circle' ? size / 2 : Math.round(size * 0.24);

  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: radius, backgroundColor: tile }]}>
      {source && !failed ? (
        <Image
          source={{ uri: source }}
          style={{ width: size * 1.08, height: size * 1.08, marginTop: size * 0.1 }}
          contentFit="cover"
          contentPosition="top"
          transition={120}
          cachePolicy="disk"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={[styles.monogram, { fontSize: size * 0.32, color: on }]}>{(position || '—').slice(0, 2).toUpperCase()}</Text>
      )}
    </View>
  );
}

export function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return { first: '', last: name.trim() };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

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
    <Text style={[{ fontSize: size, color }, style]} numberOfLines={numberOfLines}>
      <Text style={styles.first}>{lead}</Text>
      <Text style={styles.last}>{last.toUpperCase()}</Text>
    </Text>
  );
}

/** Small team badge: jersey color chip with the abbreviation (no NHL marks). */
export function TeamChip({ team, prefix }: { team: string; prefix?: string }) {
  const { tile, on } = teamTile(team);
  return (
    <View style={[styles.chip, { backgroundColor: tile }]}>
      <Text style={[styles.chipText, { color: on }]}>{prefix ? `${prefix} ` : ''}{team || '—'}</Text>
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
