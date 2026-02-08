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
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { getTeamColors, getAccessibleTextColor } from '../constants/teamColors';
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
  onPress: () => void;
  onShare: () => void;
  onInfoPress?: (glossaryKey: string) => void;
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
  const chips: { label: string; bg: string; color: string; glossaryKey: string }[] = [];

  if (situationalFactors) {
    const restAdv = situationalFactors.restAdvantage;
    if (situationalFactors.homeBackToBack || situationalFactors.awayBackToBack) {
      const b2bTeam = situationalFactors.homeBackToBack ? 'HOME' : 'AWAY';
      chips.push({
        label: `${b2bTeam} B2B`,
        bg: 'rgba(239, 68, 68, 0.2)',
        color: '#ef4444',
        glossaryKey: 'b2b',
      });
    } else if (restAdv === 'home' || restAdv === 'away') {
      const diff = Math.abs(situationalFactors.homeRestDays - situationalFactors.awayRestDays);
      chips.push({
        label: `+${diff} REST`,
        bg: 'rgba(34, 197, 94, 0.2)',
        color: '#22c55e',
        glossaryKey: 'rest',
      });
    } else {
      chips.push({
        label: 'EVEN REST',
        bg: 'rgba(96, 165, 250, 0.2)',
        color: '#60a5fa',
        glossaryKey: 'rest',
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
      glossaryKey: 'streak',
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
  onPress,
  onShare,
  onInfoPress,
  awayForm,
  homeForm,
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

  // Build mini stats for bottom bar
  const favoredIsHome = prediction.homeWinProb >= prediction.awayWinProb;
  const favoredAbbrev = favoredIsHome ? homeAbbrev : awayAbbrev;
  const favoredForm = favoredIsHome ? homeForm : awayForm;

  const miniStats: { label: string; value: string; teamAbbrev: string }[] = [];
  if (favoredForm) {
    miniStats.push({ label: favoredAbbrev, value: `${favoredForm.wins}-${favoredForm.losses}-${favoredForm.otLosses}`, teamAbbrev: favoredAbbrev });
    if (favoredForm.streak) {
      miniStats.push({ label: 'STREAK', value: favoredForm.streak, teamAbbrev: favoredAbbrev });
    }
  }
  // Today's date for the branding bar
  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  // Game date for display on the card
  const gameDateSource = game.gameDate ?? game.startTimeUTC ?? '';
  const gameDateParsed = gameDateSource.length >= 10
    ? (() => { const [y, m, d] = gameDateSource.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); })()
    : new Date();
  const gameDateStr = gameDateParsed.toLocaleDateString('en-US', {
    weekday: 'short',
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
            <Text style={styles.todayDate}>Today - {todayStr}</Text>
          </View>
          <SettingsButton />
        </Animated.View>

        {/* LAYER 3 — Matchup overlay (center) */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(300)}
          style={styles.matchupZone}
        >
          {/* Badges row */}
          <View style={styles.badgeRow}>
            <View style={styles.topEdgeBadge}>
              <Ionicons name="flash" size={13} color="#fbbf24" />
              <Text style={styles.topEdgeText}>TOP EDGE</Text>
            </View>
            {isYourTeam && (
              <View style={styles.yourTeamBadge}>
                <Ionicons name="star" size={10} color={theme.accent} />
                <Text style={styles.yourTeamText}>YOUR TEAM</Text>
              </View>
            )}
          </View>

          {/* Matchup row: Logo — Prob — VS — Prob — Logo */}
          <View style={styles.matchupRow}>
            {/* Away side */}
            <View style={styles.teamSide}>
              <Image
                source={{ uri: getTeamLogoUrl(awayAbbrev) }}
                style={styles.teamLogo}
                contentFit="contain"
              />
              <Text style={[styles.teamAbbrev, { color: getAccessibleTextColor(awayAbbrev) }]}>{awayAbbrev}</Text>
              <Text style={[styles.probNumber, !favoredIsHome ? styles.probFavored : styles.probUnderdog]}>
                {Math.round(prediction.awayWinProb)}%
              </Text>
            </View>

            {/* Center — VS + Confidence */}
            <View style={styles.centerDivider}>
              <Text style={styles.vsText}>VS</Text>
              <ConfidenceBadge confidence={confidenceScore} size="lg" onInfoPress={onInfoPress} />
            </View>

            {/* Home side */}
            <View style={styles.teamSide}>
              <Image
                source={{ uri: getTeamLogoUrl(homeAbbrev) }}
                style={styles.teamLogo}
                contentFit="contain"
              />
              <Text style={[styles.teamAbbrev, { color: getAccessibleTextColor(homeAbbrev) }]}>{homeAbbrev}</Text>
              <Text style={[styles.probNumber, favoredIsHome ? styles.probFavored : styles.probUnderdog]}>
                {Math.round(prediction.homeWinProb)}%
              </Text>
            </View>
          </View>

          {/* Game time + date */}
          <Text
            style={[
              styles.gameTime,
              gameTime.isLive && styles.gameTimeLive,
            ]}
          >
            {gameTime.isLive ? 'LIVE  ' : ''}{gameTime.text}
          </Text>
          <Text style={styles.gameDate}>{gameDateStr}</Text>
        </Animated.View>

        {/* LAYER 4 — Stat badges + share (bottom) */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(400)}
          style={styles.bottomBar}
        >
          <View style={styles.badgesRow}>
            {chips.map((chip, i) => (
              <Pressable
                key={`chip-${i}`}
                onLongPress={() => onInfoPress?.(chip.glossaryKey)}
                delayLongPress={300}
                style={styles.badge}
              >
                <Text style={styles.badgeText}>
                  {chip.label}
                </Text>
              </Pressable>
            ))}
            {miniStats.map((stat, i) => (
              <View key={`stat-${i}`} style={styles.badge}>
                <Text style={styles.badgeLabel}>{stat.label}</Text>
                <Text style={styles.badgeValue}>{stat.value}</Text>
              </View>
            ))}
          </View>
          <Pressable onPress={onShare} hitSlop={8} style={styles.shareIcon}>
            <Ionicons name="share-outline" size={16} color="rgba(255,255,255,0.45)" />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

// ─── Styles ───

const styles = StyleSheet.create({
  container: {
    height: 340,
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
  todayDate: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 3,
  },

  // Layer 3 — Matchup
  matchupZone: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  topEdgeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  topEdgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fbbf24',
    letterSpacing: 1.5,
  },
  yourTeamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  yourTeamText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 1,
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
    width: 56,
    height: 56,
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
    fontFamily: theme.fonts.mono,
    fontVariant: ['tabular-nums'],
  },
  probFavored: {
    color: '#22c55e',
  },
  probUnderdog: {
    color: 'rgba(255, 255, 255, 0.45)',
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
  gameDate: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 2,
  },

  // Layer 4 — Badges
  bottomBar: {
    alignItems: 'center',
    marginBottom: 14,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22c55e',
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(34, 197, 94, 0.7)',
  },
  badgeValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22c55e',
  },
  shareIcon: {
    position: 'absolute',
    right: 16,
    bottom: 0,
  },
});
