/**
 * useTonightData Hook
 * Extracted from app/(tabs)/index.tsx — owns all state, data fetching,
 * predictions, derived stats, insights, and model management for the Tonight screen.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Share } from 'react-native';
import { useAnalytics } from './useAnalytics';
import { calculateWinProbabilityEnhanced } from '../utils/predictionUtils';
import { getPlayerPredictionFactors } from '../services/playerPrediction';
import { getActiveModel, loadModels, setActiveModel as setActiveModelStorage } from '../services/modelStorage';
import { generateInsights } from '../services/insightGenerator';
import { getTeamPlayerStats } from '../services/playerStats';
import logger from '../utils/logger';
import { supabase } from '../lib/supabase';
import type { PlayerPredictionFactors, PredictionModel } from '../types/predictions';
import type { Insight } from '../types/insights';
import type { TeamPlayerStats } from '../types/gameResults';
import { getH2HForGames, fetchGameResults } from '../services/gameResults';
import type { H2HRecord } from '../types/gameResults';
import { fetchEdgeSkaterLanding, fetchEdgeTeamLanding, fetchEdgeByTheNumbers } from '../services/edgeStats';
import { calculateMomentum, calculateClutchRating, calculateRestAdvantage } from '../services/derivedStats';
import type { MomentumData, ClutchRating, EdgeSkaterLanding, EdgeTeamLanding, EdgeByTheNumbers } from '../types/edgeStats';
import { generateTonightHeadline } from '../utils/headlineGenerator';
import { fetchTeamForm } from '../services/teamForm';
import type { TeamFormData } from '../types/teamForm';

// Helper: format a YYYY-MM-DD date string to a human-readable label
function formatDateLabel(dateStr: string, todayStr: string, tomorrowStr: string): string {
  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';
  const d = new Date(dateStr + 'T12:00:00'); // noon to avoid timezone issues
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

// Helper: get date string for today + N days
function getDateString(offsetDays: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Helper: find best insight for a specific game's teams
function getInsightForGame(game: any, insights: Insight[]): string | null {
  const homeAbbrev = game.homeTeam?.abbrev;
  const awayAbbrev = game.awayTeam?.abbrev;
  for (const insight of insights) {
    if (insight.teamAbbrev === homeAbbrev || insight.teamAbbrev === awayAbbrev) {
      return insight.text;
    }
  }
  return null;
}

/** A group of games for a single date */
export interface DateGroup {
  date: string;           // YYYY-MM-DD
  label: string;          // "Today", "Tomorrow", "Saturday, Feb 8"
  games: any[];
}

/** Return type of the useTonightData hook */
export interface TonightData {
  // Loading states
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => void;

  // Games
  todaysGames: any;
  gameCount: number;
  sortedGames: any[];
  heroGame: any;
  remainingGames: any[];

  // Upcoming / multi-day
  gamesByDate: DateGroup[];
  hasGamesToday: boolean;
  isShowingUpcoming: boolean;

  // Predictions
  predictionsMap: Map<string, { homeWinProb: number; awayWinProb: number }>;
  heroPrediction: { homeWinProb: number; awayWinProb: number };
  heroConfidence: number;
  heroH2H: H2HRecord | null;
  calculateWinProbability: (home: string, away: string, gameId?: string) => { homeWinProb: number; awayWinProb: number };

  // H2H & Insights
  h2hMap: Map<string, H2HRecord>;
  insights: Insight[];
  getInsightForGame: (game: any) => string | null;

  // Edge & Derived Stats
  edgeSkaterLanding: EdgeSkaterLanding | null;
  edgeTeamLanding: EdgeTeamLanding | null;
  edgeByTheNumbers: EdgeByTheNumbers | null;
  momentumMap: Map<string, MomentumData>;
  clutchMap: Map<string, ClutchRating>;
  restMap: Map<string, number>;

  // Player Stats
  playerStatsMap: Map<string, TeamPlayerStats>;

  // Team Form (sparklines)
  formMap: Map<string, TeamFormData>;

  // Model state
  activeModel: PredictionModel | null;
  allModels: PredictionModel[];
  showModelPicker: boolean;
  setShowModelPicker: (show: boolean) => void;
  handleModelSwitch: (modelId: string) => Promise<void>;
  toastMessage: string | null;

  // Headline
  tonightHeadline: string;

  // Share handlers
  handleShareHero: () => Promise<void>;

  // Standings (for deep dive modal)
  currentStandings: any;

  // Data freshness
  lastFetchTime: Date | null;

  // Analytics passthrough (for UI-level tracking)
  analytics: ReturnType<typeof useAnalytics>;
}

export function useTonightData(): TonightData {
  const analytics = useAnalytics('TonightScreen');

  // League data state
  const [todaysGames, setTodaysGames] = useState<any>(null);
  const [currentStandings, setCurrentStandings] = useState<any>(null);
  const [loadingLeagueData, setLoadingLeagueData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Predictions state
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [playerFactorsMap, setPlayerFactorsMap] = useState<Map<string, PlayerPredictionFactors>>(new Map());
  const [h2hMap, setH2hMap] = useState<Map<string, H2HRecord>>(new Map());
  const [playerStatsMap, setPlayerStatsMap] = useState<Map<string, TeamPlayerStats>>(new Map());

  // Model state
  const [activeModel, setActiveModel] = useState<PredictionModel | null>(null);
  const [allModels, setAllModels] = useState<PredictionModel[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Insights
  const [insights, setInsights] = useState<Insight[]>([]);

  // Edge data state
  const [edgeSkaterLanding, setEdgeSkaterLanding] = useState<EdgeSkaterLanding | null>(null);
  const [edgeTeamLanding, setEdgeTeamLanding] = useState<EdgeTeamLanding | null>(null);
  const [edgeByTheNumbers, setEdgeByTheNumbers] = useState<EdgeByTheNumbers | null>(null);
  const [momentumMap, setMomentumMap] = useState<Map<string, MomentumData>>(new Map());
  const [clutchMap, setClutchMap] = useState<Map<string, ClutchRating>>(new Map());
  const [restMap, setRestMap] = useState<Map<string, number>>(new Map());

  // Team form data (sparklines)
  const [formMap, setFormMap] = useState<Map<string, TeamFormData>>(new Map());

  // Data freshness tracking
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  // ============================================
  // Win probability calculator
  // ============================================
  const calculateWinProbability = useCallback(
    (homeTeamAbbrev: string, awayTeamAbbrev: string, gameId?: string) => {
      const playerFactors = gameId ? playerFactorsMap.get(gameId) : undefined;
      return calculateWinProbabilityEnhanced(homeTeamAbbrev, awayTeamAbbrev, currentStandings, playerFactors || null);
    },
    [currentStandings, playerFactorsMap],
  );

  // ============================================
  // Load NHL data (games, standings, edge landing)
  // ============================================
  const loadNHLData = useCallback(async (isRefresh = false) => {
    let mounted = true;
    if (isRefresh) setRefreshing(true);
    else setLoadingLeagueData(true);

    try {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      logger.log('[NHL Data] Fetching games for date:', todayStr);

      // --- Supabase-first: today's + tomorrow's games (2 days) ---
      let gamesData: any = null;
      let standingsData: any = null;
      let supabaseGamesOk = false;
      let supabaseStandingsOk = false;

      // Compute tomorrow's date string
      const tmrw = new Date();
      tmrw.setDate(tmrw.getDate() + 1);
      const tomorrowDateStr = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`;

      try {
        const [gamesResult, standingsResult] = await Promise.allSettled([
          supabase.from('games').select('*').eq('game_type', 2).gte('game_date', todayStr).lte('game_date', tomorrowDateStr).order('start_time_utc', { ascending: true }),
          supabase.from('standings').select('*').order('snapshot_date', { ascending: false }).limit(32),
        ]);

        // Transform Supabase games rows to NHL API shape
        if (gamesResult.status === 'fulfilled' && !gamesResult.value.error && gamesResult.value.data && gamesResult.value.data.length > 0) {
          const rows = gamesResult.value.data;
          gamesData = {
            games: rows.map((row: any) => ({
              id: row.id,
              season: row.season,
              gameType: row.game_type,
              gameDate: row.game_date,
              startTimeUTC: row.start_time_utc,
              venue: row.venue,
              gameState: row.game_state,
              gameScheduleState: row.game_schedule_state,
              homeTeam: {
                id: row.home_team_id,
                abbrev: row.home_team_abbrev,
                score: row.home_score,
                sog: row.home_sog,
              },
              awayTeam: {
                id: row.away_team_id,
                abbrev: row.away_team_abbrev,
                score: row.away_score,
                sog: row.away_sog,
              },
              period: row.period,
              periodType: row.period_type,
            })),
          };
          supabaseGamesOk = true;
          logger.info('[SUPABASE] Loaded', rows.length, 'games for', todayStr, 'to', tomorrowDateStr);
        } else {
          logger.warn('[SUPABASE] No games data for', todayStr, 'to', tomorrowDateStr, '— checking upcoming');
        }

        // Transform Supabase standings rows to NHL API shape
        if (standingsResult.status === 'fulfilled' && !standingsResult.value.error && standingsResult.value.data && standingsResult.value.data.length > 0) {
          const rows = standingsResult.value.data;
          standingsData = {
            standings: rows.map((row: any) => ({
              teamAbbrev: row.team_abbrev,
              teamLogo: row.logo_url,
              pointPctg: row.point_pctg,
              wins: row.wins,
              losses: row.losses,
              otLosses: row.ot_losses,
              points: row.points,
              goalFor: row.goals_for,
              goalAgainst: row.goals_against,
              gamesPlayed: row.games_played,
              streakCode: row.streak_code,
              streakCount: row.streak_count,
              divisionName: row.division,
              conferenceName: row.conference,
              regulationWins: row.regulation_wins,
              regulationPlusOtWins: row.regulation_plus_ot_wins,
              goalDifferential: row.goal_differential,
              l10Wins: row.l10_wins,
              l10Losses: row.l10_losses,
              l10OtLosses: row.l10_ot_losses,
              homeWins: row.home_wins,
              homeLosses: row.home_losses,
              homeOtLosses: row.home_ot_losses,
              roadWins: row.road_wins,
              roadLosses: row.road_losses,
              roadOtLosses: row.road_ot_losses,
            })),
          };
          supabaseStandingsOk = true;
          logger.info('[SUPABASE] Loaded', rows.length, 'standings rows');
        } else {
          logger.warn('[SUPABASE] No standings data — no data available');
        }
      } catch (supabaseErr) {
        logger.warn('[SUPABASE] Error querying games/standings, no data available', supabaseErr);
      }

      // --- Upcoming games: fetch next 2 days that have games ---
      // If today has games, today is day 1. Otherwise find the next date with games.
      // Then also fetch the following day's games (2 days total).
      if (!gamesData?.games?.length) {
        try {
          // Find the next date that has at least one game
          const nextDateResult = await supabase
            .from('games')
            .select('game_date')
            .eq('game_type', 2)
            .gte('game_date', todayStr)
            .order('game_date', { ascending: true })
            .limit(1);

          if (nextDateResult.data && nextDateResult.data.length > 0) {
            const firstDate = nextDateResult.data[0].game_date;
            // Compute the day after firstDate
            const firstDateObj = new Date(firstDate + 'T12:00:00');
            firstDateObj.setDate(firstDateObj.getDate() + 1);
            const secondDate = `${firstDateObj.getFullYear()}-${String(firstDateObj.getMonth() + 1).padStart(2, '0')}-${String(firstDateObj.getDate()).padStart(2, '0')}`;

            // Fetch games for both days, ordered by start time
            const upcomingResult = await supabase
              .from('games')
              .select('*')
              .eq('game_type', 2)
              .gte('game_date', firstDate)
              .lte('game_date', secondDate)
              .order('start_time_utc', { ascending: true });

            if (upcomingResult.data && upcomingResult.data.length > 0) {
              const rows = upcomingResult.data;
              gamesData = {
                games: rows.map((row: any) => ({
                  id: row.id,
                  season: row.season,
                  gameType: row.game_type,
                  gameDate: row.game_date,
                  startTimeUTC: row.start_time_utc,
                  venue: row.venue,
                  gameState: row.game_state,
                  gameScheduleState: row.game_schedule_state,
                  homeTeam: {
                    id: row.home_team_id,
                    abbrev: row.home_team_abbrev,
                    score: row.home_score,
                    sog: row.home_sog,
                  },
                  awayTeam: {
                    id: row.away_team_id,
                    abbrev: row.away_team_abbrev,
                    score: row.away_score,
                    sog: row.away_sog,
                  },
                  period: row.period,
                  periodType: row.period_type,
                })),
              };
              supabaseGamesOk = true;
              logger.info('[SUPABASE] No games today — loaded', rows.length, 'upcoming games for', firstDate, 'and', secondDate);
            }
          }
        } catch (upcomingErr) {
          logger.warn('[SUPABASE] Error fetching upcoming games:', upcomingErr);
        }
      }

      // Supabase-only: set games and standings from Supabase data
      if (mounted && gamesData) setTodaysGames(gamesData);
      if (mounted && standingsData) setCurrentStandings(standingsData);

      // Edge landing data (Supabase-only via edgeStats service)
      const [skaterLandingRes, teamLandingRes, byTheNumbersRes] = await Promise.allSettled([
        fetchEdgeSkaterLanding(),
        fetchEdgeTeamLanding(),
        fetchEdgeByTheNumbers(),
      ]);

      if (skaterLandingRes.status === 'fulfilled' && skaterLandingRes.value) {
        if (mounted) setEdgeSkaterLanding(skaterLandingRes.value);
      }
      if (teamLandingRes.status === 'fulfilled' && teamLandingRes.value) {
        if (mounted) setEdgeTeamLanding(teamLandingRes.value);
      }
      if (byTheNumbersRes.status === 'fulfilled' && byTheNumbersRes.value) {
        if (mounted) setEdgeByTheNumbers(byTheNumbersRes.value);
      }
      if (mounted) setLastFetchTime(new Date());
    } catch (e) {
      logger.warn('[NHL Data] Failed to load:', e);
    } finally {
      if (mounted) {
        setLoadingLeagueData(false);
        setRefreshing(false);
      }
    }

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    loadNHLData();
  }, []);

  const onRefresh = useCallback(() => {
    loadNHLData(true);
  }, [loadNHLData]);

  // ============================================
  // Model switching
  // ============================================
  const handleModelSwitch = useCallback(
    async (modelId: string) => {
      if (!modelId || modelId === activeModel?.id) {
        setShowModelPicker(false);
        return;
      }

      try {
        await setActiveModelStorage(modelId);
        const updatedModels = await loadModels();
        const newActiveModel = updatedModels.find((m) => m.id === modelId);

        if (newActiveModel) {
          setActiveModel(newActiveModel);
          setAllModels(updatedModels);
          setToastMessage(`Switched to ${newActiveModel.name}`);
          setTimeout(() => setToastMessage(null), 2500);

          analytics.trackCustomEvent('model_switched', {
            model_id: modelId,
            model_name: newActiveModel.name,
          });
        }
      } catch (error) {
        logger.error('[Model Switch] Error switching model:', error);
      } finally {
        setShowModelPicker(false);
      }
    },
    [activeModel, analytics],
  );

  // ============================================
  // Enhanced predictions + H2H + player stats
  // ============================================
  useEffect(() => {
    let mounted = true;

    async function loadEnhancedPredictions() {
      if (!todaysGames?.games || !currentStandings?.standings) {
        if (mounted) {
          setPlayerFactorsMap(new Map());
          setInsights([]);
        }
        return;
      }

      setLoadingPredictions(true);
      logger.log('[Enhanced Predictions] Loading with recent form, situational factors & player data...');

      try {
        const [model, models] = await Promise.all([getActiveModel(), loadModels()]);
        if (mounted) {
          setActiveModel(model);
          setAllModels(models);
        }

        // Fetch player factors for each game
        const factorsPromises = todaysGames.games.map(async (game: any) => {
          try {
            const homeAbbrev = game.homeTeam?.abbrev || '';
            const awayAbbrev = game.awayTeam?.abbrev || '';
            if (homeAbbrev && awayAbbrev) {
              const factors = await getPlayerPredictionFactors(homeAbbrev, awayAbbrev);
              return { gameId: String(game.id), factors };
            }
            return null;
          } catch {
            return null;
          }
        });

        const factorsResults = await Promise.all(factorsPromises);
        if (mounted) {
          const newFactorsMap = new Map<string, PlayerPredictionFactors>();
          for (const result of factorsResults) {
            if (result) newFactorsMap.set(result.gameId, result.factors);
          }
          setPlayerFactorsMap(newFactorsMap);
        }

        // Fetch H2H records for all games
        try {
          const h2hResults = await getH2HForGames(todaysGames.games);
          if (mounted) setH2hMap(h2hResults);
        } catch (h2hError) {
          logger.error('[H2H] Failed to fetch H2H records:', h2hError);
        }

        // Fetch player stats for insight generation
        try {
          const teamAbbrevs = new Set<string>();
          for (const game of todaysGames.games) {
            if (game.homeTeam?.abbrev) teamAbbrevs.add(game.homeTeam.abbrev);
            if (game.awayTeam?.abbrev) teamAbbrevs.add(game.awayTeam.abbrev);
          }
          const statsEntries = await Promise.allSettled(
            Array.from(teamAbbrevs).map(async (abbrev) => {
              const stats = await getTeamPlayerStats(abbrev);
              return [abbrev, stats] as const;
            }),
          );
          const newPlayerStatsMap = new Map<string, TeamPlayerStats>();
          for (const entry of statsEntries) {
            if (entry.status === 'fulfilled') {
              newPlayerStatsMap.set(entry.value[0], entry.value[1]);
            }
          }
          if (mounted) setPlayerStatsMap(newPlayerStatsMap);
        } catch {
          // Player stats for insights are optional
        }
      } catch (error) {
        logger.error('[Enhanced Predictions] Error loading predictions:', error);
      } finally {
        if (mounted) setLoadingPredictions(false);
      }
    }

    loadEnhancedPredictions();
    return () => {
      mounted = false;
    };
  }, [todaysGames, currentStandings]);

  // ============================================
  // Compute derived stats (momentum, clutch, rest)
  // ============================================
  useEffect(() => {
    if (!todaysGames?.games?.length) return;

    async function computeDerivedStats() {
      try {
        const gameResults = await fetchGameResults();
        if (!gameResults?.length) return;

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const teamAbbrevs = new Set<string>();
        for (const game of todaysGames.games) {
          if (game.homeTeam?.abbrev) teamAbbrevs.add(game.homeTeam.abbrev);
          if (game.awayTeam?.abbrev) teamAbbrevs.add(game.awayTeam.abbrev);
        }

        const newMomentumMap = new Map<string, MomentumData>();
        const newClutchMap = new Map<string, ClutchRating>();
        const newRestMap = new Map<string, number>();

        for (const abbrev of Array.from(teamAbbrevs)) {
          newMomentumMap.set(abbrev, calculateMomentum(abbrev, gameResults));
          newClutchMap.set(abbrev, calculateClutchRating(abbrev, gameResults));
          newRestMap.set(abbrev, calculateRestAdvantage(abbrev, todayStr, gameResults));
        }

        setMomentumMap(newMomentumMap);
        setClutchMap(newClutchMap);
        setRestMap(newRestMap);

        logger.log('[Derived Stats] Computed for', teamAbbrevs.size, 'teams');
      } catch (error) {
        logger.warn('[Derived Stats] Failed to compute:', error);
      }
    }

    computeDerivedStats();
  }, [todaysGames, edgeSkaterLanding]);

  // ============================================
  // Fetch team form data (sparklines)
  // ============================================
  useEffect(() => {
    if (!todaysGames?.games?.length) return;
    let mounted = true;

    async function loadFormData() {
      const teamAbbrevs = new Set<string>();
      for (const game of todaysGames.games) {
        if (game.homeTeam?.abbrev) teamAbbrevs.add(game.homeTeam.abbrev);
        if (game.awayTeam?.abbrev) teamAbbrevs.add(game.awayTeam.abbrev);
      }

      const entries = await Promise.allSettled(
        Array.from(teamAbbrevs).map(async (abbrev) => {
          const form = await fetchTeamForm(abbrev);
          return [abbrev, form] as const;
        }),
      );

      if (!mounted) return;
      const newFormMap = new Map<string, TeamFormData>();
      for (const entry of entries) {
        if (entry.status === 'fulfilled' && entry.value[1]) {
          newFormMap.set(entry.value[0], entry.value[1]);
        }
      }
      setFormMap(newFormMap);
      logger.log('[TeamForm] Loaded form data for', newFormMap.size, 'teams');
    }

    loadFormData();
    return () => { mounted = false; };
  }, [todaysGames]);

  // ============================================
  // Generate insights when data changes
  // ============================================
  useEffect(() => {
    if (!todaysGames?.games?.length) {
      setInsights([]);
      return;
    }
    const newInsights = generateInsights(
      todaysGames.games,
      currentStandings,
      h2hMap,
      playerStatsMap.size > 0 ? playerStatsMap : undefined,
      {
        skaterLanding: edgeSkaterLanding,
        momentumMap: momentumMap.size > 0 ? momentumMap : undefined,
        clutchMap: clutchMap.size > 0 ? clutchMap : undefined,
      },
    );
    setInsights(newInsights);
  }, [todaysGames, currentStandings, h2hMap, playerStatsMap, edgeSkaterLanding, momentumMap, clutchMap]);

  // ============================================
  // Computed values (memoized)
  // ============================================

  // Sort games by start time — soonest first
  const sortedGames = useMemo(() => {
    if (!todaysGames?.games?.length) return [];
    return [...todaysGames.games].sort((a: any, b: any) => {
      const timeA = a.startTimeUTC || '';
      const timeB = b.startTimeUTC || '';
      return timeA.localeCompare(timeB);
    });
  }, [todaysGames]);

  // Build predictions map for all games
  const predictionsMap = useMemo(() => {
    const map = new Map<string, { homeWinProb: number; awayWinProb: number }>();
    for (const game of sortedGames) {
      const pred = calculateWinProbability(game.homeTeam?.abbrev || '', game.awayTeam?.abbrev || '', String(game.id));
      map.set(String(game.id), { homeWinProb: pred.homeWinProb, awayWinProb: pred.awayWinProb });
    }
    return map;
  }, [sortedGames, calculateWinProbability]);

  // Hero = strongest prediction (highest confidence) from the soonest date
  const heroGame = useMemo(() => {
    if (!sortedGames.length) return null;
    let best: any = null;
    let bestConf = -1;
    for (const game of sortedGames) {
      const pred = predictionsMap.get(String(game.id));
      const conf = pred ? Math.abs(pred.homeWinProb - 50) * 2 : 0;
      if (conf > bestConf) {
        bestConf = conf;
        best = game;
      }
    }
    return best;
  }, [sortedGames, predictionsMap]);

  const remainingGames = useMemo(() => {
    if (!heroGame) return sortedGames;
    return sortedGames.filter((g: any) => g.id !== heroGame.id);
  }, [sortedGames, heroGame]);

  const heroPrediction = useMemo(() => {
    if (!heroGame) return { homeWinProb: 50, awayWinProb: 50 };
    return predictionsMap.get(String(heroGame.id)) ?? { homeWinProb: 50, awayWinProb: 50 };
  }, [heroGame, predictionsMap]);

  const heroConfidence = useMemo(() => {
    if (!heroGame) return 50;
    return Math.round(Math.abs(heroPrediction.homeWinProb - 50) * 2);
  }, [heroGame, heroPrediction]);

  const heroH2H = useMemo(() => {
    if (!heroGame) return null;
    return h2hMap.get(`${heroGame.awayTeam?.abbrev}-${heroGame.homeTeam?.abbrev}`) ?? null;
  }, [heroGame, h2hMap]);

  const gameCount = todaysGames?.games?.length || 0;
  const isLoading = loadingLeagueData || loadingPredictions;

  // ============================================
  // Upcoming / multi-day grouping
  // ============================================
  const todayStr = useMemo(() => getDateString(0), []);
  const tomorrowStr = useMemo(() => getDateString(1), []);

  const hasGamesToday = useMemo(() => {
    if (!todaysGames?.games?.length) return false;
    return todaysGames.games.some((g: any) => g.gameDate === todayStr);
  }, [todaysGames, todayStr]);

  const isShowingUpcoming = useMemo(() => {
    return gameCount > 0 && !hasGamesToday;
  }, [gameCount, hasGamesToday]);

  const gamesByDate = useMemo((): DateGroup[] => {
    if (!todaysGames?.games?.length) return [];
    const groups = new Map<string, any[]>();
    for (const game of todaysGames.games) {
      const date = game.gameDate ?? todayStr;
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date)!.push(game);
    }
    return Array.from(groups.entries()).map(([date, games]) => ({
      date,
      label: formatDateLabel(date, todayStr, tomorrowStr),
      games,
    }));
  }, [todaysGames, todayStr, tomorrowStr]);

  // Tonight's Headline
  const tonightHeadline = useMemo(() => {
    if (!todaysGames?.games?.length) return 'No Games Scheduled';
    if (isShowingUpcoming) return 'Upcoming Games';
    return generateTonightHeadline(todaysGames.games, currentStandings, h2hMap, momentumMap, restMap);
  }, [todaysGames, currentStandings, h2hMap, momentumMap, restMap, isShowingUpcoming]);

  // ============================================
  // Share handlers
  // ============================================
  const handleShareHero = useCallback(async () => {
    if (!heroGame) return;
    const away = heroGame.awayTeam?.abbrev || '???';
    const home = heroGame.homeTeam?.abbrev || '???';
    const prob = Math.max(heroPrediction.homeWinProb, heroPrediction.awayWinProb);
    const favored = heroPrediction.homeWinProb > heroPrediction.awayWinProb ? home : away;
    try {
      await Share.share({
        message: `${away} @ ${home} — ${favored} at ${prob}% (PuckIQ Top Edge)`,
      });
      analytics.trackCustomEvent('hero_shared', {
        matchup: `${away} @ ${home}`,
      });
    } catch {
      // User cancelled
    }
  }, [heroGame, heroPrediction, analytics]);

  // ============================================
  // Bound insight lookup
  // ============================================
  const getInsightForGameBound = useCallback(
    (game: any) => getInsightForGame(game, insights),
    [insights],
  );

  return {
    // Loading
    isLoading,
    refreshing,
    onRefresh,

    // Games
    todaysGames,
    gameCount,
    sortedGames,
    heroGame,
    remainingGames,

    // Upcoming / multi-day
    gamesByDate,
    hasGamesToday,
    isShowingUpcoming,

    // Predictions
    predictionsMap,
    heroPrediction,
    heroConfidence,
    heroH2H,
    calculateWinProbability,

    // H2H & Insights
    h2hMap,
    insights,
    getInsightForGame: getInsightForGameBound,

    // Edge & Derived
    edgeSkaterLanding,
    edgeTeamLanding,
    edgeByTheNumbers,
    momentumMap,
    clutchMap,
    restMap,

    // Player Stats
    playerStatsMap,

    // Team Form
    formMap,

    // Model
    activeModel,
    allModels,
    showModelPicker,
    setShowModelPicker,
    handleModelSwitch,
    toastMessage,

    // Headline
    tonightHeadline,

    // Handlers
    handleShareHero,

    // Standings
    currentStandings,

    // Data freshness
    lastFetchTime,

    // Analytics
    analytics,
  };
}
