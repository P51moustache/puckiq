import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import { getTeamLogoUrl } from '../utils/teamLogo';
import type { Insight } from '../types/insights';

interface StatOfTheNightProps {
  stat: Insight | null;
  onShare: () => void;
}

/**
 * Extract a hero number from the stat text.
 * Looks for patterns like "5 points", "4-game", "12 goals", etc.
 * Returns the number string and the remaining context text.
 */
function extractHeroNumber(text: string): { hero: string; context: string } | null {
  // Match patterns like "5 points", "4-game streak", "12 goals", etc.
  const match = text.match(/(\d+)[\s-]+(point|goal|assist|game|win|save|shutout|streak)/i);
  if (match) {
    return { hero: match[1], context: text };
  }
  // Match standalone large numbers
  const numMatch = text.match(/\b(\d{2,})\b/);
  if (numMatch) {
    return { hero: numMatch[1], context: text };
  }
  return null;
}

function StatOfTheNightComponent({ stat, onShare }: StatOfTheNightProps) {
  if (!stat) return null;

  const teamAbbrev = stat.teamAbbrev ?? '';
  const teamColors = getTeamColors(teamAbbrev);
  const accentColor = teamColors.primary;
  const extracted = extractHeroNumber(stat.text);

  return (
    <Animated.View
      testID="stat-of-the-night"
      entering={FadeInUp.duration(400).delay(200)}
      style={styles.container}
    >
      <View style={[styles.card, { borderLeftColor: accentColor }]}>
        {/* Accent stripe is handled by borderLeftWidth/Color */}

        {/* Team logo in top-right */}
        {teamAbbrev ? (
          <Image
            source={{ uri: getTeamLogoUrl(teamAbbrev) }}
            style={styles.teamLogo}
            contentFit="contain"
          />
        ) : null}

        {/* Label chip */}
        <Text style={styles.label}>STAT OF THE NIGHT</Text>

        {/* Hero number */}
        {extracted ? (
          <Text style={styles.heroNumber}>{extracted.hero}</Text>
        ) : null}

        {/* Context / stat text */}
        <Text style={styles.statText}>{stat.text}</Text>

        {/* Share button */}
        <Pressable
          testID="stat-of-night-share"
          onPress={onShare}
          hitSlop={8}
          style={({ pressed }) => [
            styles.shareButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="share-outline" size={16} color={theme.accent} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default React.memo(StatOfTheNightComponent);

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingLeft: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 4,
    borderLeftColor: theme.accent,
    minHeight: 120,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  teamLogo: {
    width: 20,
    height: 20,
    position: 'absolute',
    top: 12,
    right: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroNumber: {
    fontSize: 42,
    fontWeight: '800',
    color: theme.text,
    fontFamily: theme.fonts.mono,
    fontVariant: ['tabular-nums'],
    lineHeight: 48,
    marginBottom: 4,
  },
  statText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.subtext,
    lineHeight: 18,
  },
  shareButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    padding: 6,
  },
});
