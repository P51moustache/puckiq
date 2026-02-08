import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import { getTeamLogoUrl } from '../utils/teamLogo';
import type { Insight } from '../types/insights';

interface StatOfTheNightProps {
  stat: Insight | null;
  onShare: () => void;
  onInfoPress?: (glossaryKey: string) => void;
}

const CATEGORY_META: Record<string, { icon: string; label: string }> = {
  streak:    { icon: 'flame-outline', label: 'STREAK' },
  edge:      { icon: 'bar-chart-outline', label: 'EDGE' },
  h2h:       { icon: 'swap-horizontal-outline', label: 'HEAD TO HEAD' },
  rest:      { icon: 'moon-outline', label: 'REST ADVANTAGE' },
  player:    { icon: 'star-outline', label: 'PLAYER' },
  standings: { icon: 'trending-up-outline', label: 'STANDINGS' },
};

/**
 * Extract a hero number from the stat text.
 * Looks for patterns like "5 points", "4-game", "12 goals", etc.
 * Returns the number string and the remaining context text.
 */
function extractHeroNumber(text: string): { hero: string; context: string } | null {
  // Match "N keyword" patterns: "5 points", "4-game streak", "+3 momentum", "0.93 save"
  const match = text.match(/([+-]?\d+(?:\.\d+)?)[\s-]+(point|goal|assist|game|win|save|shutout|streak|momentum)/i);
  if (match) {
    return { hero: match[1], context: text };
  }
  // Numbers in parentheses: (+5), (-3), (7)
  const parenMatch = text.match(/\(([+-]?\d+(?:\.\d+)?)\)/);
  if (parenMatch) {
    return { hero: parenMatch[1], context: text };
  }
  // Standalone +N values: "+5", "+12"
  const plusMatch = text.match(/\+(\d+)/);
  if (plusMatch) {
    return { hero: '+' + plusMatch[1], context: text };
  }
  // Match standalone large numbers (2+ digits)
  const numMatch = text.match(/\b(\d{2,})\b/);
  if (numMatch) {
    return { hero: numMatch[1], context: text };
  }
  return null;
}

function StatOfTheNightComponent({ stat, onShare, onInfoPress }: StatOfTheNightProps) {
  if (!stat) return null;

  const teamAbbrev = stat.teamAbbrev ?? '';
  const teamColors = getTeamColors(teamAbbrev);
  const accentColor = '#22c55e';
  const extracted = extractHeroNumber(stat.text);
  const categoryMeta = CATEGORY_META[stat.category] ?? { icon: 'flash-outline', label: 'HIGHLIGHT' };

  // Spring pop animation for hero number
  const heroScale = useSharedValue(0.85);
  React.useEffect(() => {
    heroScale.value = withSpring(1, { damping: 12, stiffness: 120 });
  }, []);
  const heroAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heroScale.value }],
  }));

  return (
    <Animated.View
      testID="stat-of-the-night"
      entering={FadeInUp.duration(400).delay(200)}
      style={styles.container}
    >
      <LinearGradient
        colors={[accentColor + '30', accentColor + '08', theme.card]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, {
          borderColor: accentColor + '40',
          shadowColor: accentColor,
        }]}
      >
        {/* Team logo in circle backdrop */}
        {teamAbbrev ? (
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: getTeamLogoUrl(teamAbbrev) }}
              style={styles.teamLogo}
              contentFit="contain"
            />
          </View>
        ) : null}

        {/* Label with icon prefix */}
        <View style={styles.labelRow}>
          <Ionicons name={categoryMeta.icon as any} size={13} color={theme.accent} />
          <Text style={styles.label}>STAT OF THE NIGHT</Text>
        </View>

        {/* Hero number with glow + spring animation */}
        {extracted ? (
          <Animated.Text
            style={[
              styles.heroNumber,
              heroAnimatedStyle,
              {
                textShadowColor: accentColor,
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 12,
              },
            ]}
          >
            {extracted.hero}
          </Animated.Text>
        ) : null}

        {/* Context / stat text */}
        <Text style={styles.statText}>{stat.text}</Text>

        {/* Category chip */}
        <Pressable
          onLongPress={() => onInfoPress?.(stat.category)}
          delayLongPress={300}
          style={[styles.categoryChip, { backgroundColor: accentColor + '25' }]}
        >
          <Text style={[styles.categoryChipText, { color: accentColor }]}>
            {categoryMeta.label}
          </Text>
        </Pressable>

        {/* Share button with circle background */}
        <Pressable
          testID="stat-of-night-share"
          onPress={onShare}
          hitSlop={8}
          style={({ pressed }) => [
            styles.shareButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <View style={styles.shareCircle}>
            <Ionicons name="share-outline" size={18} color={theme.accent} />
          </View>
        </Pressable>
      </LinearGradient>
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
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 160,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
    overflow: 'hidden',
  },
  logoContainer: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamLogo: {
    width: 36,
    height: 36,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  heroNumber: {
    fontSize: 56,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: theme.fonts.mono,
    fontVariant: ['tabular-nums'],
    lineHeight: 64,
    marginBottom: 6,
  },
  statText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    lineHeight: 20,
    marginBottom: 10,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  shareButton: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    padding: 0,
  },
  shareCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
