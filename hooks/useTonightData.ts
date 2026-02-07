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

      // --- Supabase-first: today's games ---
      let gamesData: any = null;
      let standingsData: any = null;
      let supabaseGamesOk = false;
      let supabaseStandingsOk = false;

      try {
        const [gamesResult, standingsResult] = await Promise.allSettled([
          supabase.from('games').select('*').eq('game_date', todayStr),
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
          logger.info('[SUPABASE] Loaded', rows.length, 'games for', todayStr);
        } else {
          logger.warn('[SUPABASE] No games data for', todayStr, '— falling back to NHL API');
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
          logger.warn('[SUPABASE] No standings data — falling back to NHL API');
        }
      } catch (supabaseErr) {
        logger.warn('[SUPABASE] Error querying games/standings, falling back to NHL API', supabaseErr);
      }

      // --- NHL API fallback for anything Supabase didn't cover ---
      const fetchPromises: Promise<any>[] = [];
      // Only fetch from NHL API if Supabase didn't return data
      fetchPromises.push(
        supabaseGamesOk ? Promise.resolve(null) : fetch(`https://api-web.nhle.com/v1/score/${todayStr}`),
      );
      fetchPromises.push(
        supabaseStandingsOk ? Promise.resolve(null) : fetch('https://api-web.nhle.com/v1/standings/now'),
      );
      fetchPromises.push(fetchEdgeSkaterLanding());
      fetchPromises.push(fetchEdgeTeamLanding());
      fetchPromises.push(fetchEdgeByTheNumbers());

      const [gamesRes, standingsRes, skaterLandingRes, teamLandingRes, byTheNumbersRes] = await Promise.allSettled(fetchPromises);

      // NHL API fallback: games
      if (!supabaseGamesOk && gamesRes.status === 'fulfilled' && gamesRes.value && gamesRes.value.ok) {
        try {
          gamesData = await gamesRes.value.json();
          logger.log('[NHL Data] Games loaded:', gamesData?.games?.length || 0, 'games');
        } catch (parseErr) {
          logger.warn('[NHL Data] Failed to parse games JSON:', parseErr);
        }
      }

      // Dev fallback: use sample games when API returns 0 games or fails
      if (__DEV__ && !gamesData?.games?.length) {
        try {
          const { sampleGamesResponse } = require('../devData/sampleGames');
          gamesData = sampleGamesResponse;
          logger.log('[NHL Data] DEV: Using sample games data —', gamesData.games.length, 'games');
        } catch (devErr) {
          logger.warn('[NHL Data] DEV: Failed to load sample games:', devErr);
        }
      }

      if (mounted && gamesData) setTodaysGames(gamesData);

      // NHL API fallback: standings
      if (!supabaseStandingsOk && standingsRes.status === 'fulfilled' && standingsRes.value && standingsRes.value.ok) {
        try {
          standingsData = await standingsRes.value.json();
        } catch (parseErr) {
          logger.warn('[NHL Data] Failed to parse standings JSON:', parseErr);
        }
      }
      if (mounted && standingsData) setCurrentStandings(standingsData);
      // Edge landing data (optional — graceful fallback)
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

  // Sort games by confidence (edge strength) — highest first
  const sortedGames = useMemo(() => {
    if (!todaysGames?.games?.length || !currentStandings?.standings) return [];
    return [...todaysGames.games].sort((a: any, b: any) => {
      const predA = calculateWinProbability(a.homeTeam?.abbrev || '', a.awayTeam?.abbrev || '', String(a.id));
      const predB = calculateWinProbability(b.homeTeam?.abbrev || '', b.awayTeam?.abbrev || '', String(b.id));
      const confA = Math.abs(predA.homeWinProb - 50);
      const confB = Math.abs(predB.homeWinProb - 50);
      return confB - confA;
    });
  }, [todaysGames, currentStandings, calculateWinProbability]);

  const heroGame = sortedGames[0] ?? null;
  const remainingGames = sortedGames.slice(1);

  // Build predictions map for all games
  const predictionsMap = useMemo(() => {
    const map = new Map<string, { homeWinProb: number; awayWinProb: number }>();
    for (const game of sortedGames) {
      const pred = calculateWinProbability(game.homeTeam?.abbrev || '', game.awayTeam?.abbrev || '', String(game.id));
      map.set(String(game.id), { homeWinProb: pred.homeWinProb, awayWinProb: pred.awayWinProb });
    }
    return map;
  }, [sortedGames, calculateWinProbability]);

  const heroPrediction = useMemo(() => {
    if (!heroGame) return { homeWinProb: 50, awayWinProb: 50 };
    return calculateWinProbability(heroGame.homeTeam?.abbrev || '', heroGame.awayTeam?.abbrev || '', String(heroGame.id));
  }, [heroGame, calculateWinProbability]);

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

  // Tonight's Headline
  const tonightHeadline = useMemo(() => {
    if (!todaysGames?.games?.length) return 'No Games Tonight';
    return generateTonightHeadline(todaysGames.games, currentStandings, h2hMap, momentumMap, restMap);
  }, [todaysGames, currentStandings, h2hMap, momentumMap, restMap]);

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
