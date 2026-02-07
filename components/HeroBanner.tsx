import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import { getTeamLogoUrl } from '../utils/teamLogo';
import { getHeroPhoto } from '../utils/heroPhoto';
import { ConfidenceBadge } from './ConfidenceBadge';
import { SettingsButton } from './SettingsButton';
import { useHaptics } from '../hooks/useHaptics';
import type { H2HRecord } from '../types/gameResults';
import type { NHLGameSummary, SituationalFactors } from '../types/predictions';
import type { TeamFormData } from '../types/teamForm';

interface HeroBannerProps {
  game: NHLGameSummary;
  prediction: { homeWinProb: number; awayWinProb: number };
  confidenceScore: number;
  h2hRecord: H2HRecord | null;
  situationalFactors: SituationalFactors | null;
  headline: string;
  onPress: () => void;
  onShare: () => void;
  awayForm?: TeamFormData | null;
  homeForm?: TeamFormData | null;
  isYourTeam?: boolean;
}

// ─── Helpers (reused from HeroMatchup.tsx patterns) ───

function formatGameTime(game: NHLGameSummary): { text: string; isLive: boolean } {
  const state = game.gameState;
  if (state === 'LIVE' || state === 'CRIT') {
    const period = game.period ?? 0;
    const clock = game.clock?.timeRemaining ?? '';
    const periodLabel = period <= 3 ? `P${period}` : 'OT';
    const scoreText = `${game.awayTeam?.score ?? 0}-${game.homeTeam?.score ?? 0}`;
    return { text: `${scoreText}  ${periodLabel} ${clock}`.trim(), isLive: true };
  }
  if (state === 'FINAL' || state === 'OFF') {
    const scoreText = `${game.awayTeam?.score ?? 0}-${game.homeTeam?.score ?? 0}`;
    return { text: `FINAL ${scoreText}`, isLive: false };
  }
  if (game.startTimeUTC) {
    const time = new Date(game.startTimeUTC).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return { text: time, isLive: false };
  }
  return { text: 'TBD', isLive: false };
}

function buildInsightChips(
  game: NHLGameSummary,
  h2hRecord: H2HRecord | null,
  situationalFactors: SituationalFactors | null,
) {
  const chips: { label: string; bg: string; color: string }[] = [];

  if (h2hRecord && h2hRecord.games.length > 0) {
    chips.push({
      label: `H2H ${h2hRecord.teamAWins}-${h2hRecord.teamBWins}`,
      bg: 'rgba(96, 165, 250, 0.2)',
      color: '#60a5fa',
    });
  }

  if (situationalFactors) {
    if (situationalFactors.homeBackToBack || situationalFactors.awayBackToBack) {
      const isHomeB2B = situationalFactors.homeBackToBack;
      chips.push({
        label: isHomeB2B ? 'B2B' : 'REST \u2713',
        bg: isHomeB2B ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
        color: isHomeB2B ? '#ef4444' : '#22c55e',
      });
    }
  }

  const homeStreak = game.homeTeam?.streakCode;
  const awayStreak = game.awayTeam?.streakCode;
  const streakEntry = [homeStreak, awayStreak].find((s) => {
    if (!s) return false;
    const match = s.match(/^W(\d+)$/);
    return match && parseInt(match[1], 10) >= 3;
  });
  if (streakEntry) {
    chips.push({
      label: streakEntry,
      bg: 'rgba(34, 197, 94, 0.2)',
      color: '#22c55e',
    });
  }

  return chips.slice(0, 3);
}

// ─── Component ───

export default function HeroBanner({
  game,
  prediction,
  confidenceScore,
  h2hRecord,
  situationalFactors,
  headline,
  onPress,
  onShare,
  isYourTeam,
}: HeroBannerProps) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const { press } = useHaptics();

  // Daily-rotating hero photo from shared utility
  const heroImage = useMemo(() => getHeroPhoto(), []);

  const awayAbbrev = game.awayTeam?.abbrev ?? '???';
  const homeAbbrev = game.homeTeam?.abbrev ?? '???';
  const awayColors = getTeamColors(awayAbbrev);
  const homeColors = getTeamColors(homeAbbrev);
  const gameTime = formatGameTime(game);
  const chips = buildInsightChips(game, h2hRecord, situationalFactors);
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Pressable
      testID="hero-banner"
      onPress={onPress}
      onPressIn={() => {
        press();
        scale.value = withSpring(0.98, { damping: 15, stiffness: 150 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 150 });
      }}
    >
      <Animated.View style={[styles.container, pressStyle]}>
        {/* LAYER 1 — Background photo + gradient overlay */}
        <Animated.View entering={FadeIn.duration(800)} style={StyleSheet.absoluteFill}>
          <Image
            source={heroImage}
            style={styles.bgImage}
            contentFit="cover"
          />
        </Animated.View>

        {/* Gradient overlay for text readability */}
        <LinearGradient
          colors={[
            'rgba(7, 16, 35, 0.25)',
            'rgba(7, 16, 35, 0.6)',
            '#071023',
          ]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Team color tint — subtle diagonal gradient */}
        <LinearGradient
          colors={[
            `${awayColors.primary}18`,
            'transparent',
            `${homeColors.primary}18`,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* LAYER 2 — Branding bar (top) */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          style={styles.brandingBar}
        >
          <View>
            <Text style={styles.wordmark}>PuckIQ</Text>
            <Text style={styles.tagline}>YOUR EDGE BEFORE EVERY PICK</Text>
            <Text style={styles.dateText}>{dateStr}</Text>
          </View>
          <SettingsButton />
        </Animated.View>

        {/* LAYER 3 — Matchup overlay (center) */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(300)}
          style={styles.matchupZone}
        >
          {/* YOUR TEAM badge */}
          {isYourTeam && (
            <View style={styles.yourTeamBadge}>
              <Ionicons name="star" size={10} color={theme.accent} />
              <Text style={styles.yourTeamText}>YOUR TEAM</Text>
            </View>
          )}

          {/* Headline */}
          <Text style={styles.headline} numberOfLines={1}>
            {headline}
          </Text>

          {/* Matchup row: Logo — Prob — VS — Prob — Logo */}
          <View style={styles.matchupRow}>
            {/* Away side */}
            <View style={styles.teamSide}>
              <Image
                source={{ uri: getTeamLogoUrl(awayAbbrev) }}
                style={styles.teamLogo}
                contentFit="contain"
              />
              <Text style={styles.teamAbbrev}>{awayAbbrev}</Text>
              <Text style={styles.probNumber}>
                {Math.round(prediction.awayWinProb)}%
              </Text>
            </View>

            {/* Center — VS + Confidence */}
            <View style={styles.centerDivider}>
              <Text style={styles.vsText}>VS</Text>
              <ConfidenceBadge confidence={confidenceScore} size="lg" />
            </View>

            {/* Home side */}
            <View style={styles.teamSide}>
              <Image
                source={{ uri: getTeamLogoUrl(homeAbbrev) }}
                style={styles.teamLogo}
                contentFit="contain"
              />
              <Text style={styles.teamAbbrev}>{homeAbbrev}</Text>
              <Text style={styles.probNumber}>
                {Math.round(prediction.homeWinProb)}%
              </Text>
            </View>
          </View>

          {/* Game time */}
          <Text
            style={[
              styles.gameTime,
              gameTime.isLive && styles.gameTimeLive,
            ]}
          >
            {gameTime.isLive ? 'LIVE  ' : ''}{gameTime.text}
          </Text>
        </Animated.View>

        {/* LAYER 4 — Insight chips (bottom) */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(400)}
          style={styles.chipBarWrapper}
        >
          <BlurView intensity={60} tint="dark" style={styles.chipBar}>
            <View style={styles.chipsRow}>
              {chips.map((chip, i) => (
                <View
                  key={i}
                  style={[styles.chip, { backgroundColor: chip.bg }]}
                >
                  <Text style={[styles.chipText, { color: chip.color }]}>
                    {chip.label}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.chipBarRight}>
              <Text style={styles.topEdgeLabel}>TOP EDGE</Text>
              <Pressable onPress={onShare} hitSlop={8}>
                <Ionicons name="share-outline" size={18} color="#fff" />
              </Pressable>
            </View>
          </BlurView>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

// ─── Styles ───

const styles = StyleSheet.create({
  container: {
    height: 300,
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },

  // Layer 2 — Branding
  brandingBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.subtext,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },

  // Layer 3 — Matchup
  matchupZone: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  yourTeamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  yourTeamText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 1,
  },
  headline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    opacity: 0.85,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  teamSide: {
    alignItems: 'center',
    gap: 4,
  },
  teamLogo: {
    width: 48,
    height: 48,
  },
  teamAbbrev: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  probNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    fontFamily: theme.fonts.mono,
    fontVariant: ['tabular-nums'],
  },
  centerDivider: {
    alignItems: 'center',
    gap: 8,
  },
  vsText: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 2,
  },
  gameTime: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 8,
  },
  gameTimeLive: {
    color: '#22c55e',
    fontWeight: '700',
  },

  // Layer 4 — Chips
  chipBarWrapper: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  chipBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chipBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topEdgeLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 1.5,
  },
});
