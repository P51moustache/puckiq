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
import { getTeamColors, getAccessibleTextColor } from '../constants/teamColors';
import { getTeamLogoUrl } from '../utils/teamLogo';
import { ConfidenceBadge } from './ConfidenceBadge';
import { getRelativeDateLabel } from '../utils/dateLabel';
import type { H2HRecord } from '../types/gameResults';
import type { NHLGameSummary } from '../types/predictions';
import type { TeamFormData } from '../types/teamForm';

interface AllGamesCardProps {
  game: NHLGameSummary;
  prediction: { homeWinProb: number; awayWinProb: number };
  h2hRecord: H2HRecord | null;
  insight: string | null;
  index: number;
  onPress: () => void;
  onShare?: () => void;
  onInfoPress?: (glossaryKey: string) => void;
  awayForm?: TeamFormData | null;
  homeForm?: TeamFormData | null;
  restAdvantage?: { home: number; away: number } | null;
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

function formatRecord(form: TeamFormData): string {
  return `${form.wins}-${form.losses}-${form.otLosses}`;
}

/** Convert restMap score (0=B2B, 50=1day, 75=2day, 100=3+) to a display chip, or null if even/unremarkable. */
function getRestChip(
  homeRest: number,
  awayRest: number,
): { label: string; color: string; bg: string } | null {
  if (homeRest === 0) return { label: 'HOME B2B', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
  if (awayRest === 0) return { label: 'AWAY B2B', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
  const diff = homeRest - awayRest;
  if (diff >= 25) return { label: 'HOME REST +', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' };
  if (diff <= -25) return { label: 'AWAY REST +', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' };
  return null;
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

function AllGamesCardComponent({ game, prediction, h2hRecord, insight, index, onPress, onShare, onInfoPress, awayForm, homeForm, restAdvantage }: AllGamesCardProps) {
  const awayAbbrev = game.awayTeam?.abbrev ?? '???';
  const homeAbbrev = game.homeTeam?.abbrev ?? '???';
  const favoredIsHome = prediction.homeWinProb >= prediction.awayWinProb;
  const favoredAbbrev = favoredIsHome ? homeAbbrev : awayAbbrev;
  const favoredTeam = getTeamColors(favoredAbbrev);
  const favoredColor = pickVisibleColor(favoredTeam.primary, favoredTeam.secondary);
  const barColors = getBarColors(awayAbbrev, homeAbbrev);
  const confidenceScore = Math.round(Math.abs(prediction.homeWinProb - 50) * 2);
  const awayProb = Math.round(prediction.awayWinProb);
  const homeProb = Math.round(prediction.homeWinProb);
  const gameTime = formatGameTime(game);
  const dateLabel = getRelativeDateLabel(game.gameDate ?? game.startTimeUTC ?? '');
  const awayColors = getTeamColors(awayAbbrev);
  const homeColors = getTeamColors(homeAbbrev);

  const restChip = restAdvantage ? getRestChip(restAdvantage.home, restAdvantage.away) : null;

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

  // Build time + date string
  const timeDisplay = gameTime.isLive
    ? `LIVE  ${gameTime.text}`
    : gameTime.isFinal
    ? gameTime.text
    : dateLabel !== 'Today'
    ? `${dateLabel} · ${gameTime.text}`
    : gameTime.text;

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
            {
              borderLeftColor: favoredColor,
              shadowColor: favoredColor,
            },
            pressStyle,
            gameTime.isLive && liveStyle,
          ]}
        >
        {/* Background: team color gradient */}
        <LinearGradient
          colors={[
            `${awayColors.primary}30`,
            'transparent',
            `${homeColors.primary}20`,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
        />

        {/* Top edge highlight for depth */}
        <View style={styles.topHighlight} />

        {/* Row 1: Teams with logos + records, badge top-right */}
        <View style={styles.row1}>
          <View>
            <View style={styles.matchupRow}>
              {/* Away team block */}
              <View style={styles.teamBlock}>
                <Image source={{ uri: getTeamLogoUrl(awayAbbrev) }} style={styles.teamLogo} contentFit="contain" />
                <View>
                  <Text style={[styles.teamAbbrev, { color: getAccessibleTextColor(awayAbbrev) }]}>{awayAbbrev}</Text>
                  {awayForm && (
                    <Text style={styles.record}>{formatRecord(awayForm)}</Text>
                  )}
                </View>
              </View>

              <Text style={styles.atSymbol}>@</Text>

              {/* Home team block */}
              <View style={styles.teamBlock}>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.teamAbbrev, { color: getAccessibleTextColor(homeAbbrev) }]}>{homeAbbrev}</Text>
                  {homeForm && (
                    <Text style={styles.record}>{formatRecord(homeForm)}</Text>
                  )}
                </View>
                <Image source={{ uri: getTeamLogoUrl(homeAbbrev) }} style={styles.teamLogo} contentFit="contain" />
              </View>
            </View>

            {/* Time + optional rest chip */}
            <View style={styles.timeRow}>
              <Text
                style={[
                  styles.timeText,
                  gameTime.isLive && styles.timeLive,
                  gameTime.isFinal && styles.timeFinal,
                ]}
              >
                {timeDisplay}
              </Text>
              {restChip && (
                <View style={[styles.restChip, { backgroundColor: restChip.bg }]}>
                  <Text style={[styles.restChipText, { color: restChip.color }]}>{restChip.label}</Text>
                </View>
              )}
            </View>
          </View>
          <ConfidenceBadge confidence={confidenceScore} size="md" onInfoPress={onInfoPress} />
        </View>

        {/* Row 2: Away% — Bar — Home% */}
        <View style={styles.row2}>
          <Text style={[
            styles.probSide,
            !favoredIsHome && styles.probFavored,
            !favoredIsHome && { color: barColors.away },
            favoredIsHome && styles.probUnderdog,
          ]}>
            {awayProb}%
          </Text>
          <View style={styles.barWrapper}>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${awayProb}%`,
                    backgroundColor: barColors.away,
                  },
                ]}
              />
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${homeProb}%`,
                    backgroundColor: barColors.home,
                  },
                ]}
              />
            </View>
          </View>
          <Text style={[
            styles.probSide,
            favoredIsHome && styles.probFavored,
            favoredIsHome && { color: barColors.home },
            !favoredIsHome && styles.probUnderdog,
          ]}>
            {homeProb}%
          </Text>
        </View>

        {/* Row 3: H2H + Insight + Share */}
        {(h2hRecord || insight || onShare) && (
          <View style={styles.row3}>
            <View style={styles.row3Left}>
              {h2hRecord && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{formatH2H(h2hRecord)}</Text>
                </View>
              )}
              {insight && (
                <Text
                  style={[styles.insightText, { color: `${favoredColor}cc` }]}
                  numberOfLines={1}
                >
                  {insight}
                </Text>
              )}
            </View>
            {onShare && (
              <Pressable onPress={onShare} hitSlop={8}>
                <Ionicons name="share-outline" size={14} color={theme.subtext} />
              </Pressable>
            )}
          </View>
        )}
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
    padding: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderLeftWidth: 5,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  row1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teamLogo: {
    width: 64,
    height: 64,
  },
  teamAbbrev: {
    fontSize: 17,
    fontWeight: '800',
  },
  record: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
    marginTop: 1,
  },
  atSymbol: {
    fontSize: 13,
    color: theme.subtext,
    fontWeight: '400',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
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
  timeFinal: {
    color: theme.subtext,
  },
  restChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  restChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  barWrapper: {
    flex: 1,
  },
  barBg: {
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barFill: {
    height: 14,
  },
  probSide: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 36,
    fontFamily: theme.fonts.mono,
    fontVariant: ['tabular-nums'],
  },
  probFavored: {
    fontSize: 18,
    fontWeight: '800',
  },
  probUnderdog: {
    color: theme.subtext,
    fontSize: 14,
    fontWeight: '600',
  },
  row3: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row3Left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  chip: {
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    flexShrink: 0,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#60a5fa',
  },
  insightText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    flex: 1,
  },
});
