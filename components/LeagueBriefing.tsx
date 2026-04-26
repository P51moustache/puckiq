/**
 * LeagueBriefing — production version of the Today screen's content.
 *
 * Stat-Sheet vision: a daily league briefing for the hockey enthusiast.
 * Every section pulls from real signal in useTonightData (momentum, edge,
 * derived insights, head-to-head, team form) plus ml_predictions, plus a
 * standings-derived luck index. No narrative copy, no fantasy framing.
 *
 * Sections:
 *   - Header strip: "Updated Xm ago" + manual refresh affordance
 *   - Live ribbon: any in-progress games (score, period, clock, LIVE pulse)
 *   - Tonight's Slate: every game with model %, spread, O/U, top factor,
 *     B2B tag, lineup status; tappable.
 *   - Mismatches: top 3 games sorted by goal-pace + edge gap; tappable.
 *   - Watchlist: top 5 luck-delta teams + L10 form sparkline.
 *   - Yesterday: model accuracy summary header + upset-led results.
 *   - Off-day fallback: next slate preview + season leaders + standings race
 *     when there are no games today.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { rinkGlass } from '../constants/theme';
import { getTeamLogoUrl } from '../utils/teamLogo';
import { supabase } from '../lib/supabase';
import { getMLPredictions, type MLPrediction } from '../services/mlPredictions';
import { getLeagueLeaders, type SkaterLeader } from '../services/playerLeaders';
import BriefingHero from './BriefingHero';
import AnimatedNumber from './AnimatedNumber';
import { DualTeamSplitBar, FormSquares, FactorMiniBar } from './SlateRowViz';
import HeatStrip from './HeatStrip';
import FlippableRow from './FlippableRow';
import type { H2HRecord } from '../types/gameResults';
import type { MomentumData, ClutchRating, EdgeTeamLanding } from '../types/edgeStats';
import type { TeamFormData } from '../types/teamForm';

interface Game {
  id: number;
  homeTeam?: { abbrev: string; score?: number };
  awayTeam?: { abbrev: string; score?: number };
  startTimeUTC?: string;
  gameState?: string;
  period?: number;
  clock?: { timeRemaining?: string; inIntermission?: boolean };
}

interface LeagueBriefingProps {
  todaysGames?: { games?: Game[] } | null;
  currentStandings?: { standings?: any[] } | null;
  isLoading?: boolean;
  hasGamesToday?: boolean;
  isShowingUpcoming?: boolean;
  gamesByDate?: Array<{ date: string; label: string; games: Game[] }>;
  predictionsMap?: Map<string, { homeWinProb: number; awayWinProb: number }>;
  h2hMap?: Map<string, H2HRecord>;
  momentumMap?: Map<string, MomentumData>;
  formMap?: Map<string, TeamFormData>;
  restMap?: Map<string, number>;
  edgeTeamLanding?: EdgeTeamLanding | null;
  lastFetchTime?: Date | null;
  onRefresh?: () => void;
  onSectionView?: (section: string) => void;
}

interface YesterdayGame {
  id: number;
  homeAbbrev: string;
  awayAbbrev: string;
  homeScore: number;
  awayScore: number;
  homeWinProb: number | null;
  predictedWinner: string | null;
  isUpset: boolean;
  isOvertime: boolean;
  modelHit: boolean | null;
}

interface YesterdaySummary {
  games: YesterdayGame[];
  modelWins: number;
  modelLosses: number;
  totalScored: number;
}

const REFRESH_LIVE_MS = 30_000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateString(d);
}

function formatGameTime(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatRelativeMinutes(d?: Date | null): string {
  if (!d) return '';
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function isLiveGame(g: Game): boolean {
  const s = g.gameState ?? '';
  return s === 'LIVE' || s === 'CRIT' || s === 'PRE';
}

function isFinalGame(g: Game): boolean {
  const s = g.gameState ?? '';
  return s === 'OFF' || s === 'FINAL';
}

/* =====================================================
   Live ribbon — score + period for in-progress games
   ===================================================== */
function LivePulse() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.livePulse, style]} />;
}

function LiveRibbon({ games, onPress }: { games: Game[]; onPress: (gameId: number) => void }) {
  if (!games.length) return null;
  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <LivePulse />
          <Text style={styles.headerLabel}>LIVE</Text>
          <Text style={styles.headerCount}>{games.length}</Text>
        </View>
        <View style={styles.headerUnderline} />
      </View>
      <View style={styles.list}>
        {games.map((g) => {
          const periodTxt = g.clock?.inIntermission
            ? `INT ${g.period ?? ''}`
            : g.period
              ? `P${g.period}${g.clock?.timeRemaining ? ` · ${g.clock.timeRemaining}` : ''}`
              : 'LIVE';
          return (
            <Pressable
              key={g.id}
              onPress={() => onPress(g.id)}
              style={({ pressed }) => [styles.liveRow, pressed && styles.rowPressed]}
            >
              <View style={styles.slateMatchup}>
                <ExpoImage source={{ uri: getTeamLogoUrl(g.awayTeam?.abbrev ?? '') }} style={styles.slateLogo} contentFit="contain" />
                <Text style={styles.slateAbbrev}>{g.awayTeam?.abbrev}</Text>
                <Text style={styles.liveScore}>{g.awayTeam?.score ?? 0}</Text>
                <Text style={styles.scoreSep}>·</Text>
                <Text style={styles.liveScore}>{g.homeTeam?.score ?? 0}</Text>
                <Text style={styles.slateAbbrev}>{g.homeTeam?.abbrev}</Text>
                <ExpoImage source={{ uri: getTeamLogoUrl(g.homeTeam?.abbrev ?? '') }} style={styles.slateLogo} contentFit="contain" />
              </View>
              <Text style={styles.livePeriod}>{periodTxt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* =====================================================
   Tonight's Slate
   ===================================================== */
function SlateSection({
  games,
  predictions,
  predictionsMap,
  restMap,
  formMap,
  standings,
  onPressGame,
}: {
  games: Game[];
  predictions: Record<number, MLPrediction>;
  predictionsMap?: Map<string, { homeWinProb: number; awayWinProb: number }>;
  restMap?: Map<string, number>;
  formMap?: Map<string, TeamFormData>;
  standings: any[];
  onPressGame: (gameId: number) => void;
}) {
  // Build a quick standings lookup so we can show GF/GP-style factor bars.
  const byAbbrev = useMemo(() => {
    const map: Record<string, any> = {};
    if (Array.isArray(standings)) {
      for (const s of standings) {
        const ab = typeof s.teamAbbrev === 'string' ? s.teamAbbrev : s.teamAbbrev?.default;
        if (ab) map[ab] = s;
      }
    }
    return map;
  }, [standings]);
  if (!games?.length) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLabel}>TONIGHT'S SLATE</Text>
          <Text style={styles.headerCount}>{games.length}</Text>
        </View>
        <Text style={styles.headerHint}>Model · Lines · Tags</Text>
        <View style={styles.headerUnderline} />
      </View>
      <View style={styles.list}>
        {games.map((g) => {
          const home = g.homeTeam?.abbrev ?? '';
          const away = g.awayTeam?.abbrev ?? '';
          const mlPred = predictions[g.id];
          const fallbackProb = predictionsMap?.get(`${home}-${away}`) ?? predictionsMap?.get(`${away}-${home}`);
          const homeProb = mlPred?.home_win_prob ?? fallbackProb?.homeWinProb ?? null;
          const winner = mlPred?.predicted_winner ?? (homeProb !== null && homeProb !== undefined ? (homeProb >= 0.5 ? home : away) : null);
          const spread = mlPred?.predicted_spread;
          const total = mlPred?.predicted_total;
          const conf = mlPred?.confidence;
          const anomaly =
            conf === 'high' && homeProb !== null && homeProb !== undefined && (homeProb >= 0.65 || homeProb <= 0.35);
          const topFactor = mlPred?.top_factors?.[0];
          const restAdv = restMap?.get(`${away}-${home}`);
          const awayB2B = restMap ? (restMap.get(away) ?? 99) === 0 : false;
          const homeB2B = restMap ? (restMap.get(home) ?? 99) === 0 : false;

          // Compute a "GOAL PACE" factor row for the bar:
          // favored team's GF/GP vs underdog team's allowance — the simplest
          // single-stat that tells the story.
          const homeStanding = byAbbrev[home];
          const awayStanding = byAbbrev[away];
          let factorBlock: { label: string; favVal: number; undVal: number; favAb: string; undAb: string } | null = null;
          if (homeStanding && awayStanding && winner) {
            const hgp = (homeStanding.gamesPlayed ?? 1) || 1;
            const agp = (awayStanding.gamesPlayed ?? 1) || 1;
            const homeGF = (homeStanding.goalFor ?? 0) / hgp;
            const awayGF = (awayStanding.goalFor ?? 0) / agp;
            factorBlock = {
              label: 'GF / GAME',
              favVal: winner === home ? homeGF : awayGF,
              undVal: winner === home ? awayGF : homeGF,
              favAb: winner,
              undAb: winner === home ? away : home,
            };
          }
          const homeForm = formMap?.get(home);
          const awayForm = formMap?.get(away);
          const factors = mlPred?.top_factors?.slice(0, 3) ?? [];

          const front = (
            <View style={styles.slateRow}>
              <View style={styles.slateMatchup}>
                <ExpoImage source={{ uri: getTeamLogoUrl(away) }} style={styles.slateLogo} contentFit="contain" />
                <View style={styles.slateAbbrevCol}>
                  <Text style={styles.slateAbbrev}>{away}</Text>
                  {awayForm?.streak ? <Text style={styles.streakTiny}>{awayForm.streak}</Text> : null}
                  {awayB2B && <Text style={styles.b2bTag}>B2B</Text>}
                </View>
                <Text style={styles.slateAt}>@</Text>
                <View style={styles.slateAbbrevCol}>
                  <Text style={styles.slateAbbrev}>{home}</Text>
                  {homeForm?.streak ? <Text style={styles.streakTiny}>{homeForm.streak}</Text> : null}
                  {homeB2B && <Text style={styles.b2bTag}>B2B</Text>}
                </View>
                <ExpoImage source={{ uri: getTeamLogoUrl(home) }} style={styles.slateLogo} contentFit="contain" />
              </View>
              <View style={styles.slateRight}>
                {homeProb !== null && homeProb !== undefined ? (
                  <View style={styles.slateProbBlock}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <AnimatedNumber
                        value={Math.round((winner === home ? homeProb : 1 - homeProb) * 100)}
                        style={styles.slateProbValue}
                      />
                      <Text style={styles.slateProbPercent}>%</Text>
                    </View>
                    <Text style={styles.slateProbLabel}>{winner ?? home}</Text>
                  </View>
                ) : (
                  <Text style={styles.slateTime}>{formatGameTime(g.startTimeUTC)}</Text>
                )}
              </View>

              {/* Dual-team gradient split bar with model-probability tick */}
              {homeProb !== null && homeProb !== undefined && (
                <DualTeamSplitBar awayAbbrev={away} homeAbbrev={home} homeProb={homeProb} delay={150} />
              )}

              {/* Form squares row — L10 for both teams, side by side */}
              {(homeForm?.results?.length || awayForm?.results?.length) && (
                <View style={styles.formsRow}>
                  <View style={styles.formCell}>
                    <Text style={styles.formLabel}>{away} L10</Text>
                    <FormSquares results={awayForm?.results} />
                  </View>
                  <View style={styles.formCell}>
                    <Text style={styles.formLabelRight}>L10 {home}</Text>
                    <FormSquares results={homeForm?.results} />
                  </View>
                </View>
              )}

              {/* Lines + tags row */}
              {(spread != null || total != null || anomaly) && (
                <View style={styles.slateMeta}>
                  {spread != null && (
                    <Text style={styles.slateMetaText}>
                      SPR <Text style={styles.slateMetaValue}>{(winner ?? home)} {spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1)}</Text>
                    </Text>
                  )}
                  {total != null && (
                    <Text style={styles.slateMetaText}>
                      O/U <Text style={styles.slateMetaValue}>{total.toFixed(1)}</Text>
                    </Text>
                  )}
                  {anomaly && (
                    <View style={styles.anomalyBadge}>
                      <Text style={styles.anomalyText}>MODEL LEAN</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Factor mini-bar */}
              {factorBlock && (
                <FactorMiniBar
                  label={factorBlock.label}
                  favoredValue={factorBlock.favVal}
                  underdogValue={factorBlock.undVal}
                  favoredAbbrev={factorBlock.favAb}
                  underdogAbbrev={factorBlock.undAb}
                />
              )}
              <Text style={styles.flipHint}>HOLD TO REVEAL FACTORS</Text>
            </View>
          );

          const back = (
            <View style={[styles.slateRow, styles.slateRowBack]}>
              <View style={styles.backHeaderRow}>
                <Text style={styles.backTitle}>{away} @ {home}</Text>
                <Text style={styles.backTitleMeta}>MODEL FACTORS</Text>
              </View>
              {factors.length > 0 ? (
                <View style={styles.factorList}>
                  {factors.map((f, idx) => {
                    const importance = Math.min(1, Math.abs(f.impact ?? 0));
                    return (
                      <View key={idx} style={styles.factorListRow}>
                        <Text style={styles.factorListLabel} numberOfLines={1}>
                          {String(f.feature).replace(/_/g, ' ').toUpperCase()}
                        </Text>
                        <View style={styles.factorListBarTrack}>
                          <View
                            style={[
                              styles.factorListBarFill,
                              { width: `${importance * 100}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.factorListValue}>
                          {typeof f.value === 'number' ? f.value.toFixed(2) : String(f.value)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.backNoData}>NO FACTOR DATA</Text>
              )}
              <View style={styles.backFooterRow}>
                <Text style={styles.backFooter}>
                  CONFIDENCE <Text style={styles.backFooterValue}>{(conf ?? 'medium').toUpperCase()}</Text>
                </Text>
                <Text style={styles.backFooterTap}>TAP TO FLIP BACK</Text>
              </View>
            </View>
          );

          return (
            <FlippableRow
              key={g.id}
              front={front}
              back={back}
              onTap={() => onPressGame(g.id)}
              minHeight={260}
            />
          );
        })}
      </View>
    </View>
  );
}

/* =====================================================
   Mismatches
   ===================================================== */
function MismatchSection({
  games,
  standings,
  edgeTeamLanding,
  onPressGame,
}: {
  games: Game[];
  standings: any[];
  edgeTeamLanding?: EdgeTeamLanding | null;
  onPressGame: (gameId: number) => void;
}) {
  const standingByAbbrev = useMemo(() => {
    const map: Record<string, any> = {};
    if (Array.isArray(standings)) {
      for (const s of standings) {
        const ab = typeof s.teamAbbrev === 'string' ? s.teamAbbrev : s.teamAbbrev?.default;
        if (ab) map[ab] = s;
      }
    }
    return map;
  }, [standings]);

  const mismatches = useMemo(() => {
    if (!games?.length || !Object.keys(standingByAbbrev).length) return [];
    return games
      .map((g) => {
        const home = g.homeTeam?.abbrev ?? '';
        const away = g.awayTeam?.abbrev ?? '';
        const hs = standingByAbbrev[home];
        const as = standingByAbbrev[away];
        if (!hs || !as) return null;
        const hgp = (hs.gamesPlayed ?? 1) || 1;
        const agp = (as.gamesPlayed ?? 1) || 1;
        const homeGFPerGP = (hs.goalFor ?? 0) / hgp;
        const awayGAPerGP = (as.goalAgainst ?? 0) / agp;
        const awayGFPerGP = (as.goalFor ?? 0) / agp;
        const homeGAPerGP = (hs.goalAgainst ?? 0) / hgp;
        const homeAdvantage = homeGFPerGP + awayGAPerGP;
        const awayAdvantage = awayGFPerGP + homeGAPerGP;
        const gap = Math.abs(homeAdvantage - awayAdvantage);
        const favored = homeAdvantage > awayAdvantage ? home : away;
        const underdog = favored === home ? away : home;
        return {
          game: g,
          favored,
          underdog,
          gap,
          favoredGF: favored === home ? homeGFPerGP : awayGFPerGP,
          underdogGA: favored === home ? awayGAPerGP : homeGAPerGP,
          favoredPP: standingByAbbrev[favored]?.points,
          favoredGP: standingByAbbrev[favored]?.gamesPlayed,
          underdogPP: standingByAbbrev[underdog]?.points,
          underdogGP: standingByAbbrev[underdog]?.gamesPlayed,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 3);
  }, [games, standingByAbbrev]);

  if (!mismatches.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLabel}>MISMATCHES</Text>
        </View>
        <Text style={styles.headerHint}>Tonight's biggest gaps</Text>
        <View style={styles.headerUnderline} />
      </View>
      <View style={styles.list}>
        {mismatches.map((m) => (
          <Pressable
            key={m.game.id}
            onPress={() => onPressGame(m.game.id)}
            style={({ pressed }) => [styles.mismatchRow, pressed && styles.rowPressed]}
          >
            <View style={styles.mismatchLeft}>
              <ExpoImage source={{ uri: getTeamLogoUrl(m.favored) }} style={styles.mismatchLogo} contentFit="contain" />
              <View style={styles.mismatchTeams}>
                <Text style={styles.mismatchFavored}>{m.favored}</Text>
                <Text style={styles.mismatchVs}>
                  vs {m.underdog}
                  {m.favoredPP != null && m.underdogPP != null
                    ? `  ·  ${m.favoredPP}–${m.underdogPP} PTS`
                    : ''}
                </Text>
              </View>
            </View>
            <View style={styles.mismatchStats}>
              <View style={styles.statBlock}>
                <Text style={styles.statValue}>{m.favoredGF.toFixed(2)}</Text>
                <Text style={styles.statLabel}>GF/GP</Text>
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.statValue}>{m.underdogGA.toFixed(2)}</Text>
                <Text style={styles.statLabel}>OPP GA/GP</Text>
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.gapValue}>+{m.gap.toFixed(2)}</Text>
                <Text style={styles.statLabel}>GAP</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* =====================================================
   Watchlist — luck delta + form sparkline
   ===================================================== */
function FormSparkline({ results }: { results?: ('W' | 'L' | 'OTL')[] }) {
  if (!results?.length) return null;
  return (
    <View style={styles.sparklineRow}>
      {results.slice(0, 10).map((r, i) => (
        <View
          key={i}
          style={[
            styles.sparkBar,
            r === 'W' && { backgroundColor: rinkGlass.faceoffDot },
            r === 'L' && { backgroundColor: rinkGlass.redLine, opacity: 0.7 },
            r === 'OTL' && { backgroundColor: rinkGlass.powerPlay, opacity: 0.7 },
          ]}
        />
      ))}
    </View>
  );
}

function WatchlistSection({
  standings,
  formMap,
  onPressTeam,
}: {
  standings: any[];
  formMap?: Map<string, TeamFormData>;
  onPressTeam: (abbrev: string) => void;
}) {
  const watchlist = useMemo(() => {
    if (!Array.isArray(standings) || !standings.length) return [];
    return standings
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
        return { abbrev, gp, diffPerGP, winPct, luck };
      })
      .filter((s) => s.abbrev && s.gp >= 10)
      .sort((a, b) => Math.abs(b.luck) - Math.abs(a.luck))
      .slice(0, 5);
  }, [standings]);

  if (!watchlist.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLabel}>WATCHLIST</Text>
        </View>
        <Text style={styles.headerHint}>W% vs goal differential</Text>
        <View style={styles.headerUnderline} />
      </View>
      <View style={styles.list}>
        {watchlist.map((w) => {
          const overperforming = w.luck > 0;
          const form = w.abbrev ? formMap?.get(w.abbrev) : undefined;
          return (
            <Pressable
              key={w.abbrev}
              onPress={() => w.abbrev && onPressTeam(w.abbrev)}
              style={({ pressed }) => [styles.watchRow, pressed && styles.rowPressed]}
            >
              <ExpoImage source={{ uri: getTeamLogoUrl(w.abbrev!) }} style={styles.watchLogo} contentFit="contain" />
              <View style={styles.watchInfo}>
                <View style={styles.watchHeader}>
                  <Text style={styles.watchAbbrev}>{w.abbrev}</Text>
                  {form?.streak && <Text style={styles.streakChip}>{form.streak}</Text>}
                </View>
                <Text style={styles.watchSubline}>
                  {w.diffPerGP >= 0 ? '+' : ''}{w.diffPerGP.toFixed(2)} G/GP · {Math.round(w.winPct * 100)}% W
                </Text>
                {form && <FormSparkline results={form.results} />}
              </View>
              <View style={[styles.luckTag, overperforming ? styles.luckOver : styles.luckUnder]}>
                <Text style={[styles.luckText, overperforming ? styles.luckOverText : styles.luckUnderText]}>
                  {overperforming ? 'OVER' : 'UNDER'}
                </Text>
                <Text style={styles.luckValue}>
                  {w.luck >= 0 ? '+' : ''}{Math.round(w.luck * 100)}%
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* =====================================================
   Yesterday — model accuracy strip + result rows
   ===================================================== */
function YesterdaySection({ onPressGame }: { onPressGame: (gameId: number) => void }) {
  const [summary, setSummary] = useState<YesterdaySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const yesterday = getYesterdayString();
        const { data: games } = await supabase
          .from('games')
          .select('id, home_team_abbrev, away_team_abbrev, home_score, away_score, game_state, period_type')
          .eq('game_date', yesterday)
          .in('game_state', ['OFF', 'FINAL']);

        if (cancelled || !games?.length) {
          setSummary({ games: [], modelWins: 0, modelLosses: 0, totalScored: 0 });
          setLoading(false);
          return;
        }

        const preds = await getMLPredictions(yesterday);
        let modelWins = 0;
        let modelLosses = 0;
        let totalScored = 0;
        const enriched: YesterdayGame[] = games.map((g: any) => {
          const homeProb = preds[g.id]?.home_win_prob ?? null;
          const predictedWinner = preds[g.id]?.predicted_winner ?? null;
          const homeWon = (g.home_score ?? 0) > (g.away_score ?? 0);
          const winner = homeWon ? g.home_team_abbrev : g.away_team_abbrev;
          let modelHit: boolean | null = null;
          if (predictedWinner) {
            modelHit = predictedWinner === winner;
            if (modelHit) modelWins++;
            else modelLosses++;
          }
          const isUpset =
            homeProb !== null && ((homeWon && homeProb < 0.4) || (!homeWon && homeProb > 0.6));
          totalScored += (g.home_score ?? 0) + (g.away_score ?? 0);
          return {
            id: g.id,
            homeAbbrev: g.home_team_abbrev,
            awayAbbrev: g.away_team_abbrev,
            homeScore: g.home_score ?? 0,
            awayScore: g.away_score ?? 0,
            homeWinProb: homeProb,
            predictedWinner,
            isUpset,
            isOvertime: g.period_type === 'OT' || g.period_type === 'SO',
            modelHit,
          };
        });

        enriched.sort((a, b) => {
          if (a.isUpset !== b.isUpset) return a.isUpset ? -1 : 1;
          if (a.isOvertime !== b.isOvertime) return a.isOvertime ? -1 : 1;
          return 0;
        });

        if (!cancelled) {
          setSummary({ games: enriched, modelWins, modelLosses, totalScored });
          setLoading(false);
        }
      } catch (err) {
        console.warn('[LeagueBriefing] yesterday load failed', err);
        if (!cancelled) {
          setSummary({ games: [], modelWins: 0, modelLosses: 0, totalScored: 0 });
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerLabel}>YESTERDAY</Text>
          </View>
          <View style={styles.headerUnderline} />
        </View>
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.yesterdayRow, styles.skeleton]} />
          ))}
        </View>
      </View>
    );
  }
  if (!summary?.games.length) return null;

  const acc =
    summary.modelWins + summary.modelLosses > 0
      ? Math.round((summary.modelWins / (summary.modelWins + summary.modelLosses)) * 100)
      : null;
  const topUpset = summary.games.find((g) => g.isUpset);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLabel}>YESTERDAY</Text>
          <Text style={styles.headerCount}>{summary.games.length}</Text>
        </View>
        {acc !== null && (
          <Text style={styles.headerHint}>
            Model {summary.modelWins}–{summary.modelLosses} · {acc}%
          </Text>
        )}
        <View style={styles.headerUnderline} />
      </View>
      {topUpset && (
        <View style={styles.upsetCallout}>
          <Text style={styles.upsetLabel}>UPSET OF THE NIGHT</Text>
          <View style={styles.upsetRow}>
            <ExpoImage source={{ uri: getTeamLogoUrl(topUpset.awayAbbrev) }} style={styles.upsetLogo} contentFit="contain" />
            <Text style={[styles.upsetScore, topUpset.awayScore > topUpset.homeScore && styles.scoreWin]}>
              {topUpset.awayScore}
            </Text>
            <Text style={styles.scoreSep}>·</Text>
            <Text style={[styles.upsetScore, topUpset.homeScore > topUpset.awayScore && styles.scoreWin]}>
              {topUpset.homeScore}
            </Text>
            <ExpoImage source={{ uri: getTeamLogoUrl(topUpset.homeAbbrev) }} style={styles.upsetLogo} contentFit="contain" />
            {topUpset.homeWinProb !== null && (
              <Text style={styles.upsetMeta}>
                Model gave {Math.round(
                  (topUpset.awayScore > topUpset.homeScore ? 1 - topUpset.homeWinProb : topUpset.homeWinProb) * 100,
                )}%
              </Text>
            )}
          </View>
        </View>
      )}
      <View style={styles.list}>
        {summary.games.slice(0, 6).map((r) => (
          <Pressable
            key={r.id}
            onPress={() => onPressGame(r.id)}
            style={({ pressed }) => [styles.yesterdayRow, pressed && styles.rowPressed]}
          >
            <View style={styles.yesterdayMatchup}>
              <ExpoImage source={{ uri: getTeamLogoUrl(r.awayAbbrev) }} style={styles.smallLogo} contentFit="contain" />
              <Text style={[styles.score, r.awayScore > r.homeScore && styles.scoreWin]}>{r.awayScore}</Text>
              <Text style={styles.scoreSep}>·</Text>
              <Text style={[styles.score, r.homeScore > r.awayScore && styles.scoreWin]}>{r.homeScore}</Text>
              <ExpoImage source={{ uri: getTeamLogoUrl(r.homeAbbrev) }} style={styles.smallLogo} contentFit="contain" />
            </View>
            <View style={styles.yesterdayTags}>
              {r.isOvertime && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>OT</Text>
                </View>
              )}
              {r.isUpset && (
                <View style={[styles.tag, styles.tagUpset]}>
                  <Text style={[styles.tagText, styles.tagUpsetText]}>UPSET</Text>
                </View>
              )}
              {r.modelHit !== null && (
                <Text style={[styles.predNote, r.modelHit ? styles.predHit : styles.predMiss]}>
                  {r.modelHit ? '✓' : '✗'}
                </Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* =====================================================
   Off-day fallback — next slate + leaders + standings race
   ===================================================== */
function StandingsRaceSection({ standings }: { standings: any[] }) {
  const races = useMemo(() => {
    if (!Array.isArray(standings) || !standings.length) return [];
    const byDivision: Record<string, any[]> = {};
    for (const s of standings) {
      const div = s.divisionName ?? 'Unknown';
      if (!byDivision[div]) byDivision[div] = [];
      byDivision[div].push(s);
    }
    return Object.entries(byDivision).map(([name, teams]) => {
      const sorted = [...teams].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
      const leader = sorted[0];
      const second = sorted[1];
      const third = sorted[2];
      const gap1 = leader && second ? (leader.points ?? 0) - (second.points ?? 0) : 0;
      const gap2 = second && third ? (second.points ?? 0) - (third.points ?? 0) : 0;
      const tightness = gap1 + gap2;
      return { name, leader, second, third, tightness };
    })
    .filter((d) => d.leader && d.second)
    .sort((a, b) => a.tightness - b.tightness)
    .slice(0, 2);
  }, [standings]);

  if (!races.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLabel}>DIVISION RACE</Text>
        </View>
        <Text style={styles.headerHint}>Tightest top 3</Text>
        <View style={styles.headerUnderline} />
      </View>
      <View style={styles.list}>
        {races.map((r) => (
          <View key={r.name} style={styles.raceRow}>
            <Text style={styles.raceDivision}>{r.name.toUpperCase()}</Text>
            <View style={styles.raceTeams}>
              {[r.leader, r.second, r.third].filter(Boolean).map((t: any, idx: number) => {
                const ab = typeof t.teamAbbrev === 'string' ? t.teamAbbrev : t.teamAbbrev?.default;
                return (
                  <View key={ab ?? idx} style={styles.raceTeam}>
                    <Text style={styles.raceRank}>{idx + 1}</Text>
                    <ExpoImage source={{ uri: getTeamLogoUrl(ab) }} style={styles.raceLogo} contentFit="contain" />
                    <Text style={styles.raceAbbrev}>{ab}</Text>
                    <Text style={styles.racePts}>{t.points ?? 0}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function LeadersSection({ onPressPlayer }: { onPressPlayer: (id: number) => void }) {
  const [scoring, setScoring] = useState<SkaterLeader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getLeagueLeaders('points', null, null, 5)
      .then((data) => {
        if (!cancelled) {
          setScoring(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScoring([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerLabel}>SCORING LEADERS</Text>
          </View>
          <View style={styles.headerUnderline} />
        </View>
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.leaderRow, styles.skeleton]} />
          ))}
        </View>
      </View>
    );
  }
  if (!scoring.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLabel}>SCORING LEADERS</Text>
        </View>
        <Text style={styles.headerHint}>Season points</Text>
        <View style={styles.headerUnderline} />
      </View>
      <View style={styles.list}>
        {scoring.map((p, i) => (
          <Pressable
            key={p.playerId}
            onPress={() => onPressPlayer(p.playerId)}
            style={({ pressed }) => [styles.leaderRow, pressed && styles.rowPressed]}
          >
            <Text style={styles.leaderRank}>{i + 1}</Text>
            <ExpoImage source={{ uri: getTeamLogoUrl(p.teamAbbrev) }} style={styles.leaderLogo} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.leaderName}>{p.firstName?.[0]}. {p.lastName}</Text>
              <Text style={styles.leaderSubline}>
                {p.teamAbbrev} · {p.position ?? ''} · {p.gamesPlayed} GP
              </Text>
            </View>
            <View style={styles.leaderStats}>
              <Text style={styles.leaderValue}>{p.points}</Text>
              <Text style={styles.leaderLabel}>{p.goals}G {p.assists}A</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function NextSlatePreview({
  gamesByDate,
  predictionsMap,
  onPressGame,
}: {
  gamesByDate: Array<{ date: string; label: string; games: Game[] }>;
  predictionsMap?: Map<string, { homeWinProb: number; awayWinProb: number }>;
  onPressGame: (gameId: number) => void;
}) {
  const next = gamesByDate?.[0];
  if (!next || !next.games?.length) return null;
  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLabel}>NEXT SLATE</Text>
          <Text style={styles.headerCount}>{next.games.length}</Text>
        </View>
        <Text style={styles.headerHint}>{next.label}</Text>
        <View style={styles.headerUnderline} />
      </View>
      <View style={styles.list}>
        {next.games.slice(0, 4).map((g) => {
          const home = g.homeTeam?.abbrev ?? '';
          const away = g.awayTeam?.abbrev ?? '';
          const fb = predictionsMap?.get(`${home}-${away}`) ?? predictionsMap?.get(`${away}-${home}`);
          return (
            <Pressable
              key={g.id}
              onPress={() => onPressGame(g.id)}
              style={({ pressed }) => [styles.slateRow, pressed && styles.rowPressed]}
            >
              <View style={styles.slateMatchup}>
                <ExpoImage source={{ uri: getTeamLogoUrl(away) }} style={styles.slateLogo} contentFit="contain" />
                <Text style={styles.slateAbbrev}>{away}</Text>
                <Text style={styles.slateAt}>@</Text>
                <Text style={styles.slateAbbrev}>{home}</Text>
                <ExpoImage source={{ uri: getTeamLogoUrl(home) }} style={styles.slateLogo} contentFit="contain" />
              </View>
              <View style={styles.slateRight}>
                {fb ? (
                  <Text style={styles.slatePreviewProb}>
                    {Math.round((fb.homeWinProb >= 0.5 ? fb.homeWinProb : fb.awayWinProb) * 100)}%
                  </Text>
                ) : (
                  <Text style={styles.slateTime}>{formatGameTime(g.startTimeUTC)}</Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* =====================================================
   Header strip — last updated + manual refresh
   ===================================================== */
function HeaderStrip({ lastFetchTime, onRefresh, refreshing }: { lastFetchTime?: Date | null; onRefresh?: () => void; refreshing?: boolean }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.statusStrip}>
      <Text style={styles.statusText}>
        Updated <Text style={styles.statusValue}>{formatRelativeMinutes(lastFetchTime)}</Text>
      </Text>
      {onRefresh && (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onRefresh();
          }}
          hitSlop={8}
          disabled={refreshing}
        >
          <Text style={[styles.statusRefresh, refreshing && { opacity: 0.4 }]}>
            {refreshing ? 'REFRESHING...' : 'REFRESH'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/* =====================================================
   Main component
   ===================================================== */
export default function LeagueBriefing({
  todaysGames,
  currentStandings,
  isLoading,
  hasGamesToday,
  isShowingUpcoming,
  gamesByDate,
  predictionsMap,
  formMap,
  restMap,
  edgeTeamLanding,
  lastFetchTime,
  onRefresh,
}: LeagueBriefingProps) {
  const router = useRouter();
  const [predictions, setPredictions] = useState<Record<number, MLPrediction>>({});
  const [yesterdaySummary, setYesterdaySummary] = useState<YesterdaySummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const games = todaysGames?.games ?? [];
  const standings = currentStandings?.standings ?? [];
  const liveGames = useMemo(() => games.filter(isLiveGame), [games]);
  const hasSlate = (hasGamesToday ?? games.length > 0) && games.length > 0 && !isShowingUpcoming;

  // Cache predictions across remounts within the component lifetime.
  useEffect(() => {
    if (!games.length) return;
    const today = dateString(new Date());
    let cancelled = false;
    getMLPredictions(today)
      .then((p) => {
        if (!cancelled) setPredictions(p);
      })
      .catch(() => {
        if (!cancelled) setPredictions({});
      });
    return () => {
      cancelled = true;
    };
  }, [games.length]);

  // Lift yesterday fetch up so BriefingHero can pick the biggest upset.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const yesterday = getYesterdayString();
        const { data: gms } = await supabase
          .from('games')
          .select('id, home_team_abbrev, away_team_abbrev, home_score, away_score, game_state, period_type')
          .eq('game_date', yesterday)
          .in('game_state', ['OFF', 'FINAL']);
        if (cancelled || !gms?.length) {
          setYesterdaySummary({ games: [], modelWins: 0, modelLosses: 0, totalScored: 0 });
          return;
        }
        const preds = await getMLPredictions(yesterday);
        let modelWins = 0;
        let modelLosses = 0;
        let totalScored = 0;
        const enriched: YesterdayGame[] = gms.map((g: any) => {
          const homeProb = preds[g.id]?.home_win_prob ?? null;
          const predictedWinner = preds[g.id]?.predicted_winner ?? null;
          const homeWon = (g.home_score ?? 0) > (g.away_score ?? 0);
          const winner = homeWon ? g.home_team_abbrev : g.away_team_abbrev;
          let modelHit: boolean | null = null;
          if (predictedWinner) {
            modelHit = predictedWinner === winner;
            if (modelHit) modelWins++;
            else modelLosses++;
          }
          const isUpset =
            homeProb !== null && ((homeWon && homeProb < 0.4) || (!homeWon && homeProb > 0.6));
          totalScored += (g.home_score ?? 0) + (g.away_score ?? 0);
          return {
            id: g.id,
            homeAbbrev: g.home_team_abbrev,
            awayAbbrev: g.away_team_abbrev,
            homeScore: g.home_score ?? 0,
            awayScore: g.away_score ?? 0,
            homeWinProb: homeProb,
            predictedWinner,
            isUpset,
            isOvertime: g.period_type === 'OT' || g.period_type === 'SO',
            modelHit,
          };
        });
        enriched.sort((a, b) => {
          if (a.isUpset !== b.isUpset) return a.isUpset ? -1 : 1;
          if (a.isOvertime !== b.isOvertime) return a.isOvertime ? -1 : 1;
          return 0;
        });
        if (!cancelled) setYesterdaySummary({ games: enriched, modelWins, modelLosses, totalScored });
      } catch {
        if (!cancelled) setYesterdaySummary({ games: [], modelWins: 0, modelLosses: 0, totalScored: 0 });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const heroUpsets = useMemo(() => {
    if (!yesterdaySummary?.games?.length) return [] as Array<{
      id: number;
      homeAbbrev: string;
      awayAbbrev: string;
      homeScore: number;
      awayScore: number;
      homeWinProb: number;
      predictedWinner: string;
    }>;
    return yesterdaySummary.games
      .filter((g) => g.isUpset && g.homeWinProb !== null && g.predictedWinner)
      .map((g) => ({
        id: g.id,
        homeAbbrev: g.homeAbbrev,
        awayAbbrev: g.awayAbbrev,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        homeWinProb: g.homeWinProb!,
        predictedWinner: g.predictedWinner!,
      }));
  }, [yesterdaySummary]);

  // Auto-refresh predictions on a tick when there's a live game.
  useEffect(() => {
    if (!liveGames.length) return;
    const id = setInterval(() => {
      if (onRefresh) onRefresh();
      const today = dateString(new Date());
      getMLPredictions(today)
        .then(setPredictions)
        .catch(() => {});
    }, REFRESH_LIVE_MS);
    return () => clearInterval(id);
  }, [liveGames.length, onRefresh]);

  const handleRefresh = useCallback(() => {
    if (!onRefresh) return;
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 1500);
  }, [onRefresh]);

  const onPressGame = useCallback(
    (gameId: number) => {
      Haptics.selectionAsync().catch(() => {});
      router.push(`/stats?game=${gameId}` as any);
    },
    [router],
  );

  const onPressTeam = useCallback(
    (abbrev: string) => {
      Haptics.selectionAsync().catch(() => {});
      router.push(`/teams?team=${abbrev}` as any);
    },
    [router],
  );

  const onPressPlayer = useCallback(
    (playerId: number) => {
      Haptics.selectionAsync().catch(() => {});
      router.push(`/players?player=${playerId}` as any);
    },
    [router],
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <HeaderStrip lastFetchTime={lastFetchTime} />
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.section}>
            <View style={styles.headerRow}>
              <View style={[styles.skeletonLine, { width: 120 }]} />
              <View style={styles.headerUnderline} />
            </View>
            <View style={styles.list}>
              {[0, 1, 2].map((j) => (
                <View key={j} style={[styles.slateRow, styles.skeleton]} />
              ))}
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.container}>
      {/* Hero card — the lead story of the day */}
      <BriefingHero
        games={games}
        predictions={predictions}
        standings={standings}
        yesterdayUpsets={heroUpsets}
        formMap={formMap}
      />

      {/* Heat strip — every game tonight as a colored bar (signature moment) */}
      {hasSlate && (
        <HeatStrip
          games={games}
          predictions={predictions}
          predictionsMap={predictionsMap}
          onPressGame={onPressGame}
        />
      )}

      <HeaderStrip lastFetchTime={lastFetchTime} onRefresh={handleRefresh} refreshing={refreshing} />

      {liveGames.length > 0 && <LiveRibbon games={liveGames} onPress={onPressGame} />}

      {hasSlate ? (
        <>
          <SlateSection
            games={games.filter((g) => !isLiveGame(g))}
            predictions={predictions}
            predictionsMap={predictionsMap}
            restMap={restMap}
            formMap={formMap}
            standings={standings}
            onPressGame={onPressGame}
          />
          <MismatchSection
            games={games}
            standings={standings}
            edgeTeamLanding={edgeTeamLanding}
            onPressGame={onPressGame}
          />
        </>
      ) : (
        <>
          <View style={styles.offDayBanner}>
            <Text style={styles.offDayLabel}>NO GAMES TODAY</Text>
            <Text style={styles.offDayHint}>Briefing carries forward · season-long signal below</Text>
          </View>
          {gamesByDate && gamesByDate.length > 0 && (
            <NextSlatePreview gamesByDate={gamesByDate} predictionsMap={predictionsMap} onPressGame={onPressGame} />
          )}
          <LeadersSection onPressPlayer={onPressPlayer} />
          <StandingsRaceSection standings={standings} />
        </>
      )}

      <WatchlistSection standings={standings} formMap={formMap} onPressTeam={onPressTeam} />
      <YesterdaySection onPressGame={onPressGame} />
    </Animated.View>
  );
}

/* =====================================================
   Styles
   ===================================================== */
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
  },
  section: {
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: 4,
    position: 'relative',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    letterSpacing: 1.5,
  },
  headerCount: {
    fontSize: 11,
    color: rinkGlass.textMuted,
    fontFamily: rinkGlass.fonts.mono,
  },
  headerHint: {
    fontSize: 10,
    color: rinkGlass.textMuted,
    letterSpacing: 0.5,
  },
  headerUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 24,
    height: 2,
    backgroundColor: rinkGlass.blueLight,
    borderRadius: 1,
  },
  list: {
    gap: 6,
  },
  // Status strip
  statusStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: -8,
  },
  statusText: {
    fontSize: 10,
    color: rinkGlass.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statusValue: {
    color: rinkGlass.textSecondary,
    fontFamily: rinkGlass.fonts.mono,
  },
  statusRefresh: {
    fontSize: 10,
    fontWeight: '700',
    color: rinkGlass.blueLight,
    letterSpacing: 1,
  },
  // Live ribbon
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: rinkGlass.boards,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: rinkGlass.redLine,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  livePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: rinkGlass.redLine,
    marginRight: 4,
  },
  liveScore: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 22,
    color: rinkGlass.textPrimary,
    minWidth: 20,
    textAlign: 'center',
  },
  livePeriod: {
    fontSize: 11,
    color: rinkGlass.redLine,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: rinkGlass.fonts.mono,
  },
  // Slate
  slateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: rinkGlass.boards,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    flexWrap: 'wrap',
  },
  rowPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.99 }],
  },
  slateMatchup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  slateAbbrevCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  slateLogo: {
    width: 24,
    height: 24,
  },
  slateAbbrev: {
    fontSize: 13,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.mono,
    letterSpacing: 0.5,
  },
  b2bTag: {
    fontSize: 8,
    color: rinkGlass.powerPlay,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 1,
  },
  slateAt: {
    fontSize: 11,
    color: rinkGlass.textMuted,
    marginHorizontal: 2,
  },
  slateRight: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  slateProbBlock: {
    alignItems: 'flex-end',
  },
  slateRowBack: {
    backgroundColor: rinkGlass.zamboni,
  },
  flipHint: {
    fontSize: 9,
    color: rinkGlass.textMuted,
    fontFamily: rinkGlass.fonts.mono,
    letterSpacing: 1.5,
    marginTop: 6,
    width: '100%',
    textAlign: 'right',
    opacity: 0.6,
  },
  backHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    width: '100%',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: rinkGlass.glassBorder,
  },
  backTitle: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 18,
    color: rinkGlass.textPrimary,
    letterSpacing: 0.5,
  },
  backTitleMeta: {
    fontSize: 10,
    color: rinkGlass.blueLight,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  factorList: {
    width: '100%',
    paddingTop: 10,
    gap: 10,
  },
  factorListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  factorListLabel: {
    flex: 1.4,
    fontSize: 10,
    color: rinkGlass.textSecondary,
    fontFamily: rinkGlass.fonts.mono,
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  factorListBarTrack: {
    flex: 2,
    height: 6,
    borderRadius: 3,
    backgroundColor: rinkGlass.glassBorder,
    overflow: 'hidden',
  },
  factorListBarFill: {
    height: '100%',
    backgroundColor: rinkGlass.blueLight,
    borderRadius: 3,
  },
  factorListValue: {
    width: 50,
    fontSize: 12,
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.mono,
    fontWeight: '700',
    textAlign: 'right',
  },
  backNoData: {
    paddingTop: 14,
    fontSize: 12,
    color: rinkGlass.textMuted,
    letterSpacing: 1.5,
    textAlign: 'center',
    fontFamily: rinkGlass.fonts.mono,
  },
  backFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    width: '100%',
    marginTop: 'auto',
    paddingTop: 12,
  },
  backFooter: {
    fontSize: 9,
    color: rinkGlass.textMuted,
    letterSpacing: 1.5,
    fontFamily: rinkGlass.fonts.mono,
  },
  backFooterValue: {
    color: rinkGlass.blueLight,
    fontWeight: '800',
  },
  backFooterTap: {
    fontSize: 9,
    color: rinkGlass.blueLight,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  slateProbValue: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 30,
    color: rinkGlass.textPrimary,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  slateProbPercent: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 16,
    color: rinkGlass.textSecondary,
    marginLeft: 1,
  },
  slateProbLabel: {
    fontSize: 10,
    color: rinkGlass.textMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
  streakTiny: {
    fontSize: 8,
    fontWeight: '800',
    color: rinkGlass.textSecondary,
    letterSpacing: 0.5,
    fontFamily: rinkGlass.fonts.mono,
    marginTop: 1,
  },
  formsRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 8,
    justifyContent: 'space-between',
  },
  formCell: {
    gap: 3,
  },
  formLabel: {
    fontSize: 9,
    color: rinkGlass.textMuted,
    letterSpacing: 1,
    fontFamily: rinkGlass.fonts.mono,
  },
  formLabelRight: {
    fontSize: 9,
    color: rinkGlass.textMuted,
    letterSpacing: 1,
    textAlign: 'right',
    fontFamily: rinkGlass.fonts.mono,
  },
  slatePreviewProb: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 16,
    color: rinkGlass.textSecondary,
  },
  slateTime: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
    fontFamily: rinkGlass.fonts.mono,
  },
  slateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    paddingTop: 6,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: rinkGlass.glassBorder,
  },
  slateMetaText: {
    fontSize: 10,
    color: rinkGlass.textMuted,
    letterSpacing: 1,
  },
  slateMetaValue: {
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.mono,
    fontWeight: '700',
  },
  anomalyBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(76, 201, 240, 0.15)',
    borderColor: rinkGlass.blueLight,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  anomalyText: {
    fontSize: 9,
    fontWeight: '800',
    color: rinkGlass.blueLight,
    letterSpacing: 1,
  },
  factorLine: {
    width: '100%',
    fontSize: 10,
    color: rinkGlass.textSecondary,
    fontFamily: rinkGlass.fonts.mono,
    letterSpacing: 0.3,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: rinkGlass.glassBorder,
  },
  // Mismatch
  mismatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: rinkGlass.boards,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    gap: 12,
  },
  mismatchLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mismatchLogo: {
    width: 28,
    height: 28,
  },
  mismatchTeams: {
    flex: 1,
  },
  mismatchFavored: {
    fontSize: 14,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.mono,
  },
  mismatchVs: {
    fontSize: 11,
    color: rinkGlass.textMuted,
    marginTop: 1,
  },
  mismatchStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statBlock: {
    alignItems: 'flex-end',
    minWidth: 50,
  },
  statValue: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 16,
    color: rinkGlass.textPrimary,
  },
  gapValue: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 16,
    color: rinkGlass.blueLight,
  },
  statLabel: {
    fontSize: 9,
    color: rinkGlass.textMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
  // Watchlist
  watchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: rinkGlass.boards,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    gap: 10,
  },
  watchLogo: {
    width: 28,
    height: 28,
  },
  watchInfo: {
    flex: 1,
  },
  watchHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  watchAbbrev: {
    fontSize: 14,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.mono,
  },
  streakChip: {
    fontSize: 9,
    color: rinkGlass.textSecondary,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: rinkGlass.fonts.mono,
  },
  watchSubline: {
    fontSize: 11,
    color: rinkGlass.textMuted,
    marginTop: 1,
  },
  sparklineRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
    height: 8,
  },
  sparkBar: {
    width: 6,
    height: 8,
    backgroundColor: rinkGlass.textMuted,
    borderRadius: 1,
  },
  luckTag: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  luckOver: {
    backgroundColor: 'rgba(6, 214, 160, 0.10)',
    borderColor: 'rgba(6, 214, 160, 0.4)',
  },
  luckUnder: {
    backgroundColor: 'rgba(230, 57, 70, 0.10)',
    borderColor: 'rgba(230, 57, 70, 0.4)',
  },
  luckText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  luckOverText: {
    color: rinkGlass.faceoffDot,
  },
  luckUnderText: {
    color: rinkGlass.redLine,
  },
  luckValue: {
    fontSize: 11,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.mono,
  },
  // Yesterday
  upsetCallout: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: rinkGlass.boards,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: rinkGlass.powerPlay,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    gap: 6,
  },
  upsetLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: rinkGlass.powerPlay,
    letterSpacing: 1.5,
  },
  upsetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  upsetLogo: {
    width: 26,
    height: 26,
  },
  upsetScore: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 22,
    color: rinkGlass.textSecondary,
    minWidth: 24,
    textAlign: 'center',
  },
  upsetMeta: {
    fontSize: 10,
    color: rinkGlass.textMuted,
    fontFamily: rinkGlass.fonts.mono,
    marginLeft: 'auto',
  },
  yesterdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: rinkGlass.boards,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    gap: 10,
  },
  yesterdayMatchup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallLogo: {
    width: 22,
    height: 22,
  },
  score: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 18,
    color: rinkGlass.textSecondary,
    minWidth: 22,
    textAlign: 'center',
  },
  scoreWin: {
    color: rinkGlass.textPrimary,
  },
  scoreSep: {
    color: rinkGlass.textMuted,
    fontSize: 12,
  },
  yesterdayTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '800',
    color: rinkGlass.textSecondary,
    letterSpacing: 1,
  },
  tagUpset: {
    backgroundColor: 'rgba(255, 214, 10, 0.10)',
    borderColor: 'rgba(255, 214, 10, 0.4)',
  },
  tagUpsetText: {
    color: rinkGlass.powerPlay,
  },
  predNote: {
    fontSize: 12,
    fontFamily: rinkGlass.fonts.mono,
    fontWeight: '800',
  },
  predHit: {
    color: rinkGlass.faceoffDot,
  },
  predMiss: {
    color: rinkGlass.redLine,
  },
  // Off-day
  offDayBanner: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: rinkGlass.boards,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: rinkGlass.blueLight,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    gap: 4,
  },
  offDayLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: rinkGlass.textPrimary,
    letterSpacing: 1.5,
  },
  offDayHint: {
    fontSize: 11,
    color: rinkGlass.textMuted,
  },
  // Race
  raceRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: rinkGlass.boards,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    gap: 8,
  },
  raceDivision: {
    fontSize: 10,
    fontWeight: '800',
    color: rinkGlass.textSecondary,
    letterSpacing: 1.5,
  },
  raceTeams: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  raceTeam: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  raceRank: {
    fontSize: 10,
    color: rinkGlass.textMuted,
    fontFamily: rinkGlass.fonts.mono,
    width: 10,
  },
  raceLogo: {
    width: 18,
    height: 18,
  },
  raceAbbrev: {
    fontSize: 11,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.mono,
  },
  racePts: {
    fontSize: 13,
    fontFamily: rinkGlass.fonts.display,
    color: rinkGlass.blueLight,
    marginLeft: 'auto',
  },
  // Leaders
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: rinkGlass.boards,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    gap: 10,
    minHeight: 56,
  },
  leaderRank: {
    fontSize: 13,
    color: rinkGlass.textMuted,
    fontFamily: rinkGlass.fonts.mono,
    width: 16,
    textAlign: 'center',
  },
  leaderLogo: {
    width: 24,
    height: 24,
  },
  leaderName: {
    fontSize: 14,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.display,
  },
  leaderSubline: {
    fontSize: 10,
    color: rinkGlass.textMuted,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  leaderStats: {
    alignItems: 'flex-end',
  },
  leaderValue: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 18,
    color: rinkGlass.textPrimary,
  },
  leaderLabel: {
    fontSize: 9,
    color: rinkGlass.textMuted,
    letterSpacing: 0.5,
    marginTop: 1,
    fontFamily: rinkGlass.fonts.mono,
  },
  // Skeletons
  skeleton: {
    backgroundColor: rinkGlass.boards,
    opacity: 0.4,
    minHeight: 56,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: rinkGlass.boards,
    opacity: 0.6,
    borderRadius: 4,
  },
});
