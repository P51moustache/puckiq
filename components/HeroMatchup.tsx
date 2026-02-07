import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
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
import { ConfidenceBadge } from './ConfidenceBadge';
import { useHaptics } from '../hooks/useHaptics';
import type { H2HRecord } from '../types/gameResults';
import type { NHLGameSummary, SituationalFactors } from '../types/predictions';
import type { TeamFormData } from '../types/teamForm';
import FormSparkline from './FormSparkline';

interface HeroMatchupProps {
  game: NHLGameSummary;
  prediction: { homeWinProb: number; awayWinProb: number };
  confidenceScore: number;
  h2hRecord: H2HRecord | null;
  situationalFactors: SituationalFactors | null;
  onPress: () => void;
  onShare: () => void;
  awayForm?: TeamFormData | null;
  homeForm?: TeamFormData | null;
  isYourTeam?: boolean;
}

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
      bg: 'rgba(96, 165, 250, 0.15)',
      color: '#60a5fa',
    });
  }

  if (situationalFactors) {
    if (situationalFactors.homeBackToBack || situationalFactors.awayBackToBack) {
      const isHomeB2B = situationalFactors.homeBackToBack;
      chips.push({
        label: isHomeB2B ? 'B2B' : 'REST \u2713',
        bg: isHomeB2B
          ? 'rgba(239, 68, 68, 0.15)'
          : 'rgba(34, 197, 94, 0.15)',
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
      bg: 'rgba(34, 197, 94, 0.15)',
      color: '#22c55e',
    });
  }

  return chips.slice(0, 3);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function colorDistance(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

const MIN_BAR_LUMINANCE = 0.05;
const MIN_COLOR_DIST = 80;

function pickVisibleColor(primary: string, secondary: string): string {
  if (luminance(primary) >= MIN_BAR_LUMINANCE) return primary;
  if (luminance(secondary) >= MIN_BAR_LUMINANCE) return secondary;
  return primary;
}

function getBarColors(awayAbbrev: string, homeAbbrev: string): { away: string; home: string } {
  const awayTeam = getTeamColors(awayAbbrev);
  const homeTeam = getTeamColors(homeAbbrev);

  let home = pickVisibleColor(homeTeam.primary, homeTeam.secondary);
  let away = pickVisibleColor(awayTeam.primary, awayTeam.secondary);

  if (colorDistance(away, home) < MIN_COLOR_DIST) {
    const altAway = awayTeam.secondary;
    if (luminance(altAway) >= MIN_BAR_LUMINANCE && colorDistance(altAway, home) >= MIN_COLOR_DIST) {
      away = altAway;
    } else {
      const altHome = homeTeam.secondary;
      if (luminance(altHome) >= MIN_BAR_LUMINANCE && colorDistance(away, altHome) >= MIN_COLOR_DIST) {
        home = altHome;
      }
    }
  }

  return { away, home };
}

export default function HeroMatchup({
  game,
  prediction,
  confidenceScore,
  h2hRecord,
  situationalFactors,
  onPress,
  onShare,
  awayForm,
  homeForm,
  isYourTeam,
}: HeroMatchupProps) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const { press } = useHaptics();

  const awayAbbrev = game.awayTeam?.abbrev ?? '???';
  const homeAbbrev = game.homeTeam?.abbrev ?? '???';
  const awayColors = getTeamColors(awayAbbrev);
  const homeColors = getTeamColors(homeAbbrev);

  const gameTime = formatGameTime(game);
  const isLive = game.gameState === 'LIVE' || game.gameState === 'CRIT';
  const chips = buildInsightChips(game, h2hRecord, situationalFactors);
  const barColors = getBarColors(awayAbbrev, homeAbbrev);
  const favoredIsHome = prediction.homeWinProb >= prediction.awayWinProb;
  const favoredAbbrev = favoredIsHome ? homeAbbrev : awayAbbrev;
  const favoredTeam = getTeamColors(favoredAbbrev);
  const favoredColor = pickVisibleColor(favoredTeam.primary, favoredTeam.secondary);

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <Pressable
        testID="hero-matchup-card"
        onPress={onPress}
        onPressIn={() => { press(); scale.value = withSpring(0.97, { damping: 15, stiffness: 150 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 150 }); }}
      >
        <Animated.View
          style={[
            styles.card,
            { borderLeftColor: favoredColor },
            isLive && styles.cardLive,
            pressStyle,
          ]}
        >
        <LinearGradient
          colors={[
            `${awayColors.primary}55`,
            `${awayColors.primary}15`,
            `${homeColors.primary}15`,
            `${homeColors.primary}44`,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <BlurView
          intensity={40}
          tint="dark"
          style={StyleSheet.absoluteFill}
          renderToHardwareTextureAndroid={true}
        />

        <View style={styles.content}>
          {/* YOUR TEAM badge */}
          {isYourTeam && (
            <View style={styles.yourTeamBadge} testID="your-team-badge">
              <Ionicons name="star" size={10} color={theme.accent} />
              <Text style={styles.yourTeamText}>YOUR TEAM</Text>
            </View>
          )}

          {/* Row 1: Matchup + Time */}
          <View style={styles.row1}>
            <View style={styles.matchupRow}>
              <Image source={{ uri: getTeamLogoUrl(awayAbbrev) }} style={styles.teamLogo} contentFit="contain" />
              {awayForm?.results && awayForm.results.length >= 2 && (
                <FormSparkline results={awayForm.results} width={56} height={18} />
              )}
              <Text style={styles.matchupText}>
                {awayAbbrev} @ {homeAbbrev}
              </Text>
              {homeForm?.results && homeForm.results.length >= 2 && (
                <FormSparkline results={homeForm.results} width={56} height={18} />
              )}
              <Image source={{ uri: getTeamLogoUrl(homeAbbrev) }} style={styles.teamLogo} contentFit="contain" />
            </View>
            <Text
              style={[
                styles.timeText,
                gameTime.isLive && styles.timeLive,
              ]}
            >
              {gameTime.isLive ? 'LIVE' : ''} {gameTime.text}
            </Text>
          </View>

          {/* Row 2: Confidence badge (hero) + Probability bar */}
          <View style={styles.row2}>
            <ConfidenceBadge confidence={confidenceScore} size="lg" />
            <View style={styles.barContainer}>
              <Text style={styles.probSide}>{Math.round(prediction.awayWinProb)}%</Text>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.round(prediction.awayWinProb)}%`,
                      backgroundColor: barColors.away,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.round(prediction.homeWinProb)}%`,
                      backgroundColor: barColors.home,
                    },
                  ]}
                />
              </View>
              <Text style={styles.probSide}>{Math.round(prediction.homeWinProb)}%</Text>
            </View>
          </View>

          {/* Row 3: Chips + TOP EDGE + Share */}
          <View style={styles.row3}>
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
            <View style={styles.row3Right}>
              <Text style={styles.topEdgeLabel}>TOP EDGE</Text>
              <Pressable onPress={onShare} hitSlop={8}>
                <Ionicons name="share-outline" size={20} color={theme.accent} />
              </Pressable>
            </View>
          </View>
        </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(25, 46, 94, 0.6)',
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.glass.border,
    borderLeftWidth: 4,
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardLive: {
    borderColor: 'rgba(34, 197, 94, 0.4)',
    shadowColor: '#22c55e',
    shadowOpacity: 0.2,
  },
  content: {
    padding: 14,
  },
  row1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamLogo: {
    width: 32,
    height: 32,
  },
  matchupText: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.subtext,
  },
  timeLive: {
    color: '#22c55e',
    fontWeight: '700',
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  barContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barBg: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barFill: {
    height: 12,
  },
  probSide: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.subtext,
    minWidth: 32,
    textAlign: 'center',
    fontFamily: theme.fonts.mono,
    fontVariant: ['tabular-nums'],
  },
  row3: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  row3Right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topEdgeLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 1.5,
  },
  yourTeamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  yourTeamText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 1,
  },
});
