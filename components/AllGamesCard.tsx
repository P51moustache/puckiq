import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import { getTeamLogoUrl } from '../utils/teamLogo';
import { ConfidenceBadge } from './ConfidenceBadge';
import type { H2HRecord } from '../types/gameResults';
import type { NHLGameSummary } from '../types/predictions';
import type { TeamFormData } from '../types/teamForm';

import type { MomentumData } from '../types/edgeStats';
import FormSparkline from './FormSparkline';

interface AllGamesCardProps {
  game: NHLGameSummary;
  prediction: { homeWinProb: number; awayWinProb: number };
  h2hRecord: H2HRecord | null;
  insight: string | null;
  index: number;
  onPress: () => void;
  onShare?: () => void;
  awayMomentum?: MomentumData | null;
  homeMomentum?: MomentumData | null;
  restAdvantage?: { home: number; away: number } | null;
  awayForm?: TeamFormData | null;
  homeForm?: TeamFormData | null;
}

function formatGameTime(game: NHLGameSummary): { text: string; isLive: boolean; isFinal: boolean } {
  const state = game.gameState;
  if (state === 'LIVE' || state === 'CRIT') {
    const period = game.period ?? 0;
    const clock = game.clock?.timeRemaining ?? '';
    const periodLabel = period <= 3 ? `P${period}` : 'OT';
    const scoreText = `${game.awayTeam?.score ?? 0}-${game.homeTeam?.score ?? 0}`;
    return { text: `${scoreText}  ${periodLabel} ${clock}`.trim(), isLive: true, isFinal: false };
  }
  if (state === 'FINAL' || state === 'OFF') {
    const scoreText = `${game.awayTeam?.score ?? 0}-${game.homeTeam?.score ?? 0}`;
    return { text: `FINAL ${scoreText}`, isLive: false, isFinal: true };
  }
  if (game.startTimeUTC) {
    const time = new Date(game.startTimeUTC).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return { text: time, isLive: false, isFinal: false };
  }
  return { text: 'TBD', isLive: false, isFinal: false };
}

function formatH2H(h2h: H2HRecord): string {
  const total = h2h.teamAWins + h2h.teamBWins;
  if (total === 0) return 'First meeting';
  if (h2h.teamAWins === h2h.teamBWins) return `Series tied ${h2h.teamAWins}-${h2h.teamBWins}`;
  if (h2h.teamAWins > h2h.teamBWins) return `${h2h.teamA} leads ${h2h.teamAWins}-${h2h.teamBWins}`;
  return `${h2h.teamB} leads ${h2h.teamBWins}-${h2h.teamAWins}`;
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


type FactorSide = 'home' | 'away' | 'even';

function computeFactorSplits(
  awayMomentum: MomentumData | null | undefined,
  homeMomentum: MomentumData | null | undefined,
  restAdvantage: { home: number; away: number } | null | undefined,
  h2hRecord: H2HRecord | null,
): { mtm: FactorSide | null; rest: FactorSide | null; h2h: FactorSide | null } {
  let mtm: FactorSide | null = null;
  if (awayMomentum && homeMomentum) {
    const diff = homeMomentum.score - awayMomentum.score;
    mtm = diff > 1 ? 'home' : diff < -1 ? 'away' : 'even';
  }

  let rest: FactorSide | null = null;
  if (restAdvantage) {
    const diff = restAdvantage.home - restAdvantage.away;
    rest = diff > 10 ? 'home' : diff < -10 ? 'away' : 'even';
  }

  let h2h: FactorSide | null = null;
  if (h2hRecord && (h2hRecord.teamAWins + h2hRecord.teamBWins) > 0) {
    // teamA = away, teamB = home in the h2h convention
    if (h2hRecord.teamAWins > h2hRecord.teamBWins) h2h = 'away';
    else if (h2hRecord.teamBWins > h2hRecord.teamAWins) h2h = 'home';
    else h2h = 'even';
  }

  return { mtm, rest, h2h };
}

function AllGamesCardComponent({ game, prediction, h2hRecord, insight, index, onPress, onShare, awayMomentum, homeMomentum, restAdvantage, awayForm, homeForm }: AllGamesCardProps) {
  const awayAbbrev = game.awayTeam?.abbrev ?? '???';
  const homeAbbrev = game.homeTeam?.abbrev ?? '???';
  const favoredIsHome = prediction.homeWinProb >= prediction.awayWinProb;
  const favoredAbbrev = favoredIsHome ? homeAbbrev : awayAbbrev;
  const favoredTeam = getTeamColors(favoredAbbrev);
  const favoredColor = pickVisibleColor(favoredTeam.primary, favoredTeam.secondary);
  const barColors = getBarColors(awayAbbrev, homeAbbrev);
  const confidenceScore = Math.round(Math.abs(prediction.homeWinProb - 50) * 2);
  const gameTime = formatGameTime(game);

  const splits = computeFactorSplits(awayMomentum, homeMomentum, restAdvantage, h2hRecord);
  const factorCount = [splits.mtm, splits.rest, splits.h2h].filter(Boolean).length;
  const awayColors = getTeamColors(awayAbbrev);
  const homeColors = getTeamColors(homeAbbrev);

  // Spring press animation
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Pulsing LIVE border
  const livePulse = useSharedValue(0);
  React.useEffect(() => {
    if (gameTime.isLive) {
      livePulse.value = withRepeat(
        withTiming(1, { duration: 1500 }),
        -1,
        true,
      );
    } else {
      livePulse.value = 0;
    }
  }, [gameTime.isLive]);

  const liveStyle = useAnimatedStyle(() => {
    if (!gameTime.isLive) return {};
    const opacity = 0.2 + livePulse.value * 0.3;
    return {
      borderColor: `rgba(34, 197, 94, ${opacity})`,
    };
  });

  return (
    <Animated.View entering={FadeInUp.springify().damping(18).stiffness(120).delay(index * 60)}>
      <Pressable
        testID={`all-games-card-${game.id}`}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 150 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 150 }); }}
      >
        <Animated.View
          style={[
            styles.card,
            { borderLeftColor: favoredColor },
            pressStyle,
            gameTime.isLive && liveStyle,
          ]}
        >
        <LinearGradient
          colors={[
            `${awayColors.primary}22`,
            'transparent',
            `${homeColors.primary}18`,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
        />
        {/* Row 1: Matchup + Time */}
        <View style={styles.row1}>
          <View style={styles.matchupRow}>
            <Image source={{ uri: getTeamLogoUrl(awayAbbrev) }} style={styles.teamLogo} contentFit="contain" />
            {awayForm?.results && awayForm.results.length >= 2 && (
              <FormSparkline results={awayForm.results} width={36} height={14} />
            )}
            <Text style={styles.matchup}>
              {awayAbbrev} @ {homeAbbrev}
            </Text>
            {homeForm?.results && homeForm.results.length >= 2 && (
              <FormSparkline results={homeForm.results} width={36} height={14} />
            )}
            <Image source={{ uri: getTeamLogoUrl(homeAbbrev) }} style={styles.teamLogo} contentFit="contain" />
          </View>
          <Text
            style={[
              styles.time,
              gameTime.isLive && styles.timeLive,
              gameTime.isFinal && styles.timeFinal,
            ]}
          >
            {gameTime.isLive ? 'LIVE' : ''} {gameTime.text}
          </Text>
        </View>

        {/* Row 2: Confidence badge (hero) + Probability bar */}
        <View style={styles.row2}>
          <ConfidenceBadge confidence={confidenceScore} size="md" />
          <View style={styles.barContainer}>
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
            <Text style={styles.probText}>
              {Math.round(Math.max(prediction.homeWinProb, prediction.awayWinProb))}%
            </Text>
          </View>
        </View>

        {/* Row 3: H2H chip */}
        {h2hRecord && (
          <View style={styles.row3}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{formatH2H(h2hRecord)}</Text>
            </View>
          </View>
        )}

        {/* Row 3b: Insight text (own row, full width) */}
        {insight && (
          <Text style={[styles.insightText, { color: favoredColor }]} numberOfLines={2}>
            {insight}
          </Text>
        )}

        {/* Row 4: Factor Split + Share */}
        <View style={styles.factorRow}>
          <View style={styles.factorChips}>
            {factorCount >= 2 && splits.mtm !== null && (
              <View style={styles.factorChip}>
                <View style={[
                  styles.factorDot,
                  { backgroundColor: splits.mtm === 'home'
                    ? pickVisibleColor(homeColors.primary, homeColors.secondary)
                    : splits.mtm === 'away'
                    ? pickVisibleColor(awayColors.primary, awayColors.secondary)
                    : theme.subtext },
                ]} />
                <Text style={styles.factorLabel}>MTM</Text>
              </View>
            )}
            {factorCount >= 2 && splits.rest !== null && (
              <View style={styles.factorChip}>
                <View style={[
                  styles.factorDot,
                  { backgroundColor: splits.rest === 'home'
                    ? pickVisibleColor(homeColors.primary, homeColors.secondary)
                    : splits.rest === 'away'
                    ? pickVisibleColor(awayColors.primary, awayColors.secondary)
                    : theme.subtext },
                ]} />
                <Text style={styles.factorLabel}>REST</Text>
              </View>
            )}
            {factorCount >= 2 && splits.h2h !== null && (
              <View style={styles.factorChip}>
                <View style={[
                  styles.factorDot,
                  { backgroundColor: splits.h2h === 'home'
                    ? pickVisibleColor(homeColors.primary, homeColors.secondary)
                    : splits.h2h === 'away'
                    ? pickVisibleColor(awayColors.primary, awayColors.secondary)
                    : theme.subtext },
                ]} />
                <Text style={styles.factorLabel}>H2H</Text>
              </View>
            )}
          </View>
          {onShare && (
            <Pressable onPress={onShare} hitSlop={8}>
              <Ionicons name="share-outline" size={14} color={theme.subtext} />
            </Pressable>
          )}
        </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default React.memo(AllGamesCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  row1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamLogo: {
    width: 20,
    height: 20,
  },
  matchup: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  time: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.subtext,
  },
  timeLive: {
    color: '#22c55e',
    fontWeight: '700',
  },
  timeFinal: {
    color: theme.subtext,
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  barContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barFill: {
    height: 8,
  },
  probText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.subtext,
    minWidth: 32,
    fontFamily: theme.fonts.mono,
    fontVariant: ['tabular-nums'],
  },
  row3: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#60a5fa',
  },
  insightText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 2,
    paddingBottom: 2,
    lineHeight: 19,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  factorChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  factorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  factorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  factorLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.subtext,
    letterSpacing: 0.5,
  },
});
