import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import GameDeepDiveModal from '../../components/GameDeepDiveModal';
import PickHistoryModal from '../../components/PickHistoryModal';
import StreakBadge from '../../components/StreakBadge';
import { ThemedView } from '../../components/ThemedView';
import { makeStyles, theme } from '../../constants/theme';
import {
  addUserPick,
  getAllPicks,
  getPicksForDate,
  getTodayDateString,
  Pick,
} from '../../services/pickTracking';
import { getStreakData, StreakData } from '../../services/streakTracking';
import { addNotificationResponseListener, scheduleGameStartNotification } from '../../services/notifications';
import { getNotificationSettings } from '../../services/notificationSettings';
import { calculateWinProbabilityEnhanced } from '../../utils/predictionUtils';
import { getPlayerPredictionFactors } from '../../services/playerPrediction';
import type { PlayerPredictionFactors } from '../../types/predictions';
import { useAnalytics } from '../../hooks/useAnalytics';

export default function PicksScreen() {
  const styles = makeStyles();
  const analytics = useAnalytics('PicksScreen');

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastPickedGame, setLastPickedGame] = useState<string | null>(null);
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastVisitDate: '',
    totalDays: 0,
  });
  const [games, setGames] = useState<any[]>([]);
  const [picks, setPicks] = useState<any>({ smartPicks: [], userPicks: [] });
  const [allPicks, setAllPicks] = useState<Pick[]>([]);
  const [modalGame, setModalGame] = useState<any>(null);
  const [standings, setStandings] = useState<any>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [playerFactorsMap, setPlayerFactorsMap] = useState<Map<string, PlayerPredictionFactors>>(new Map());

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  // Listen for notification taps
  useEffect(() => {
    const subscription = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.screen === 'pickHistory') {
        setShowHistoryModal(true);
      }
    });

    return () => subscription.remove();
  }, []);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const today = getTodayDateString();
      const [streakRes, allPicksRes, dailyPicksRes, gamesRes, standingsRes] = await Promise.all([
        getStreakData(),
        getAllPicks(),
        getPicksForDate(today),
        fetch(`https://api-web.nhle.com/v1/score/${today}`),
        fetch('https://api-web.nhle.com/v1/standings/now'),
      ]);

      setStreakData(streakRes);
      setAllPicks(allPicksRes);
      setPicks(dailyPicksRes || { smartPicks: [], userPicks: [] });

      let todaysGames: any[] = [];
      if (gamesRes.ok) {
        const data = await gamesRes.json();
        todaysGames = (data.games || []).filter((game: any) => {
          return game.gameDate === today;
        });
        setGames(todaysGames);
      }

      if (standingsRes.ok) {
        setStandings(await standingsRes.json());
      }

      // Fetch player factors for each game (in parallel)
      if (todaysGames.length > 0) {
        const factorsPromises = todaysGames.map(async (game: any) => {
          try {
            const homeAbbrev = game.homeTeam?.abbrev || '';
            const awayAbbrev = game.awayTeam?.abbrev || '';
            if (homeAbbrev && awayAbbrev) {
              const factors = await getPlayerPredictionFactors(homeAbbrev, awayAbbrev);
              return { gameId: String(game.id), factors };
            }
            return null;
          } catch (error) {
            console.error(`[Picks] Error fetching player factors for game ${game.id}:`, error);
            return null;
          }
        });

        const results = await Promise.all(factorsPromises);
        const newFactorsMap = new Map<string, PlayerPredictionFactors>();
        for (const result of results) {
          if (result) {
            newFactorsMap.set(result.gameId, result.factors);
          }
        }
        setPlayerFactorsMap(newFactorsMap);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Make pick
  const makePick = async (gameId: string, team: string, homeTeam: string, awayTeam: string, startTimeUTC?: string) => {
    // Trigger animation
    setLastPickedGame(`${gameId}-${team}`);
    setTimeout(() => setLastPickedGame(null), 200);

    // Haptic feedback for better UX
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      // Silently fail if haptics not available
      console.debug('Haptic feedback not available');
    }

    const newPick: Pick = {
      gameId,
      date: getTodayDateString(),
      type: 'user-pick',
      predictedWinner: team,
      homeTeam,
      awayTeam,
    };

    setPicks((prev: any) => {
      const idx = prev.userPicks.findIndex((p: Pick) => p.gameId === gameId);
      const updated = idx >= 0
        ? prev.userPicks.map((p: Pick, i: number) => (i === idx ? newPick : p))
        : [...prev.userPicks, newPick];
      return { ...prev, userPicks: updated };
    });

    try {
      await addUserPick({
        gameId,
        predictedWinner: team,
        homeTeam,
        awayTeam,
      });

      // Track pick made event
      analytics.trackCustomEvent('pick_made', {
        game_id: gameId,
        predicted_winner: team,
        home_team: homeTeam,
        away_team: awayTeam,
        matchup: `${awayTeam} @ ${homeTeam}`,
        pick_source: 'picks_screen',
      });

      // Schedule game start notification if enabled and game time is available
      if (startTimeUTC) {
        const settings = await getNotificationSettings();
        if (settings.notifyGameStart) {
          await scheduleGameStartNotification(
            gameId,
            homeTeam,
            awayTeam,
            startTimeUTC,
            settings.gameStartMinutesBefore,
            team
          );
        }
      }
    } catch (error) {
      console.error('Error saving pick:', error);
    }
  };

  // Stats
  const userPicks = allPicks.filter((p) => p.type === 'user-pick');
  const completed = userPicks.filter((p) => p.outcome);
  const wins = completed.filter((p) => p.outcome === 'win').length;
  const losses = completed.filter((p) => p.outcome === 'loss').length;
  const accuracy = completed.length > 0 ? Math.round((wins / completed.length) * 100) : 0;

  // Badge helper with priority system: LIVE > FINAL > BEST BET > AI
  const getBadgeToDisplay = (
    isLive: boolean,
    isFinal: boolean,
    isBestBet: boolean,
    hasSmartPick: boolean,
    currentPeriod: number,
    predictedTeam?: string
  ) => {
    if (isLive) {
      return { text: `P${currentPeriod}`, color: '#ef4444', type: 'live' };
    }
    if (isFinal) {
      return { text: 'FINAL', color: theme.subtext, type: 'final' };
    }
    if (isBestBet) {
      return { text: 'TOP', color: '#fbbf24', type: 'bestbet' };
    }
    if (hasSmartPick && predictedTeam) {
      return { text: `AI: ${predictedTeam}`, color: '#10b981', type: 'ai' };
    }
    return null;
  };

  // Score highlighting helper
  const getScoreStyle = (score: number, opponentScore: number, isGameStarted: boolean) => {
    if (!isGameStarted) {
      return { color: theme.accent, opacity: 1 };
    }

    // Highlight winning score in green
    if (score > opponentScore) {
      return { color: '#10b981', opacity: 1 };
    }

    // Dim losing score
    if (score < opponentScore) {
      return { color: '#98a6bf', opacity: 0.6 };
    }

    // Tied scores - normal color
    return { color: theme.accent, opacity: 1 };
  };

  // Helper to get tomorrow's date string
  const getTomorrowDateString = (): string => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format date for display
  const getFormattedDate = (dateString: string): string => {
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  // Use enhanced win probability calculation with player factors for consistency with Today screen
  const getProbability = (homeAbbrev: string, awayAbbrev: string, gameId?: string) => {
    const playerFactors = gameId ? playerFactorsMap.get(gameId) : undefined;
    return calculateWinProbabilityEnhanced(homeAbbrev, awayAbbrev, standings, playerFactors || null);
  };

  // Helper to get team standings data
  const getTeamStandings = (abbrev: string) => {
    if (!standings?.standings) return null;
    return standings.standings.find((t: any) =>
      (t.teamAbbrev?.default || t.teamAbbrev) === abbrev
    );
  };

  // Helper to format record
  const formatRecord = (team: any) => {
    if (!team) return '0-0-0';
    return `${team.wins || 0}-${team.losses || 0}-${team.otLosses || 0}`;
  };

  // Helper to get streak with color
  const getStreakInfo = (streakCode: string | undefined) => {
    if (!streakCode) return { text: '-', color: theme.subtext };
    const isWin = streakCode.startsWith('W');
    const isLoss = streakCode.startsWith('L');
    if (isWin) return { text: streakCode, color: '#10b981' };
    if (isLoss) return { text: streakCode, color: '#ef4444' };
    return { text: streakCode, color: theme.subtext };
  };

  // Helper to get confidence level
  const getConfidenceInfo = (homeProb: number, awayProb: number) => {
    const diff = Math.abs(homeProb - awayProb);
    if (diff >= 20) return { text: 'Strong', color: '#10b981', bg: '#10b98122' };
    if (diff >= 10) return { text: 'Moderate', color: '#f59e0b', bg: '#f59e0b22' };
    return { text: 'Toss-Up', color: '#ef4444', bg: '#ef444422' };
  };

  return (
    <ThemedView style={[styles.container, { overflow: 'hidden' }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: 100, flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        horizontal={false}
        bounces={true}
        style={{ flex: 1, width: '100%' }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={theme.accent} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={s.headerRow}>
            <View>
              <Text style={styles.title}>My Picks</Text>
              <Text style={styles.subtitle}>Track your predictions</Text>
            </View>
            <StreakBadge currentStreak={streakData.currentStreak} longestStreak={streakData.longestStreak} />
          </View>
        </View>

        {loading ? (
          <View style={[styles.card, s.loading]}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : (
          <>
            {/* Quick Stats */}
            <TouchableOpacity
              style={s.statsBar}
              onPress={() => setShowHistoryModal(true)}
              activeOpacity={0.7}
            >
              <View style={s.stat}>
                <Text style={s.statValue}>{accuracy}%</Text>
                <Text style={s.statLabel}>Accuracy</Text>
              </View>
              <View style={s.stat}>
                <Text style={[s.statValue, { color: '#10b981' }]}>{wins}</Text>
                <Text style={s.statLabel}>Wins</Text>
              </View>
              <View style={s.stat}>
                <Text style={[s.statValue, { color: '#ef4444' }]}>{losses}</Text>
                <Text style={s.statLabel}>Losses</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statValue}>{completed.length}</Text>
                <Text style={s.statLabel}>Total</Text>
              </View>
            </TouchableOpacity>

            {/* Games List */}
            {games.length > 0 ? (
              <View style={s.gamesSection}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>Today's Matchups</Text>
                  <TouchableOpacity style={s.infoButton} onPress={() => setShowInfoModal(true)}>
                    <Text style={s.infoButtonText}>i</Text>
                  </TouchableOpacity>
                </View>

                {games.map((game) => {
                  const userPick = picks.userPicks.find((p: Pick) => p.gameId === String(game.id));
                  const isBestBet = picks.lock?.gameId === String(game.id);
                  const smartPick = isBestBet ? picks.lock : picks.smartPicks.find((p: Pick) => p.gameId === String(game.id));
                  const isFuture = game.gameState === 'FUT' || game.gameState === 'PRE';
                  const isLive = game.gameState === 'LIVE';
                  const gameStarted = !isFuture;
                  const isFinal = gameStarted && !isLive;
                  const currentPeriod = game.periodDescriptor?.number || 1;
                  const homeScore = game.homeTeam?.score;
                  const awayScore = game.awayTeam?.score;
                  // Allow picks if game is future OR if live and before 3rd period
                  const canMakePick = isFuture || (isLive && currentPeriod < 3);

                  // Get prediction data
                  const gameProb = getProbability(game.homeTeam?.abbrev || '', game.awayTeam?.abbrev || '', String(game.id));
                  const predictedTeam = gameProb.homeWinProb > gameProb.awayWinProb ? game.homeTeam?.abbrev : game.awayTeam?.abbrev;
                  const confidenceInfo = getConfidenceInfo(gameProb.homeWinProb, gameProb.awayWinProb);

                  // Get team standings for records and streaks
                  const homeStandings = getTeamStandings(game.homeTeam?.abbrev || '');
                  const awayStandings = getTeamStandings(game.awayTeam?.abbrev || '');
                  const homeStreak = getStreakInfo(homeStandings?.streakCode);
                  const awayStreak = getStreakInfo(awayStandings?.streakCode);

                  // Get badge to display using priority system
                  const badge = getBadgeToDisplay(
                    isLive,
                    isFinal,
                    isBestBet && !gameStarted,
                    !!smartPick && !gameStarted,
                    currentPeriod,
                    predictedTeam
                  );

                  return (
                    <TouchableOpacity
                      key={game.id}
                      style={s.enhancedGameCard}
                      onPress={() => setModalGame(game)}
                      activeOpacity={0.8}
                    >
                      {/* Header: Time, Status, Confidence */}
                      <View style={s.cardHeader}>
                        <View style={s.cardHeaderLeft}>
                          <Text style={s.gameTime}>
                            {new Date(game.startTimeUTC).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </Text>
                          {badge && (
                            <View style={[
                              s.badgeContainer,
                              badge.type === 'live' && { backgroundColor: '#ef444422' },
                              badge.type === 'final' && { backgroundColor: '#98a6bf22' },
                              badge.type === 'bestbet' && { backgroundColor: '#fbbf2422' },
                              badge.type === 'ai' && { backgroundColor: '#10b98122' },
                            ]}>
                              <Text style={[
                                s.badgeText,
                                { color: badge.color }
                              ]}>
                                {badge.text}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {userPick?.outcome && (
                            <View style={[s.outcomeBadge, { backgroundColor: userPick.outcome === 'win' ? '#10b98122' : '#ef444422', marginRight: 6 }]}>
                              <Text style={{ fontSize: 11, fontWeight: '800', color: userPick.outcome === 'win' ? '#10b981' : '#ef4444' }}>
                                {userPick.outcome === 'win' ? 'WIN' : 'LOSS'}
                              </Text>
                            </View>
                          )}
                          <View style={[s.confidenceBadge, { backgroundColor: confidenceInfo.bg }]}>
                            <Text style={[s.confidenceText, { color: confidenceInfo.color }]}>
                              {confidenceInfo.text}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Teams Row with Records and Streaks */}
                      <View style={s.teamsContainer}>
                        {/* Away Team */}
                        <Animated.View style={{
                          flex: 1,
                          transform: [{ scale: lastPickedGame === `${game.id}-${game.awayTeam?.abbrev}` ? 0.95 : 1 }]
                        }}>
                          <TouchableOpacity
                            style={[
                              s.enhancedTeamBtn,
                              userPick?.predictedWinner === game.awayTeam?.abbrev && s.pickedTeam,
                              predictedTeam === game.awayTeam?.abbrev && s.favoredTeam,
                              !canMakePick && s.disabledTeam
                            ]}
                            onPress={() => canMakePick && makePick(String(game.id), game.awayTeam?.abbrev, game.homeTeam?.abbrev, game.awayTeam?.abbrev, game.startTimeUTC)}
                            disabled={!canMakePick}
                          >
                            <Text style={s.teamAbbrev}>{game.awayTeam?.abbrev}</Text>
                            {gameStarted && awayScore !== undefined ? (
                              <Text style={[s.teamScore, getScoreStyle(awayScore, homeScore ?? 0, gameStarted)]}>
                                {awayScore}
                              </Text>
                            ) : (
                              <>
                                <Text style={s.teamRecord}>{formatRecord(awayStandings)}</Text>
                                <Text style={[s.teamStreak, { color: awayStreak.color }]}>{awayStreak.text}</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </Animated.View>

                        {/* VS Divider */}
                        <View style={s.vsDivider}>
                          <Text style={s.vsText}>@</Text>
                        </View>

                        {/* Home Team */}
                        <Animated.View style={{
                          flex: 1,
                          transform: [{ scale: lastPickedGame === `${game.id}-${game.homeTeam?.abbrev}` ? 0.95 : 1 }]
                        }}>
                          <TouchableOpacity
                            style={[
                              s.enhancedTeamBtn,
                              userPick?.predictedWinner === game.homeTeam?.abbrev && s.pickedTeam,
                              predictedTeam === game.homeTeam?.abbrev && s.favoredTeam,
                              !canMakePick && s.disabledTeam
                            ]}
                            onPress={() => canMakePick && makePick(String(game.id), game.homeTeam?.abbrev, game.homeTeam?.abbrev, game.awayTeam?.abbrev, game.startTimeUTC)}
                            disabled={!canMakePick}
                          >
                            <Text style={s.teamAbbrev}>{game.homeTeam?.abbrev}</Text>
                            {gameStarted && homeScore !== undefined ? (
                              <Text style={[s.teamScore, getScoreStyle(homeScore, awayScore ?? 0, gameStarted)]}>
                                {homeScore}
                              </Text>
                            ) : (
                              <>
                                <Text style={s.teamRecord}>{formatRecord(homeStandings)}</Text>
                                <Text style={[s.teamStreak, { color: homeStreak.color }]}>{homeStreak.text}</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </Animated.View>
                      </View>

                      {/* Win Probability Bar - Show for all games */}
                      <View style={s.probContainer}>
                        <View style={s.probLabels}>
                          <Text style={s.probLabel}>{gameProb.awayWinProb}%</Text>
                          <Text style={[s.probLabelCenter, { opacity: gameStarted ? 1 : 0 }]}>AI Prediction</Text>
                          <Text style={s.probLabel}>{gameProb.homeWinProb}%</Text>
                        </View>
                        <View style={s.probBar}>
                          <View style={[s.probFillAway, { width: `${gameProb.awayWinProb}%` }]} />
                          <View style={[s.probFillHome, { width: `${gameProb.homeWinProb}%` }]} />
                        </View>
                      </View>

                      {/* Footer: Pick status or More Info hint */}
                      <View style={s.cardFooter}>
                        {userPick ? (
                          <Text style={s.pickedStatus}>Your pick: {userPick.predictedWinner}</Text>
                        ) : (
                          <Text style={s.moreInfoHint}>Tap for detailed analysis</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={[styles.title, { marginBottom: 8, textAlign: 'center', fontSize: 18 }]}>
                  No Games Today
                </Text>
                <Text style={[styles.subtextLarge, { textAlign: 'center', marginBottom: 12 }]}>
                  No games scheduled today
                </Text>
                <Text style={[styles.subtext, { textAlign: 'center', lineHeight: 20 }]}>
                  Check back {getFormattedDate(getTomorrowDateString())} for tomorrow's matchups!
                </Text>
                <Text style={[styles.subtext, { textAlign: 'center', marginTop: 12, fontStyle: 'italic', opacity: 0.8 }]}>
                  View other tabs for team analytics and power rankings
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Game Details Modal */}
      {modalGame && standings && (() => {
        const home = standings.standings?.find((t: any) => (t.teamAbbrev?.default || t.teamAbbrev) === modalGame.homeTeam?.abbrev);
        const away = standings.standings?.find((t: any) => (t.teamAbbrev?.default || t.teamAbbrev) === modalGame.awayTeam?.abbrev);

        // Enrich game with standings data (same pattern as home page)
        const enrichedGame = {
          ...modalGame,
          homeTeam: { ...home, abbrev: home?.teamAbbrev?.default || home?.teamAbbrev, ...modalGame.homeTeam },
          awayTeam: { ...away, abbrev: away?.teamAbbrev?.default || away?.teamAbbrev, ...modalGame.awayTeam }
        };

        return (
          <GameDeepDiveModal
            visible={!!modalGame}
            onClose={() => setModalGame(null)}
            game={enrichedGame}
            prediction={getProbability(modalGame.homeTeam?.abbrev || '', modalGame.awayTeam?.abbrev || '', String(modalGame.id))}
          />
        );
      })()}

      {/* Info Modal */}
      <Modal
        visible={showInfoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowInfoModal(false)}
        >
          <TouchableOpacity style={styles.modalContainer} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>How to Make Picks</Text>
            <Text style={styles.modalText}>
              {'\u2022'} Tap on a team to make your pick{'\n'}
              {'\u2022'} You can change your pick anytime before the 3rd period starts{'\n'}
              {'\u2022'} Once the 3rd period begins, picks are locked{'\n'}
              {'\u2022'} Games marked TOP are our highest confidence picks{'\n'}
              {'\u2022'} Games marked AI show our AI predictions{'\n'}
              {'\u2022'} Tap the i icon to view detailed game analysis{'\n'}
              {'\u2022'} Your pick history and accuracy are tracked above
            </Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowInfoModal(false)}>
              <Text style={styles.modalButtonText}>Got it</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Pick History Modal */}
      <PickHistoryModal
        visible={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        onHistoryCleared={async () => {
          // Reload picks data after clearing history
          const freshPicks = await getAllPicks();
          setAllPicks(freshPicks);
        }}
      />
    </ThemedView>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  loading: {
    padding: 40,
    alignItems: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 20,
    width: '100%',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.subtext,
    textTransform: 'uppercase',
  },
  gamesSection: {
    width: '100%',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  infoButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.accent,
  },
  infoButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.accent,
  },
  gameRow: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  gameInfo: {
    width: 60,
    gap: 2,
  },
  gameTime: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.subtext,
  },
  topPickTag: {
    fontSize: 10,
    color: '#fbbf24',
    fontWeight: '700',
  },
  smartTag: {
    fontSize: 9,
    color: '#10b981',
    fontWeight: '600',
  },
  liveTag: {
    fontSize: 9,
    color: '#ef4444',
    fontWeight: '700',
  },
  finalTag: {
    fontSize: 9,
    color: theme.subtext,
    fontWeight: '600',
  },
  matchup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamBtn: {
    flex: 1,
    backgroundColor: theme.subtle,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 44,
  },
  picked: {
    backgroundColor: '#1e3a8a',
    borderColor: theme.accent,
  },
  disabled: {
    opacity: 0.6,
    backgroundColor: theme.card,
  },
  teamText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
  },
  scoreText: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.accent,
    marginTop: 4,
  },
  vs: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.subtext,
    opacity: 0.3,
  },
  action: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.subtle,
    borderRadius: 18,
  },
  result: {
    fontSize: 16,
    fontWeight: '800',
  },
  selected: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.accent,
  },
  info: {
    fontSize: 16,
    color: theme.subtext,
    opacity: 0.5,
  },

  // Enhanced Game Card Styles
  enhancedGameCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    width: '100%',
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: '#334e8d44',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  badgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700',
  },
  outcomeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 8,
  },
  enhancedTeamBtn: {
    flex: 1,
    backgroundColor: theme.subtle,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 58,
  },
  pickedTeam: {
    backgroundColor: '#1e3a8a',
    borderColor: theme.accent,
  },
  favoredTeam: {
    borderColor: '#10b98166',
  },
  disabledTeam: {
    opacity: 0.6,
  },
  teamAbbrev: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 2,
  },
  teamRecord: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
    marginBottom: 1,
  },
  teamStreak: {
    fontSize: 10,
    fontWeight: '700',
  },
  teamScore: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  vsDivider: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
    marginHorizontal: 2,
  },
  vsText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.subtext,
    opacity: 0.4,
  },
  probContainer: {
    marginBottom: 6,
  },
  probLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  probLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.subtext,
  },
  probLabelCenter: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.subtext,
    opacity: 0.7,
  },
  probBar: {
    height: 8,
    backgroundColor: '#192e5e44',
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  probFillAway: {
    height: '100%',
    backgroundColor: '#60a5fa',
  },
  probFillHome: {
    height: '100%',
    backgroundColor: '#f59e0b',
  },
  cardFooter: {
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#192e5e44',
  },
  pickedStatus: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.accent,
  },
  moreInfoHint: {
    fontSize: 10,
    fontWeight: '500',
    color: theme.subtext,
    opacity: 0.7,
  },
});
