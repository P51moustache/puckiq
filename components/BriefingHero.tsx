/**
 * BriefingHero — the first thing the user sees on the Today screen.
 *
 * Picks the single most interesting story of the day and leads with it.
 * One of three flavors, in priority order:
 *
 *   1. GAME — a tonight's-slate game where the model has high confidence
 *      AND the matchup has a big factor gap. Hero shows: vs matchup, model
 *      probability ring, spread/total, top factor, "tonight at TIME".
 *   2. UPSET — a model miss from yesterday with a high prior probability.
 *      Hero shows: result, model's pre-game probability, what flipped.
 *   3. STREAK — biggest luck-delta team in the league (most likely to
 *      regress / break out). Hero shows: team logo, streak, W%, expected vs
 *      actual gap. Used as off-day fallback.
 *
 * One hero per app open. Larger than any other card. Animated entrance.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { rinkGlass } from '../constants/theme';
import { getTeamLogoUrl } from '../utils/teamLogo';
import { getTeamColors } from '../constants/teamColors';
import type { MLPrediction } from '../services/mlPredictions';
import AnimatedNumber from './AnimatedNumber';
import AnimatedProbBar from './AnimatedProbBar';

interface Game {
  id: number;
  homeTeam?: { abbrev: string; score?: number };
  awayTeam?: { abbrev: string; score?: number };
  startTimeUTC?: string;
  gameState?: string;
}

interface YesterdayUpset {
  id: number;
  homeAbbrev: string;
  awayAbbrev: string;
  homeScore: number;
  awayScore: number;
  homeWinProb: number;
  predictedWinner: string;
}

interface LuckOutlier {
  abbrev: string;
  diffPerGP: number;
  winPct: number;
  luck: number;
  streak?: string;
}

type HeroPick =
  | { kind: 'game'; game: Game; prediction: MLPrediction; topFactorText?: string; favored: string; underdog: string; favoredProb: number }
  | { kind: 'upset'; result: YesterdayUpset; modelGave: number; winnerAbbrev: string; loserAbbrev: string; winnerScore: number; loserScore: number }
  | { kind: 'streak'; team: LuckOutlier };

interface BriefingHeroProps {
  games: Game[];
  predictions: Record<number, MLPrediction>;
  standings: any[];
  yesterdayUpsets?: YesterdayUpset[];
  formMap?: Map<string, { streak?: string }>;
}

/* =====================================================
   Hero pick logic
   ===================================================== */
function pickHero({
  games,
  predictions,
  standings,
  yesterdayUpsets,
  formMap,
}: BriefingHeroProps): HeroPick | null {
  // 1. GAME — highest-confidence model lean tonight
  const candidates = games
    .map((g) => {
      const pred = predictions[g.id];
      if (!pred || pred.home_win_prob == null || !pred.predicted_winner) return null;
      const home = g.homeTeam?.abbrev ?? '';
      const away = g.awayTeam?.abbrev ?? '';
      const homeProb = pred.home_win_prob;
      const favoredProb = pred.predicted_winner === home ? homeProb : 1 - homeProb;
      // Skill-adjusted: high-confidence + favored prob ≥ 0.62.
      if (favoredProb < 0.62) return null;
      const topFactor = pred.top_factors?.[0];
      const topFactorText = topFactor
        ? `${topFactor.feature.replace(/_/g, ' ').toUpperCase()}: ${
            typeof topFactor.value === 'number' ? topFactor.value.toFixed(2) : String(topFactor.value)
          }`
        : undefined;
      return {
        kind: 'game' as const,
        game: g,
        prediction: pred,
        topFactorText,
        favored: pred.predicted_winner,
        underdog: pred.predicted_winner === home ? away : home,
        favoredProb,
      };
    })
    .filter((x): x is Extract<HeroPick, { kind: 'game' }> => x !== null)
    .sort((a, b) => b.favoredProb - a.favoredProb);

  if (candidates.length > 0) return candidates[0];

  // 2. UPSET — biggest model miss from last night
  if (yesterdayUpsets && yesterdayUpsets.length > 0) {
    const sorted = [...yesterdayUpsets].sort((a, b) => {
      const aProb = a.homeWinProb;
      const bProb = b.homeWinProb;
      const aMag = Math.max(aProb, 1 - aProb);
      const bMag = Math.max(bProb, 1 - bProb);
      return bMag - aMag;
    });
    const top = sorted[0];
    const homeWon = top.homeScore > top.awayScore;
    const winner = homeWon ? top.homeAbbrev : top.awayAbbrev;
    const loser = homeWon ? top.awayAbbrev : top.homeAbbrev;
    const modelGave = homeWon ? top.homeWinProb : 1 - top.homeWinProb;
    return {
      kind: 'upset',
      result: top,
      modelGave,
      winnerAbbrev: winner,
      loserAbbrev: loser,
      winnerScore: homeWon ? top.homeScore : top.awayScore,
      loserScore: homeWon ? top.awayScore : top.homeScore,
    };
  }

  // 3. STREAK — biggest luck-delta team in league (off-day fallback)
  if (Array.isArray(standings) && standings.length) {
    const ranked = standings
      .map((s) => {
        const abbrev = typeof s.teamAbbrev === 'string' ? s.teamAbbrev : s.teamAbbrev?.default;
        const gp = (s.gamesPlayed ?? 0) || 1;
        const wins = s.wins ?? 0;
        const goalsFor = s.goalFor ?? 0;
        const goalsAgainst = s.goalAgainst ?? 1;
        const diffPerGP = (goalsFor - goalsAgainst) / gp;
        const winPct = wins / gp;
        const expectedWinPct = 0.5 + diffPerGP * 0.06;
        const luck = winPct - expectedWinPct;
        return { abbrev, diffPerGP, winPct, luck, gp };
      })
      .filter((s) => s.abbrev && s.gp >= 10)
      .sort((a, b) => Math.abs(b.luck) - Math.abs(a.luck));
    const top = ranked[0];
    if (top) {
      return {
        kind: 'streak',
        team: {
          abbrev: top.abbrev!,
          diffPerGP: top.diffPerGP,
          winPct: top.winPct,
          luck: top.luck,
          streak: formMap?.get(top.abbrev!)?.streak,
        },
      };
    }
  }

  return null;
}

/* =====================================================
   Sub-components per hero kind
   ===================================================== */
function GameHero({ pick }: { pick: Extract<HeroPick, { kind: 'game' }> }) {
  const home = pick.game.homeTeam?.abbrev ?? '';
  const away = pick.game.awayTeam?.abbrev ?? '';
  const time = pick.game.startTimeUTC
    ? new Date(pick.game.startTimeUTC).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '';
  const favoredColors = getTeamColors(pick.favored);
  const probPct = pick.favoredProb * 100;
  const conf = pick.prediction.confidence ?? 'medium';
  const spread = pick.prediction.predicted_spread;
  const total = pick.prediction.predicted_total;

  return (
    <>
      {/* Two-stop team-color gradient — heavier on the favored side */}
      <LinearGradient
        colors={[`${favoredColors?.primary ?? rinkGlass.blueLight}3A`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft radial-ish second gradient bottom-right for depth */}
      <LinearGradient
        colors={['transparent', `${favoredColors?.primary ?? rinkGlass.blueLight}1A`]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.headerRow}>
        <View style={styles.eyebrowDot} />
        <Text style={styles.eyebrowLabel}>TOP PICK · TONIGHT</Text>
        <Text style={styles.eyebrowMeta}>{time}</Text>
      </View>

      {/* Big probability moment — number is the page's lead visual */}
      <View style={styles.heroProbBlock}>
        <View style={styles.heroProbNumberRow}>
          <AnimatedNumber
            value={probPct}
            format={(n) => Math.round(n).toString()}
            duration={1100}
            style={styles.heroProbValue}
          />
          <Text style={styles.heroProbPercent}>%</Text>
        </View>
        <Text style={styles.heroProbCaption}>
          {pick.favored} <Text style={styles.confDot}> · </Text>
          <Text style={styles.confLabel}>{conf.toUpperCase()} CONFIDENCE</Text>
        </Text>
        <Text style={styles.heroExplainer}>
          Model's probability that {pick.favored} wins tonight.
        </Text>
      </View>

      {/* Bigger logos + abbrevs */}
      <View style={styles.matchupBigRow}>
        <View style={styles.teamColBig}>
          <ExpoImage source={{ uri: getTeamLogoUrl(away) }} style={styles.heroLogoBig} contentFit="contain" />
          <Text style={[styles.teamAbbrevBig, pick.favored === away && styles.teamAbbrevFavored]}>{away}</Text>
        </View>
        <View style={styles.matchupAtBigCol}>
          <Text style={styles.matchupAtBig}>@</Text>
        </View>
        <View style={styles.teamColBig}>
          <ExpoImage source={{ uri: getTeamLogoUrl(home) }} style={styles.heroLogoBig} contentFit="contain" />
          <Text style={[styles.teamAbbrevBig, pick.favored === home && styles.teamAbbrevFavored]}>{home}</Text>
        </View>
      </View>

      {/* Animated chunky probability bar */}
      <AnimatedProbBar
        value={pick.favoredProb}
        color={favoredColors?.primary ?? rinkGlass.blueLight}
        height={10}
        delay={250}
        duration={950}
      />

      <View style={styles.linesRow}>
        {spread != null && (
          <View style={styles.lineChip}>
            <Text style={styles.lineLabel}>SPR</Text>
            <Text style={styles.lineValue}>
              {pick.favored} {spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1)}
            </Text>
          </View>
        )}
        {total != null && (
          <View style={styles.lineChip}>
            <Text style={styles.lineLabel}>O/U</Text>
            <Text style={styles.lineValue}>{total.toFixed(1)}</Text>
          </View>
        )}
        {pick.topFactorText && (
          <Text style={styles.factorText} numberOfLines={1}>
            {pick.topFactorText}
          </Text>
        )}
      </View>
    </>
  );
}

function UpsetHero({ pick }: { pick: Extract<HeroPick, { kind: 'upset' }> }) {
  return (
    <>
      <View style={styles.headerRow}>
        <View style={[styles.eyebrowDot, { backgroundColor: rinkGlass.powerPlay }]} />
        <Text style={[styles.eyebrowLabel, { color: rinkGlass.powerPlay }]}>UPSET · LAST NIGHT</Text>
        <Text style={styles.eyebrowMeta}>Model missed</Text>
      </View>

      <View style={styles.upsetRow}>
        <ExpoImage source={{ uri: getTeamLogoUrl(pick.winnerAbbrev) }} style={styles.heroLogo} contentFit="contain" />
        <View style={styles.upsetCenter}>
          <Text style={styles.upsetScore}>
            <Text style={styles.upsetWinScore}>{pick.winnerScore}</Text>
            <Text style={styles.scoreSep}> · </Text>
            <Text style={styles.upsetLoseScore}>{pick.loserScore}</Text>
          </Text>
          <Text style={styles.upsetTeams}>
            <Text style={styles.upsetWinner}>{pick.winnerAbbrev}</Text>
            <Text style={styles.upsetVs}> over </Text>
            <Text style={styles.upsetLoser}>{pick.loserAbbrev}</Text>
          </Text>
        </View>
        <ExpoImage source={{ uri: getTeamLogoUrl(pick.loserAbbrev) }} style={[styles.heroLogo, { opacity: 0.45 }]} contentFit="contain" />
      </View>

      <View style={styles.upsetMetaRow}>
        <View style={styles.lineChip}>
          <Text style={styles.lineLabel}>MODEL GAVE</Text>
          <Text style={styles.lineValue}>{Math.round(pick.modelGave * 100)}%</Text>
        </View>
        <View style={[styles.lineChip, styles.lineChipAccent]}>
          <Text style={[styles.lineLabel, { color: rinkGlass.powerPlay }]}>OUTCOME</Text>
          <Text style={[styles.lineValue, { color: rinkGlass.powerPlay }]}>UPSET</Text>
        </View>
      </View>
    </>
  );
}

function StreakHero({ pick }: { pick: Extract<HeroPick, { kind: 'streak' }> }) {
  const t = pick.team;
  const overperforming = t.luck > 0;
  const colors = getTeamColors(t.abbrev);

  return (
    <>
      <LinearGradient
        colors={[`${colors?.primary ?? rinkGlass.blueLight}26`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.headerRow}>
        <View
          style={[
            styles.eyebrowDot,
            { backgroundColor: overperforming ? rinkGlass.faceoffDot : rinkGlass.redLine },
          ]}
        />
        <Text
          style={[
            styles.eyebrowLabel,
            { color: overperforming ? rinkGlass.faceoffDot : rinkGlass.redLine },
          ]}
        >
          {overperforming ? 'BREAKOUT WATCH' : 'REGRESSION WATCH'}
        </Text>
        <Text style={styles.eyebrowMeta}>Model says...</Text>
      </View>

      <View style={styles.streakRow}>
        <ExpoImage source={{ uri: getTeamLogoUrl(t.abbrev) }} style={styles.heroLogoLarge} contentFit="contain" />
        <View style={styles.streakInfo}>
          <Text style={styles.streakAbbrev}>{t.abbrev}</Text>
          <Text style={styles.streakSubline}>
            {t.diffPerGP >= 0 ? '+' : ''}
            {t.diffPerGP.toFixed(2)} G/GP · {Math.round(t.winPct * 100)}% W
            {t.streak ? `  ·  ${t.streak}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.streakStatement}>
        <Text style={styles.streakStatementHead}>
          {overperforming
            ? 'Winning more than goal differential suggests'
            : 'Goal differential outpaces wins'}
        </Text>
        <Text style={styles.streakStatementBody}>
          Expected W%: {Math.round((t.winPct - t.luck) * 100)}% · Actual: {Math.round(t.winPct * 100)}%
          <Text style={{ color: overperforming ? rinkGlass.faceoffDot : rinkGlass.redLine }}>
            {' '}·  {t.luck >= 0 ? '+' : ''}
            {Math.round(t.luck * 100)}%
          </Text>
        </Text>
      </View>
    </>
  );
}

/* =====================================================
   Main component — animated entrance, tappable
   ===================================================== */
export default function BriefingHero(props: BriefingHeroProps) {
  const router = useRouter();
  const pick = useMemo(() => pickHero(props), [props]);

  // Subtle breathing on the eyebrow dot when hero is "live" content (game or upset)
  const dotScale = useSharedValue(1);
  React.useEffect(() => {
    dotScale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [dotScale]);

  if (!pick) return null;

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    if (pick.kind === 'game') {
      router.push(`/stats?game=${pick.game.id}` as any);
    } else if (pick.kind === 'upset') {
      router.push(`/stats?game=${pick.result.id}` as any);
    } else {
      router.push(`/teams?team=${pick.team.abbrev}` as any);
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(420).springify().damping(16)}
      style={styles.wrapper}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        {pick.kind === 'game' && <GameHero pick={pick} />}
        {pick.kind === 'upset' && <UpsetHero pick={pick} />}
        {pick.kind === 'streak' && <StreakHero pick={pick} />}

        <View style={styles.footer}>
          <Text style={styles.footerText}>TAP FOR DETAIL</Text>
          <Text style={styles.footerArrow}>→</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* =====================================================
   Styles
   ===================================================== */
const styles = StyleSheet.create({
  wrapper: {
    // No horizontal padding — parent container provides it.
  },
  card: {
    backgroundColor: rinkGlass.boards,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
    shadowColor: rinkGlass.blueLight,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    gap: 10,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  // Header eyebrow
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: rinkGlass.blueLight,
  },
  eyebrowLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: rinkGlass.blueLight,
    letterSpacing: 1.5,
  },
  eyebrowMeta: {
    fontSize: 10,
    color: rinkGlass.textMuted,
    fontFamily: rinkGlass.fonts.mono,
    marginLeft: 'auto',
    letterSpacing: 0.5,
  },
  // Game hero — big-number-first composition
  heroProbBlock: {
    paddingTop: 6,
    paddingBottom: 4,
  },
  heroProbNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 0,
  },
  heroProbValue: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 88,
    color: rinkGlass.textPrimary,
    lineHeight: 102,
    letterSpacing: -3,
  },
  heroProbPercent: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 32,
    color: rinkGlass.textSecondary,
    lineHeight: 44,
    letterSpacing: -1,
    marginLeft: -2,
  },
  heroProbCaption: {
    fontSize: 12,
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.mono,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 1,
  },
  heroExplainer: {
    fontSize: 11,
    color: rinkGlass.textMuted,
    marginTop: 6,
    lineHeight: 15,
  },
  confDot: {
    color: rinkGlass.textMuted,
  },
  confLabel: {
    color: rinkGlass.blueLight,
  },
  matchupBigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  teamColBig: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchupAtBigCol: {
    paddingHorizontal: 2,
  },
  matchupAtBig: {
    fontSize: 13,
    color: rinkGlass.textMuted,
    fontFamily: rinkGlass.fonts.mono,
  },
  heroLogoBig: {
    width: 28,
    height: 28,
  },
  heroLogoLarge: {
    width: 54,
    height: 54,
  },
  teamAbbrevBig: {
    fontSize: 18,
    fontWeight: '700',
    color: rinkGlass.textSecondary,
    fontFamily: rinkGlass.fonts.mono,
    letterSpacing: 0.5,
  },
  teamAbbrev: {
    fontSize: 12,
    fontWeight: '700',
    color: rinkGlass.textSecondary,
    fontFamily: rinkGlass.fonts.mono,
    letterSpacing: 0.5,
  },
  teamAbbrevFavored: {
    color: rinkGlass.textPrimary,
  },
  linesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  lineChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: rinkGlass.zamboni,
    borderRadius: 4,
  },
  lineChipAccent: {
    backgroundColor: 'rgba(255, 214, 10, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 10, 0.4)',
  },
  lineLabel: {
    fontSize: 9,
    color: rinkGlass.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  lineValue: {
    fontSize: 12,
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.mono,
    fontWeight: '700',
  },
  factorText: {
    fontSize: 10,
    color: rinkGlass.textSecondary,
    fontFamily: rinkGlass.fonts.mono,
    letterSpacing: 0.3,
    flex: 1,
  },
  // Upset hero
  upsetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 4,
  },
  upsetCenter: {
    flex: 1,
    alignItems: 'center',
  },
  upsetScore: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 36,
    lineHeight: 38,
  },
  upsetWinScore: {
    color: rinkGlass.textPrimary,
  },
  upsetLoseScore: {
    color: rinkGlass.textMuted,
  },
  scoreSep: {
    color: rinkGlass.textMuted,
  },
  upsetTeams: {
    fontSize: 12,
    fontFamily: rinkGlass.fonts.mono,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  upsetWinner: {
    color: rinkGlass.textPrimary,
  },
  upsetVs: {
    color: rinkGlass.textMuted,
  },
  upsetLoser: {
    color: rinkGlass.textSecondary,
  },
  upsetMetaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  // Streak hero
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 4,
  },
  streakInfo: {
    flex: 1,
  },
  streakAbbrev: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 32,
    color: rinkGlass.textPrimary,
    lineHeight: 34,
    letterSpacing: 0.5,
  },
  streakSubline: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
    fontFamily: rinkGlass.fonts.mono,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  streakStatement: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: rinkGlass.glassBorder,
    gap: 4,
  },
  streakStatementHead: {
    fontSize: 13,
    color: rinkGlass.textPrimary,
    fontWeight: '600',
    lineHeight: 18,
  },
  streakStatementBody: {
    fontSize: 11,
    color: rinkGlass.textMuted,
    fontFamily: rinkGlass.fonts.mono,
    letterSpacing: 0.5,
  },
  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingTop: 2,
  },
  footerText: {
    fontSize: 10,
    fontWeight: '800',
    color: rinkGlass.blueLight,
    letterSpacing: 1.5,
  },
  footerArrow: {
    fontSize: 12,
    color: rinkGlass.blueLight,
    fontWeight: '700',
  },
});
