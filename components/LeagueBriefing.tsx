/**
 * LeagueBriefing — the Today screen's replacement for the fantasy DashboardContainer.
 *
 * Stat-Sheet vision: a daily league briefing for the hockey enthusiast.
 * Stacks four sections that surface "things an ML model would notice that an
 * average fan wouldn't":
 *   1. Tonight's Slate — every game with model probability + spread + total,
 *      anomaly flag where the model and Vegas-style line disagree sharply.
 *   2. Mismatches — top games where one team is significantly outclassed in a
 *      measurable factor (xGF/60, save%, special teams, etc).
 *   3. Watchlist — teams with notable trend deltas vs season baseline.
 *   4. Yesterday in Numbers — what last night's results revealed, in stats.
 *
 * No narrative copy. No fantasy framing. Numbers do the work.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { rinkGlass } from '../constants/theme';
import { getTeamLogoUrl } from '../utils/teamLogo';
import { supabase } from '../lib/supabase';
import { getMLPredictions, type MLPrediction } from '../services/mlPredictions';

interface Game {
  id: number;
  homeTeam?: { abbrev: string; score?: number };
  awayTeam?: { abbrev: string; score?: number };
  startTimeUTC?: string;
  gameState?: string;
}

interface LeagueBriefingProps {
  todaysGames?: { games?: Game[] } | null;
  currentStandings?: { standings?: any[] } | null;
  isLoading?: boolean;
}

interface YesterdayGame {
  id: number;
  homeAbbrev: string;
  awayAbbrev: string;
  homeScore: number;
  awayScore: number;
  homeWinProb: number | null;
  isUpset: boolean;
  isOvertime: boolean;
}

function formatGameTime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* =====================================================
   SECTION 1: Tonight's Slate
   ===================================================== */
function SlateSection({ games, predictions }: { games: Game[]; predictions: Record<number, MLPrediction> }) {
  if (!games?.length) {
    return (
      <View style={styles.section}>
        <SectionHeader label="TONIGHT'S SLATE" />
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyLabel}>NO GAMES</Text>
          <Text style={styles.emptyHint}>League scheduled off today</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <SectionHeader label="TONIGHT'S SLATE" count={games.length} />
      <View style={styles.slateList}>
        {games.map((g) => {
          const home = g.homeTeam?.abbrev ?? '';
          const away = g.awayTeam?.abbrev ?? '';
          const pred = predictions[g.id];
          const homeProb = pred?.home_win_prob;
          const winner = pred?.predicted_winner;
          const spread = pred?.predicted_spread;
          const total = pred?.predicted_total;
          const conf = pred?.confidence;
          // Anomaly flag — the model leans hard one way (≥65% prob) AND it's an underdog by record.
          // Without Vegas lines we use confidence='high' as a proxy.
          const anomaly = conf === 'high' && homeProb !== null && homeProb !== undefined &&
                         (homeProb >= 0.65 || homeProb <= 0.35);

          return (
            <View key={g.id} style={styles.slateRow}>
              <View style={styles.slateMatchup}>
                <ExpoImage source={{ uri: getTeamLogoUrl(away) }} style={styles.slateLogo} contentFit="contain" />
                <Text style={styles.slateAbbrev}>{away}</Text>
                <Text style={styles.slateAt}>@</Text>
                <ExpoImage source={{ uri: getTeamLogoUrl(home) }} style={styles.slateLogo} contentFit="contain" />
                <Text style={styles.slateAbbrev}>{home}</Text>
              </View>
              <View style={styles.slateRight}>
                {homeProb !== null && homeProb !== undefined ? (
                  <View style={styles.slateProbBlock}>
                    <Text style={styles.slateProbValue}>
                      {Math.round(homeProb * 100)}%
                    </Text>
                    <Text style={styles.slateProbLabel}>{winner ?? home}</Text>
                  </View>
                ) : (
                  <Text style={styles.slateTime}>{formatGameTime(g.startTimeUTC)}</Text>
                )}
              </View>
              {(spread != null || total != null || anomaly) && (
                <View style={styles.slateMeta}>
                  {spread != null && (
                    <Text style={styles.slateMetaText}>
                      SPR <Text style={styles.slateMetaValue}>{spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1)}</Text>
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
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* =====================================================
   SECTION 2: Mismatches — biggest factor gaps tonight
   ===================================================== */
function MismatchSection({
  games,
  standings,
  predictions,
}: {
  games: Game[];
  standings: any[];
  predictions: Record<number, MLPrediction>;
}) {
  // Compute per-game GF/GP and GA/GP gaps from standings.
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
        // Combined "outscoring potential" — home offense vs away defense, vice versa.
        const homeAdvantage = homeGFPerGP + awayGAPerGP;
        const awayAdvantage = awayGFPerGP + homeGAPerGP;
        const gap = Math.abs(homeAdvantage - awayAdvantage);
        return {
          game: g,
          home,
          away,
          homeAdvantage,
          awayAdvantage,
          gap,
          favored: homeAdvantage > awayAdvantage ? home : away,
          favoredGF: homeAdvantage > awayAdvantage ? homeGFPerGP : awayGFPerGP,
          underdogGA: homeAdvantage > awayAdvantage ? awayGAPerGP : homeGAPerGP,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 3);
  }, [games, standingByAbbrev]);

  if (!mismatches.length) return null;

  return (
    <View style={styles.section}>
      <SectionHeader label="MISMATCHES" hint="Goal-pace gap" />
      <View style={styles.list}>
        {mismatches.map((m) => (
          <View key={m.game.id} style={styles.mismatchRow}>
            <View style={styles.mismatchLeft}>
              <ExpoImage source={{ uri: getTeamLogoUrl(m.favored) }} style={styles.mismatchLogo} contentFit="contain" />
              <View style={styles.mismatchTeams}>
                <Text style={styles.mismatchFavored}>{m.favored}</Text>
                <Text style={styles.mismatchVs}>vs {m.favored === m.home ? m.away : m.home}</Text>
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
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/* =====================================================
   SECTION 3: Watchlist — PDO-style outliers across the league
   ===================================================== */
function WatchlistSection({ standings }: { standings: any[] }) {
  const watchlist = useMemo(() => {
    if (!Array.isArray(standings) || !standings.length) return [];
    return standings
      .map((s) => {
        const abbrev = typeof s.teamAbbrev === 'string' ? s.teamAbbrev : s.teamAbbrev?.default;
        const gp = (s.gamesPlayed ?? 0) || 1;
        const wins = s.wins ?? 0;
        const points = s.points ?? 0;
        const goalsFor = s.goalFor ?? 0;
        const goalsAgainst = s.goalAgainst ?? 1;
        // Goal differential per game — proxy for underlying strength.
        const diffPerGP = (goalsFor - goalsAgainst) / gp;
        // Win % outpacing or trailing what goal differential suggests.
        const winPct = wins / gp;
        const expectedWinPct = 0.5 + diffPerGP * 0.06; // rough linear fit
        const luck = winPct - expectedWinPct; // positive = winning more than diff suggests
        return { abbrev, points, wins, gp, diffPerGP, winPct, luck };
      })
      .filter((s) => s.abbrev && s.gp >= 10)
      .sort((a, b) => Math.abs(b.luck) - Math.abs(a.luck))
      .slice(0, 5);
  }, [standings]);

  if (!watchlist.length) return null;

  return (
    <View style={styles.section}>
      <SectionHeader label="WATCHLIST" hint="Win % vs goal differential" />
      <View style={styles.list}>
        {watchlist.map((w) => {
          const overperforming = w.luck > 0;
          return (
            <View key={w.abbrev} style={styles.watchRow}>
              <ExpoImage source={{ uri: getTeamLogoUrl(w.abbrev!) }} style={styles.watchLogo} contentFit="contain" />
              <View style={styles.watchInfo}>
                <Text style={styles.watchAbbrev}>{w.abbrev}</Text>
                <Text style={styles.watchSubline}>
                  {w.diffPerGP >= 0 ? '+' : ''}{w.diffPerGP.toFixed(2)} G/GP · {Math.round(w.winPct * 100)}% W
                </Text>
              </View>
              <View style={[styles.luckTag, overperforming ? styles.luckOver : styles.luckUnder]}>
                <Text style={[styles.luckText, overperforming ? styles.luckOverText : styles.luckUnderText]}>
                  {overperforming ? 'OVER' : 'UNDER'}
                </Text>
                <Text style={styles.luckValue}>
                  {w.luck >= 0 ? '+' : ''}{Math.round(w.luck * 100)}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* =====================================================
   SECTION 4: Yesterday — what last night's results revealed
   ===================================================== */
function YesterdaySection() {
  const [results, setResults] = useState<YesterdayGame[]>([]);
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
          setResults([]);
          setLoading(false);
          return;
        }

        const preds = await getMLPredictions(yesterday);
        const enriched: YesterdayGame[] = games.map((g: any) => {
          const homeProb = preds[g.id]?.home_win_prob ?? null;
          const homeWon = (g.home_score ?? 0) > (g.away_score ?? 0);
          const isUpset = homeProb !== null && (
            (homeWon && homeProb < 0.4) || (!homeWon && homeProb > 0.6)
          );
          return {
            id: g.id,
            homeAbbrev: g.home_team_abbrev,
            awayAbbrev: g.away_team_abbrev,
            homeScore: g.home_score ?? 0,
            awayScore: g.away_score ?? 0,
            homeWinProb: homeProb,
            isUpset,
            isOvertime: g.period_type === 'OT' || g.period_type === 'SO',
          };
        });

        // Lead with upsets, then OT/SO, then the rest. Cap at 5.
        enriched.sort((a, b) => {
          if (a.isUpset !== b.isUpset) return a.isUpset ? -1 : 1;
          if (a.isOvertime !== b.isOvertime) return a.isOvertime ? -1 : 1;
          return 0;
        });
        if (!cancelled) {
          setResults(enriched.slice(0, 5));
          setLoading(false);
        }
      } catch (err) {
        console.warn('[LeagueBriefing] yesterday load failed', err);
        if (!cancelled) {
          setResults([]);
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
        <SectionHeader label="YESTERDAY" />
        <ActivityIndicator size="small" color={rinkGlass.textMuted} style={{ marginTop: 8 }} />
      </View>
    );
  }
  if (!results.length) return null;

  return (
    <View style={styles.section}>
      <SectionHeader label="YESTERDAY" count={results.length} />
      <View style={styles.list}>
        {results.map((r) => (
          <View key={r.id} style={styles.yesterdayRow}>
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
              {r.homeWinProb !== null && (
                <Text style={styles.predNote}>
                  Model: {Math.round((r.awayScore > r.homeScore ? 1 - r.homeWinProb : r.homeWinProb) * 100)}%
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/* =====================================================
   Section header — uniform across all four blocks
   ===================================================== */
function SectionHeader({ label, count, hint }: { label: string; count?: number; hint?: string }) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerLabel}>{label}</Text>
        {count != null && <Text style={styles.headerCount}>{count}</Text>}
      </View>
      {hint && <Text style={styles.headerHint}>{hint}</Text>}
      <View style={styles.headerUnderline} />
    </View>
  );
}

/* =====================================================
   Main component
   ===================================================== */
export default function LeagueBriefing({ todaysGames, currentStandings, isLoading }: LeagueBriefingProps) {
  const [predictions, setPredictions] = useState<Record<number, MLPrediction>>({});
  const games = todaysGames?.games ?? [];
  const standings = currentStandings?.standings ?? [];

  useEffect(() => {
    if (!games.length) return;
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    getMLPredictions(dateStr).then(setPredictions).catch(() => setPredictions({}));
  }, [games.length]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={rinkGlass.textMuted} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SlateSection games={games} predictions={predictions} />
      <MismatchSection games={games} standings={standings} predictions={predictions} />
      <WatchlistSection standings={standings} />
      <YesterdaySection />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 24,
  },
  loading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  section: {
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: 6,
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
    gap: 8,
  },
  emptyBlock: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 4,
  },
  emptyLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: rinkGlass.textSecondary,
    letterSpacing: 1,
  },
  emptyHint: {
    fontSize: 11,
    color: rinkGlass.textMuted,
  },
  // Slate
  slateList: {
    gap: 8,
  },
  slateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: rinkGlass.boards,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    flexWrap: 'wrap',
  },
  slateMatchup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
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
  slateProbValue: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 22,
    color: rinkGlass.textPrimary,
    lineHeight: 24,
  },
  slateProbLabel: {
    fontSize: 10,
    color: rinkGlass.textMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
  slateTime: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
    fontFamily: rinkGlass.fonts.mono,
  },
  slateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingTop: 8,
    marginTop: 8,
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
    minWidth: 56,
  },
  statValue: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 16,
    color: rinkGlass.textPrimary,
  },
  statLabel: {
    fontSize: 9,
    color: rinkGlass.textMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
  // Watch
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
  watchAbbrev: {
    fontSize: 14,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.mono,
  },
  watchSubline: {
    fontSize: 11,
    color: rinkGlass.textMuted,
    marginTop: 1,
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
    fontSize: 10,
    color: rinkGlass.textMuted,
    fontFamily: rinkGlass.fonts.mono,
  },
});
