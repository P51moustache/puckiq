import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Animated, Modal, RefreshControl, ScrollView, Text, TouchableOpacity, View, Alert } from 'react-native';
import GameDeepDiveModal from '../../components/GameDeepDiveModal';
import ConfirmPickModal from '../../components/ConfirmPickModal';
import TopPickCard from '../../components/TopPickCard';
import PowerRankingsWidget from '../../components/PowerRankingsWidget';
import PickCard from '../../components/PickCard';
import StreakBadge from '../../components/StreakBadge';
import StreakTracker from '../../components/StreakTracker';
import YesterdayResultsCard from '../../components/YesterdayResultsCard';
import { ThemedView } from '../../components/ThemedView';
import { SkeletonPickCard, Skeleton } from '../../components/ui/SkeletonLoader';
import { makeStyles } from '../../constants/theme';
import { useAnalytics, useTrackUserInteraction } from '../../hooks/useAnalytics';
import {
  checkAndUpdateYesterdaysGames,
  getYesterdaysResults,
  saveLockOfTheDay,
  saveSmartPicks,
  addUserPick,
  getPicksForDate,
  getTodayDateString,
  Pick,
  PickStats
} from '../../services/pickTracking';
import { checkAndUpdateStreak, StreakData } from '../../services/streakTracking';
import { initializeNotifications, scheduleGameStartNotification } from '../../services/notifications';
import { getNotificationSettings } from '../../services/notificationSettings';
import { getLockOfTheDayEnhanced, getSmartPicksEnhanced, calculateWinProbabilityEnhanced } from '../../utils/predictionUtils';
import { getPlayerPredictionFactors } from '../../services/playerPrediction';
import type { PlayerPredictionFactors } from '../../types/predictions';

const name = 'Zach'
const now = new Date();

// Preload local top images (must use static requires for Metro bundler)
const TOP_IMAGES = [
  require('../../assets/images/topimages/image1.jpg'),
  require('../../assets/images/topimages/image2.jpg'),
  require('../../assets/images/topimages/image3.jpg'),
  require('../../assets/images/topimages/image4.jpg'),
  require('../../assets/images/topimages/image5.jpg'),
  require('../../assets/images/topimages/image6.jpg'),
  require('../../assets/images/topimages/image7.jpg'),
  require('../../assets/images/topimages/image8.jpg'),
] as const;

// Styles now come from the shared theme module

// Helper function to get current season string
const getCurrentSeason = () => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();

  // NHL season runs from October (9) to June (5)
  // If we're in June-September, show last season
  // If we're in October-May, show current season
  if (month >= 6 && month <= 8) {
    // Off-season (June-September): show last season
    return `${year - 1}-${String(year).slice(-2)}`;
  } else if (month >= 0 && month <= 5) {
    // Jan-June: show season that started last year
    return `${year - 1}-${String(year).slice(-2)}`;
  } else {
    // Oct-Dec: show season that started this year
    return `${year}-${String(year + 1).slice(-2)}`;
  }
};

export default function HomeScreen() {
  const styles = makeStyles();
  const router = useRouter();

  // Initialize analytics for this screen
  const analytics = useAnalytics('HomeScreen');
  const { trackButtonPress, trackTeamSelection, trackImageView } = useTrackUserInteraction('HomeScreen');

  // Pick a random top image on initial mount (app open)
  const topImage = React.useMemo(() => {
    const i = Math.floor(Math.random() * TOP_IMAGES.length);
    // Track which image was selected
    trackImageView(i, `top_image_${i + 1}`);
    return TOP_IMAGES[i];
  }, [trackImageView]);

  

  // Countdown to Sep 20th 4:00 PM PT (Pacific Time). On Sep 20, PT is UTC-7.
  const targetDate = React.useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    // 16:00 PT = 23:00 UTC (UTC-7) on Sep 20
    const targetUtc = Date.UTC(year, 8, 20, 23, 0, 0, 0);
    return new Date(targetUtc);
  }, []);

  const [msLeft, setMsLeft] = React.useState<number | null>(null);

  // Subtle pulse animation to draw attention
  const pulse = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (msLeft == null) return; // stop anim when hidden
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [msLeft, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });

  useEffect(() => {
    const update = () => {
      const diff = targetDate.getTime() - Date.now();
      setMsLeft(diff > 0 ? diff : null);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const fmtCountdown = React.useMemo(() => {
    if (msLeft == null) return null;
    const totalSec = Math.floor(msLeft / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }, [msLeft]);

  // Deep dive modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedGame, setSelectedGame] = useState<any>(null);

  // Info modal state
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Yesterday's results state
  const [yesterdaysResults, setYesterdaysResults] = useState<{
    lock?: Pick;
    smartPicks: Pick[];
    lockStats: PickStats;
    smartPickStats: PickStats;
  } | null>(null);

  // Streak tracking state
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastVisitDate: '',
    totalDays: 0,
  });

  // Lock in modal state
  const [lockInModalVisible, setLockInModalVisible] = useState(false);
  const [lockInGame, setLockInGame] = useState<any>(null);

  // User picks state - tracks which games user has picked today
  const [userPickedGameIds, setUserPickedGameIds] = useState<Set<string>>(new Set());

  // Check and load yesterday's results on mount
  useEffect(() => {
    async function loadYesterdaysData() {
      console.log('[PHASE 2] Starting to load yesterday\'s data...');
      try {
        // Check and update yesterday's game outcomes
        await checkAndUpdateYesterdaysGames();
        console.log('[PHASE 2] Updated yesterday\'s game outcomes');

        // Load yesterday's results
        const results = await getYesterdaysResults();
        console.log('[PHASE 2] Yesterday\'s results:', results);
        setYesterdaysResults(results);
      } catch (error) {
        console.error('[PHASE 2] Failed to load yesterday\'s results:', error);
      }
    }
    loadYesterdaysData();
  }, []);

  // Check and update streak on mount
  useEffect(() => {
    async function loadStreakData() {
      console.log('[PHASE 3] Starting to load streak data...');
      try {
        const streak = await checkAndUpdateStreak();
        console.log('[PHASE 3] Streak data loaded:', streak);
        setStreakData(streak);
        console.log('[PHASE 3] Streak state updated successfully');
      } catch (error) {
        console.error('[PHASE 3] Failed to load streak data:', error);
      }
    }
    loadStreakData();
  }, []);

  // Load today's user picks on mount
  useEffect(() => {
    async function loadTodaysUserPicks() {
      try {
        const today = getTodayDateString();
        const todaysPicks = await getPicksForDate(today);
        if (todaysPicks?.userPicks) {
          const pickedIds = new Set(todaysPicks.userPicks.map(p => p.gameId));
          setUserPickedGameIds(pickedIds);
          console.log('[PICKS] Loaded user picks for today:', pickedIds.size, 'games');
        }
      } catch (error) {
        console.error('[PICKS] Failed to load today\'s user picks:', error);
      }
    }
    loadTodaysUserPicks();
  }, []);

  // Check if picks can be made for a game (before 3rd period)
  const canMakePick = useCallback((game: any) => {
    const gameState = game.gameState || '';
    const isFuture = !gameState || gameState === 'FUT' || gameState === 'PRE';
    const isLive = gameState === 'LIVE' || gameState === 'CRIT';
    const isFinal = gameState === 'FINAL' || gameState === 'OFF';
    const currentPeriod = game.periodDescriptor?.number || 1;

    // Don't allow picks for finished games
    if (isFinal) return false;
    // Allow picks if game hasn't started
    if (isFuture) return true;
    // Allow picks if live but before 3rd period
    if (isLive && currentPeriod < 3) return true;

    return false;
  }, []);

  // Handle opening lock-in modal
  const handleOpenLockIn = useCallback((game: any) => {
    if (!canMakePick(game)) return; // Don't open if can't make pick
    setLockInGame(game);
    setLockInModalVisible(true);
  }, [canMakePick]);

  // Handle confirming a pick
  const handleConfirmLockIn = useCallback(async (selectedTeam: string) => {
    if (!lockInGame) return;

    const homeTeam = lockInGame.homeTeam?.abbrev || '';
    const awayTeam = lockInGame.awayTeam?.abbrev || '';
    const gameId = String(lockInGame.id);

    setLockInModalVisible(false);
    setLockInGame(null);

    // Save the user's pick to AsyncStorage
    try {
      await addUserPick({
        gameId,
        predictedWinner: selectedTeam,
        homeTeam,
        awayTeam,
      });

      // Update local state to reflect the pick was made
      setUserPickedGameIds(prev => new Set([...prev, gameId]));

      console.log(`[PICK SAVING] User pick saved: ${selectedTeam} for game ${gameId}`);

      // Schedule game start notification if enabled and game time is available
      if (lockInGame.startTimeUTC) {
        const settings = await getNotificationSettings();
        if (settings.notifyGameStart) {
          await scheduleGameStartNotification(
            gameId,
            homeTeam,
            awayTeam,
            lockInGame.startTimeUTC,
            settings.gameStartMinutesBefore,
            selectedTeam
          );
        }
      }
    } catch (error) {
      console.error('[PICK SAVING] Error saving user pick:', error);
      Alert.alert(
        'Error',
        'Failed to save your pick. Please try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Show success feedback
    Alert.alert(
      'Pick Confirmed!',
      `You picked ${selectedTeam} to win.`,
      [{ text: 'Got it!' }]
    );
  }, [lockInGame]);

  // Handle opening deep dive modal
  const handleOpenDeepDive = (game: any) => {
    setSelectedGame(game);
    setModalVisible(true);
  };

  // Load NHL data from tested endpoints
  const loadNHLData = React.useCallback(async (isRefresh = false) => {
    let mounted = true;
    if (isRefresh) setRefreshing(true);
    else setLoadingLeagueData(true);

    try {
      // Fetch multiple endpoints in parallel
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      console.log('[NHL Data] Fetching games for date:', todayStr);

      const [gamesRes, standingsRes, skatersRes, goaliesRes, spotlightRes] = await Promise.allSettled([
        fetch(`https://api-web.nhle.com/v1/score/${todayStr}`), // Use actual today's date
        fetch('https://api-web.nhle.com/v1/standings/now'),
        fetch('https://api-web.nhle.com/v1/skater-stats-leaders/current?categories=points,goals,assists&limit=5'),
        fetch('https://api-web.nhle.com/v1/goalie-stats-leaders/current?categories=wins&limit=3'),
        fetch('https://api-web.nhle.com/v1/player-spotlight')
      ]);

      // Process today's games
      if (gamesRes.status === 'fulfilled' && gamesRes.value.ok) {
        const gamesData = await gamesRes.value.json();
        console.log('[NHL Data] Games loaded:', gamesData?.games?.length || 0, 'games');
        if (mounted) setTodaysGames(gamesData);
      } else {
        console.log('[NHL Data] Failed to load games:', gamesRes.status);
      }

      // Process current standings
      if (standingsRes.status === 'fulfilled' && standingsRes.value.ok) {
        const standingsData = await standingsRes.value.json();
        if (mounted) setCurrentStandings(standingsData);
      }

      // Process stat leaders
      if (skatersRes.status === 'fulfilled' && skatersRes.value.ok && goaliesRes.status === 'fulfilled' && goaliesRes.value.ok) {
        const skatersData = await skatersRes.value.json();
        const goaliesData = await goaliesRes.value.json();
        if (mounted) {
          setStatLeaders({
            skaters: skatersData,
            goalies: goaliesData
          });
        }
      }

      // Process player spotlight
      if (spotlightRes.status === 'fulfilled' && spotlightRes.value.ok) {
        const spotlightData = await spotlightRes.value.json();
        if (mounted) setPlayerSpotlight(spotlightData);
      }

    } catch (e) {
      console.warn('Failed to load NHL data:', e);
    } finally {
      if (mounted) {
        setLoadingLeagueData(false);
        setRefreshing(false);
      }
    }

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    loadNHLData();
  }, []);

  // Initialize notifications
  useEffect(() => {
    initializeNotifications();
  }, []);

  // Pull-to-refresh handler
  const onRefresh = React.useCallback(() => {
    loadNHLData(true);
  }, [loadNHLData]);

  // League overview data - using tested endpoints
  const [todaysGames, setTodaysGames] = useState<any>(null);
  const [statLeaders, setStatLeaders] = useState<any>(null);
  const [currentStandings, setCurrentStandings] = useState<any>(null);
  const [playerSpotlight, setPlayerSpotlight] = useState<any>(null);
  const [loadingLeagueData, setLoadingLeagueData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Enhanced predictions state
  const [lockOfTheDay, setLockOfTheDay] = useState<any>(null);
  const [smartPicks, setSmartPicks] = useState<any[]>([]);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [playerFactorsMap, setPlayerFactorsMap] = useState<Map<string, PlayerPredictionFactors>>(new Map());


  // Helper function to calculate win probability using centralized enhanced function
  // Includes player factors (goalie matchup, hot players) when available
  const calculateWinProbability = useCallback((homeTeamAbbrev: string, awayTeamAbbrev: string, gameId?: string) => {
    const playerFactors = gameId ? playerFactorsMap.get(gameId) : undefined;
    return calculateWinProbabilityEnhanced(homeTeamAbbrev, awayTeamAbbrev, currentStandings, playerFactors || null);
  }, [currentStandings, playerFactorsMap]);

  // ENHANCED SMART PICKS SYSTEM

  // Calculate multi-factor confidence score (0-100)
  const calculateConfidenceScore = (game: any, homeTeam: any, awayTeam: any) => {
    let score = 50; // Base score

    if (!homeTeam || !awayTeam) return score;

    // Factor 1: Standings differential (max +/-15 points)
    const pointDiff = (homeTeam.pointPctg || 0.5) - (awayTeam.pointPctg || 0.5);
    score += pointDiff * 30;

    // Factor 2: Home ice advantage (+5 points)
    score += 5;

    // Factor 3: Win streaks (+/-10 points)
    const homeStreakValue = (homeTeam.streakCode?.startsWith('W') ? parseInt(homeTeam.streakCode.substring(1)) || 0 : 0) -
                           (homeTeam.streakCode?.startsWith('L') ? parseInt(homeTeam.streakCode.substring(1)) || 0 : 0);
    const awayStreakValue = (awayTeam.streakCode?.startsWith('W') ? parseInt(awayTeam.streakCode.substring(1)) || 0 : 0) -
                           (awayTeam.streakCode?.startsWith('L') ? parseInt(awayTeam.streakCode.substring(1)) || 0 : 0);
    score += (homeStreakValue - awayStreakValue) * 2;

    // Factor 4: Recent performance (goal differential)
    const homeGD = (homeTeam.goalFor || 0) - (homeTeam.goalAgainst || 0);
    const awayGD = (awayTeam.goalFor || 0) - (awayTeam.goalAgainst || 0);
    const gdDiff = (homeGD / (homeTeam.gamesPlayed || 1)) - (awayGD / (awayTeam.gamesPlayed || 1));
    score += gdDiff * 3;

    // Normalize to 0-100
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  // Get recent form summary
  const getRecentForm = (team: any) => {
    if (!team) return { record: '0-0-0', goalDiff: 0, form: 'neutral' };

    const streak = team.streakCode || '';
    const streakNum = parseInt(streak.substring(1)) || 0;

    let form = 'neutral';
    if (streak.startsWith('W') && streakNum >= 3) form = 'hot';
    else if (streak.startsWith('L') && streakNum >= 3) form = 'cold';

    const gamesPlayed = team.gamesPlayed || 1;
    const goalDiff = (team.goalFor || 0) - (team.goalAgainst || 0);
    const goalsPerGame = ((team.goalFor || 0) / gamesPlayed).toFixed(1);

    return {
      record: `${team.wins || 0}-${team.losses || 0}-${team.otLosses || 0}`,
      streak: streak,
      goalDiff: Math.round(goalDiff / gamesPlayed * 10) / 10,
      goalsPerGame,
      form
    };
  };

  // Enhanced predictions are now calculated in useEffect below with async API calls

  // Get teams on hot/cold streaks
  const getStreakingTeams = React.useCallback((standings: any) => {
    if (!standings?.standings) return { hot: [], cold: [] };

    const hot = standings.standings
      .filter((t: any) => {
        const streak = t.streakCode || '';
        return streak.startsWith('W') && parseInt(streak.substring(1)) >= 3;
      })
      .sort((a: any, b: any) => {
        const aStreak = parseInt((a.streakCode || '').substring(1)) || 0;
        const bStreak = parseInt((b.streakCode || '').substring(1)) || 0;
        return bStreak - aStreak;
      })
      .slice(0, 5);

    const cold = standings.standings
      .filter((t: any) => {
        const streak = t.streakCode || '';
        return streak.startsWith('L') && parseInt(streak.substring(1)) >= 3;
      })
      .sort((a: any, b: any) => {
        const aStreak = parseInt((a.streakCode || '').substring(1)) || 0;
        const bStreak = parseInt((b.streakCode || '').substring(1)) || 0;
        return bStreak - aStreak;
      })
      .slice(0, 5);

    return { hot, cold };
  }, []);

  // Calculate power rankings with momentum
  const getPowerRankings = React.useCallback((standings: any) => {
    if (!standings?.standings) return [];

    return standings.standings
      .map((team: any) => {
        // Base score from points
        let powerScore = team.points || 0;

        // Add momentum bonus based on recent form
        const streak = team.streakCode || '';
        if (streak.startsWith('W')) {
          const wins = parseInt(streak.substring(1)) || 0;
          powerScore += wins * 1.5; // Bonus for win streaks
        } else if (streak.startsWith('L')) {
          const losses = parseInt(streak.substring(1)) || 0;
          powerScore -= losses * 1.5; // Penalty for losing streaks
        }

        // Add goal differential factor
        const gd = (team.goalFor || 0) - (team.goalAgainst || 0);
        powerScore += gd * 0.1;

        return {
          ...team,
          powerScore: Math.round(powerScore),
          trend: streak.startsWith('W') && parseInt(streak.substring(1)) >= 2 ? 'up' :
                 streak.startsWith('L') && parseInt(streak.substring(1)) >= 2 ? 'down' : 'neutral'
        };
      })
      .sort((a: any, b: any) => b.powerScore - a.powerScore);
  }, []);

  // Calculate enhanced predictions with recent form, situational factors, and player data
  useEffect(() => {
    let mounted = true;

    async function loadEnhancedPredictions() {
      if (!todaysGames?.games || !currentStandings?.standings) {
        if (mounted) {
          setLockOfTheDay(null);
          setSmartPicks([]);
          setPlayerFactorsMap(new Map());
        }
        return;
      }

      setLoadingPredictions(true);
      console.log('[Enhanced Predictions] Loading with recent form, situational factors & player data...');

      try {
        // Fetch player factors for each game (in parallel) for use in probability displays
        const factorsPromises = todaysGames.games.map(async (game: any) => {
          try {
            const homeAbbrev = game.homeTeam?.abbrev || '';
            const awayAbbrev = game.awayTeam?.abbrev || '';
            if (homeAbbrev && awayAbbrev) {
              const factors = await getPlayerPredictionFactors(homeAbbrev, awayAbbrev);
              return { gameId: String(game.id), factors };
            }
            return null;
          } catch (error) {
            console.error(`[Enhanced Predictions] Error fetching player factors for game ${game.id}:`, error);
            return null;
          }
        });

        const factorsResults = await Promise.all(factorsPromises);
        if (mounted) {
          const newFactorsMap = new Map<string, PlayerPredictionFactors>();
          for (const result of factorsResults) {
            if (result) {
              newFactorsMap.set(result.gameId, result.factors);
            }
          }
          setPlayerFactorsMap(newFactorsMap);
          console.log('[Enhanced Predictions] Player factors loaded for', newFactorsMap.size, 'games');
        }

        // Fetch enhanced lock of the day (with recent form + situational factors)
        const enhancedLock = await getLockOfTheDayEnhanced(todaysGames.games, currentStandings);

        if (mounted) {
          setLockOfTheDay(enhancedLock);
          console.log('[Enhanced Predictions] Lock loaded with confidence:', enhancedLock?.confidenceScore);
        }

        // Fetch enhanced smart picks
        if (enhancedLock && mounted) {
          const enhancedPicks = await getSmartPicksEnhanced(
            todaysGames.games,
            enhancedLock.id,
            currentStandings,
            4
          );

          if (mounted) {
            setSmartPicks(enhancedPicks);
            console.log('[Enhanced Predictions] Smart picks loaded:', enhancedPicks.length);
          }
        }
      } catch (error) {
        console.error('[Enhanced Predictions] Error loading predictions:', error);
        // Keep existing predictions on error
      } finally {
        if (mounted) {
          setLoadingPredictions(false);
        }
      }
    }

    loadEnhancedPredictions();
    return () => { mounted = false; };
  }, [todaysGames, currentStandings]);

  const powerRankings = useMemo(() => {
    if (!currentStandings?.standings) return [];
    return getPowerRankings(currentStandings);
  }, [currentStandings, getPowerRankings]);

  const streakingTeams = useMemo(() => {
    if (!currentStandings?.standings) return { hot: [], cold: [] };
    return getStreakingTeams(currentStandings);
  }, [currentStandings, getStreakingTeams]);

  // Save today's picks when they're generated
  useEffect(() => {
    async function saveTodaysPicks() {
      console.log('[PICK SAVING] Effect triggered. Lock:', !!lockOfTheDay, 'Smart picks:', smartPicks.length);
      try {
        // Save Lock of the Day
        if (lockOfTheDay) {
          const prediction = calculateWinProbability(
            lockOfTheDay.homeTeam?.abbrev || '',
            lockOfTheDay.awayTeam?.abbrev || '',
            String(lockOfTheDay.id)
          );
          const predictedWinner = prediction.homeWinProb > prediction.awayWinProb
            ? lockOfTheDay.homeTeam.abbrev
            : lockOfTheDay.awayTeam.abbrev;

          console.log('[PICK SAVING] Saving Lock of the Day:', {
            gameId: String(lockOfTheDay.id),
            predictedWinner,
            homeTeam: lockOfTheDay.homeTeam.abbrev,
            awayTeam: lockOfTheDay.awayTeam.abbrev,
          });

          await saveLockOfTheDay({
            gameId: String(lockOfTheDay.id),
            predictedWinner,
            homeTeam: lockOfTheDay.homeTeam.abbrev,
            awayTeam: lockOfTheDay.awayTeam.abbrev,
            confidenceScore: lockOfTheDay.confidenceScore,
          });
          console.log('[PICK SAVING] Lock of the Day saved successfully');
        }

        // Save Smart Picks
        if (smartPicks.length > 0) {
          console.log('[PICK SAVING] Saving', smartPicks.length, 'smart picks');
          await saveSmartPicks(
            smartPicks.map(pick => {
              // Determine predicted winner based on prediction logic
              const homeWinProb = pick.prediction?.homeWinProb || 50;
              const awayWinProb = pick.prediction?.awayWinProb || 50;
              const predictedWinner = homeWinProb > awayWinProb
                ? pick.homeTeam.abbrev
                : pick.awayTeam.abbrev;

              return {
                gameId: String(pick.id),
                predictedWinner,
                homeTeam: pick.homeTeam.abbrev,
                awayTeam: pick.awayTeam.abbrev,
                confidenceScore: pick.confidenceScore,
              };
            })
          );
          console.log('[PICK SAVING] Smart picks saved successfully');
        }
      } catch (error) {
        console.error('[PICK SAVING] Failed to save today\'s picks:', error);
      }
    }

    if (lockOfTheDay || smartPicks.length > 0) {
      saveTodaysPicks();
    }
  }, [lockOfTheDay, smartPicks]);

  // Info Modal Component
  const InfoModal = () => {
    if (!activeModal) return null;

    const renderModalContent = () => {
      switch (activeModal) {
        case 'teams':
          return (
            <>
              <Text style={styles.modalTitle}>NHL Teams (32)</Text>
              <ScrollView style={{ maxHeight: 400 }}>
                {['Atlantic', 'Metropolitan', 'Central', 'Pacific'].map((division) => {
                  const divisionTeams = {
                    'Atlantic': ['BOS', 'BUF', 'DET', 'FLA', 'MTL', 'OTT', 'TBL', 'TOR'],
                    'Metropolitan': ['CAR', 'CBJ', 'NJD', 'NYI', 'NYR', 'PHI', 'PIT', 'WSH'],
                    'Central': ['ARI', 'CHI', 'COL', 'DAL', 'MIN', 'NSH', 'STL', 'WPG'],
                    'Pacific': ['ANA', 'CGY', 'EDM', 'LAK', 'SEA', 'SJS', 'VAN', 'VGK']
                  };
                  return (
                    <View key={division} style={{ marginBottom: 16 }}>
                      <Text style={[styles.boxtitle, { fontSize: 16, marginBottom: 8 }]}>{division} Division</Text>
                      <Text style={styles.subtextLarge}>{divisionTeams[division as keyof typeof divisionTeams].join(', ')}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          );

        case 'games':
          return (
            <>
              <Text style={styles.modalTitle}>Today's Schedule</Text>
              <ScrollView style={{ maxHeight: 400 }}>
                {todaysGames?.games && todaysGames.games.length > 0 ? (
                  todaysGames.games.map((game: any) => {
                    const time = game.startTimeUTC ? new Date(game.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD';
                    const venue = game.venue?.default || 'TBD';
                    return (
                      <View key={game.id} style={{ marginBottom: 12, padding: 12, backgroundColor: styles.factbox.backgroundColor, borderRadius: 8 }}>
                        <Text style={[styles.boxtitle, { fontSize: 14, marginBottom: 4 }]}>
                          {game.awayTeam?.abbrev} @ {game.homeTeam?.abbrev}
                        </Text>
                        <Text style={[styles.subtextSmall, { fontSize: 11 }]}>{time} • {venue}</Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.modalText}>No games scheduled today</Text>
                )}
              </ScrollView>
            </>
          );

        case 'season':
          return (
            <>
              <Text style={styles.modalTitle}>2025-26 Season Info</Text>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.boxtitle, { fontSize: 14, marginBottom: 8 }]}>Regular Season</Text>
                <Text style={styles.modalText}>October 7, 2025 - April 17, 2026</Text>
              </View>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.boxtitle, { fontSize: 14, marginBottom: 8 }]}>Playoffs</Text>
                <Text style={styles.modalText}>Mid-April 2026 (16 teams)</Text>
              </View>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.boxtitle, { fontSize: 14, marginBottom: 8 }]}>Stanley Cup Finals</Text>
                <Text style={styles.modalText}>June 2026</Text>
              </View>
              <View>
                <Text style={[styles.boxtitle, { fontSize: 14, marginBottom: 8 }]}>Season Format</Text>
                <Text style={styles.modalText}>• 82 games per team{'\n'}• 16 teams make playoffs{'\n'}• Best-of-7 series format</Text>
              </View>
            </>
          );

        case 'points':
        case 'goals':
        case 'assists': {
          const leaderType = activeModal === 'points' ? 'points' : activeModal === 'goals' ? 'goals' : 'assists';
          const leader = statLeaders?.skaters?.[leaderType]?.[0];

          if (!leader) return <Text style={styles.modalText}>No data available</Text>;

          const firstName = leader.firstName?.default || '';
          const lastName = leader.lastName?.default || '';
          const team = leader.teamAbbrev || 'N/A';
          const teamName = leader.teamName?.default || team;
          const position = leader.position || 'N/A';

          return (
            <>
              <Text style={styles.modalTitle}>{firstName} {lastName}</Text>
              <Text style={[styles.subtextLarge, { marginBottom: 8, textAlign: 'center' }]}>
                {teamName} ({team}) • {position} • #{leader.sweaterNumber || '?'}
              </Text>

              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.boxtitle, { fontSize: 14, marginBottom: 8, textAlign: 'center' }]}>
                  {getCurrentSeason()} Season Leader
                </Text>
                <Text style={[styles.boxvalue, { fontSize: 48, textAlign: 'center' }]}>{leader.value}</Text>
                <Text style={[styles.boxtitle, { fontSize: 16, marginTop: 4, textAlign: 'center' }]}>
                  {activeModal === 'points' ? 'Points' : activeModal === 'goals' ? 'Goals' : 'Assists'}
                </Text>
              </View>

              <View style={{ backgroundColor: styles.factbox.backgroundColor, borderRadius: 8, padding: 12 }}>
                <Text style={[styles.boxtitle, { marginBottom: 8 }]}>Player Info</Text>
                <Text style={styles.modalText}>
                  Position: {position}{'\n'}
                  Team: {teamName} ({team}){'\n'}
                  Jersey #: {leader.sweaterNumber || 'N/A'}{'\n'}
                  {activeModal === 'points' && `League-leading ${leader.value} points`}
                  {activeModal === 'goals' && `League-leading ${leader.value} goals`}
                  {activeModal === 'assists' && `League-leading ${leader.value} assists`}
                </Text>
              </View>
            </>
          );
        }

        case 'record': {
          const team = currentStandings?.standings?.[0];
          if (!team) return <Text style={styles.modalText}>No data available</Text>;

          const teamName = team.teamName?.default || team.teamAbbrev?.default || 'N/A';
          const abbrev = team.teamAbbrev?.default || team.teamAbbrev || 'N/A';

          return (
            <>
              <Text style={styles.modalTitle}>{teamName}</Text>
              <Text style={[styles.subtextLarge, { marginBottom: 16, textAlign: 'center' }]}>{abbrev}</Text>

              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.boxtitle, { fontSize: 14, marginBottom: 8, textAlign: 'center' }]}>Best Record</Text>
                <Text style={[styles.boxvalue, { fontSize: 32, textAlign: 'center' }]}>{team.points} PTS</Text>
              </View>

              <View>
                <Text style={styles.boxtitle}>Team Stats</Text>
                <Text style={styles.modalText}>
                  Record: {team.wins}-{team.losses}-{team.otLosses || 0}{'\n'}
                  Points %: {((team.pointPctg || 0) * 100).toFixed(1)}%{'\n'}
                  Goal Differential: +{(team.goalFor || 0) - (team.goalAgainst || 0)}{'\n'}
                  Current Streak: {team.streakCode || 'N/A'}
                </Text>
              </View>
            </>
          );
        }

        default:
          return <Text style={styles.modalText}>No content available</Text>;
      }
    };

    return (
      <Modal
        visible={!!activeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActiveModal(null)}
        >
          <TouchableOpacity
            style={[styles.modalContainer, { maxWidth: 400, maxHeight: '80%' }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {renderModalContent()}
            <TouchableOpacity style={[styles.modalButton, { marginTop: 16 }]} onPress={() => setActiveModal(null)}>
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={{ alignSelf: 'stretch', width: '100%' }}
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#60a5fa"
            colors={['#60a5fa']}
            title="Pull to refresh..."
            titleColor="#98a6bf"
          />
        }
      >
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>PuckIQ</Text>
              <Text style={[styles.subtitle, { marginTop: 8, fontSize: 16 }]}>
                Smart NHL Picks
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <StreakBadge currentStreak={streakData.currentStreak} longestStreak={streakData.longestStreak} />
            </View>
          </View>
          {fmtCountdown && (
            <View style={[styles.countdownBox, { marginTop: 16 }]}> 
              <LinearGradient
                colors={['#60a5fa', '#7c3aed', '#f43f5e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 16, paddingHorizontal: 16 }}
              >
                <Text style={styles.countdownLabel}>Countdown to Preseason</Text>
                <Text style={styles.countdownTimer}>{fmtCountdown}</Text>
              </LinearGradient>
            </View>
          )}
          <Image
            source={topImage}
            style={styles.mainpic}
            contentFit="cover"
            accessibilityLabel="NHL action shot"
          />
        </View>

        {/* TODAY'S PICKS SECTION */}
        <View style={{ width: '100%', marginTop: 20 }}>
          <Text style={[styles.subsection, { alignSelf: 'stretch', textAlign: 'center', marginBottom: 16 }]}>
            Today's Picks
          </Text>

          {(loadingLeagueData || loadingPredictions || (!lockOfTheDay && !smartPicks.length && todaysGames?.games?.length > 0)) ? (
            <View style={{ width: '100%' }}>
              {/* Skeleton for top pick */}
              <SkeletonPickCard variant="top" />
              {/* Skeleton for more picks */}
              <View style={{ marginTop: 16 }}>
                <Skeleton width={100} height={18} style={{ marginBottom: 12 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <SkeletonPickCard variant="normal" />
                  <SkeletonPickCard variant="normal" />
                </View>
              </View>
            </View>
          ) : (
            <>
              {/* Yesterday's Results */}
              {console.log('[RENDER] Yesterday\'s results data:', yesterdaysResults)}
              {yesterdaysResults && (
                <YesterdayResultsCard
                  lock={yesterdaysResults.lock}
                  smartPicks={yesterdaysResults.smartPicks}
                  lockStats={yesterdaysResults.lockStats}
                  smartPickStats={yesterdaysResults.smartPickStats}
                />
              )}

              {/* Top Pick of the Day - Hero Card */}
              {lockOfTheDay && (
                <View style={{ marginBottom: 16 }}>
                  <TopPickCard
                    game={lockOfTheDay}
                    confidenceScore={lockOfTheDay.confidenceScore || 0}
                    prediction={calculateWinProbability(
                      lockOfTheDay.homeTeam?.abbrev || '',
                      lockOfTheDay.awayTeam?.abbrev || '',
                      String(lockOfTheDay.id)
                    )}
                    onPress={() => handleOpenDeepDive(lockOfTheDay)}
                    onConfirmPick={() => handleOpenLockIn(lockOfTheDay)}
                    isLocked={!canMakePick(lockOfTheDay)}
                    hasUserPick={userPickedGameIds.has(String(lockOfTheDay.id))}
                  />
                </View>
              )}

              {/* More Picks Grid */}
              {smartPicks && smartPicks.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '800',
                      color: '#e6eef8',
                      paddingHorizontal: 0,
                    }}>
                      More Picks
                    </Text>
                    <TouchableOpacity onPress={() => router.push('/picks')}>
                      <Text style={{
                        fontSize: 11,
                        color: '#60a5fa',
                        fontWeight: '600',
                      }}>
                        View All Picks
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                  }}>
                    {smartPicks.map((pick: any) => (
                      <PickCard
                        key={pick.id}
                        game={pick}
                        confidenceScore={pick.confidenceScore || 0}
                        prediction={calculateWinProbability(
                          pick.homeTeam?.abbrev || '',
                          pick.awayTeam?.abbrev || '',
                          String(pick.id)
                        )}
                        onPress={() => handleOpenDeepDive(pick)}
                        onConfirmPick={() => handleOpenLockIn(pick)}
                        isLocked={!canMakePick(pick)}
                        hasUserPick={userPickedGameIds.has(String(pick.id))}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* No games message */}
              {!lockOfTheDay && (!smartPicks || smartPicks.length === 0) && (
                <View style={[styles.card, { padding: 20 }]}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: '#e6eef8',
                    textAlign: 'center',
                    marginBottom: 8,
                  }}>
                    No Games Today
                  </Text>
                  <Text style={[styles.subtextSmall, { textAlign: 'center', lineHeight: 18 }]}>
                    Check back tomorrow for fresh picks and predictions!
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* POWER RANKINGS */}
        {powerRankings && powerRankings.length > 0 && (
          <PowerRankingsWidget rankings={powerRankings} />
        )}

        {/* HOT/COLD STREAKS */}
        {streakingTeams && (streakingTeams.hot.length > 0 || streakingTeams.cold.length > 0) && (
          <StreakTracker streakingTeams={streakingTeams} />
        )}



      </ScrollView>

      {/* Deep Dive Modal */}
      {selectedGame && (
        <GameDeepDiveModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          game={selectedGame}
          prediction={calculateWinProbability(
            selectedGame.homeTeam?.abbrev || '',
            selectedGame.awayTeam?.abbrev || '',
            String(selectedGame.id)
          )}
        />
      )}

      {/* Info Modal */}
      <InfoModal />

      {/* Confirm Pick Modal */}
      {lockInGame && (
        <ConfirmPickModal
          visible={lockInModalVisible}
          onClose={() => {
            setLockInModalVisible(false);
            setLockInGame(null);
          }}
          onConfirm={handleConfirmLockIn}
          homeTeam={lockInGame.homeTeam?.abbrev || 'HOME'}
          awayTeam={lockInGame.awayTeam?.abbrev || 'AWAY'}
          aiPick={(() => {
            const prob = calculateWinProbability(
              lockInGame.homeTeam?.abbrev || '',
              lockInGame.awayTeam?.abbrev || '',
              String(lockInGame.id)
            );
            return prob.homeWinProb > prob.awayWinProb
              ? lockInGame.homeTeam?.abbrev || 'HOME'
              : lockInGame.awayTeam?.abbrev || 'AWAY';
          })()}
          aiConfidence={lockInGame.confidenceScore || 60}
        />
      )}
    </ThemedView>
  );
}

