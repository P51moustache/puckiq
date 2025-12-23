import React, { useEffect, useState } from 'react';
import {
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import GameDeepDiveModal from '../../components/GameDeepDiveModal';
import PickHistoryModal from '../../components/PickHistoryModal';
import StreakBadge from '../../components/StreakBadge';
import { ThemedView } from '../../components/ThemedView';
import { Skeleton } from '../../components/ui/SkeletonLoader';
import { makeStyles, theme } from '../../constants/theme';
import {
  addUserPick,
  getAllPicks,
  getPicksForDate,
  getTodayDateString,
  Pick,
} from '../../services/pickTracking';
import { getStreakData, StreakData } from '../../services/streakTracking';
import { addNotificationResponseListener } from '../../services/notifications';
import { getPredictedWinner, calculateWinProbability } from '../../utils/predictionHelpers';

export default function MyPicksScreen() {
  const styles = makeStyles();

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

      if (gamesRes.ok) {
        const data = await gamesRes.json();
        console.log('[MY PICKS] Today date:', today);
        console.log('[MY PICKS] Current date from API:', data.currentDate);
        console.log('[MY PICKS] Total games from API:', data.games?.length);
        const todaysGames = (data.games || []).filter((game: any) => {
          console.log('[MY PICKS] Game date:', game.gameDate, 'Match:', game.gameDate === today);
          return game.gameDate === today;
        });
        console.log('[MY PICKS] Filtered games for today:', todaysGames.length);
        setGames(todaysGames);
      }

      if (standingsRes.ok) {
        setStandings(await standingsRes.json());
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Make pick
  const makePick = async (gameId: string, team: string, homeTeam: string, awayTeam: string) => {
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

  // Badge helper with priority system: LIVE > FINAL > LOCK > AI
  const getBadgeToDisplay = (
    isLive: boolean,
    isFinal: boolean,
    isLock: boolean,
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
    if (isLock) {
      return { text: 'LOCK', color: '#fbbf24', type: 'lock' };
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

  // Use centralized win probability calculation for consistency with Today screen
  const getProbability = (homeAbbrev: string, awayAbbrev: string) => {
    return calculateWinProbability(homeAbbrev, awayAbbrev, standings);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
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
          <View style={{ width: '100%' }}>
            {/* Stats skeleton */}
            <View style={[s.statsBar, { marginBottom: 16 }]}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={s.stat}>
                  <Skeleton width={40} height={28} style={{ marginBottom: 4 }} />
                  <Skeleton width={50} height={12} />
                </View>
              ))}
            </View>
            {/* Games skeleton */}
            <View style={[styles.card, { padding: 16 }]}>
              <Skeleton width={140} height={20} style={{ marginBottom: 16 }} />
              {[1, 2, 3].map((i) => (
                <View key={i} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Skeleton width={100} height={16} />
                    <Skeleton width={60} height={16} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Skeleton width="48%" height={44} borderRadius={10} />
                    <Skeleton width="48%" height={44} borderRadius={10} />
                  </View>
                </View>
              ))}
            </View>
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
                  const isLock = picks.lock?.gameId === String(game.id);
                  const smartPick = isLock ? picks.lock : picks.smartPicks.find((p: Pick) => p.gameId === String(game.id));
                  const isFuture = game.gameState === 'FUT' || game.gameState === 'PRE';
                  const isLive = game.gameState === 'LIVE';
                  const gameStarted = !isFuture;
                  const isFinal = gameStarted && !isLive;
                  const currentPeriod = game.periodDescriptor?.number || 1;
                  const homeScore = game.homeTeam?.score;
                  const awayScore = game.awayTeam?.score;
                  // Allow picks if game is future OR if live and before 3rd period
                  const canMakePick = isFuture || (isLive && currentPeriod < 3);

                  // Get badge to display using priority system
                  const predictedTeam = standings ? getPredictedWinner(game.homeTeam?.abbrev || '', game.awayTeam?.abbrev || '', standings) : undefined;
                  const badge = getBadgeToDisplay(
                    isLive,
                    isFinal,
                    isLock && !gameStarted,
                    !!smartPick && !gameStarted,
                    currentPeriod,
                    predictedTeam
                  );

                  return (
                    <View key={game.id} style={s.gameRow}>
                      {/* Time & Badges */}
                      <View style={s.gameInfo}>
                        <Text style={s.gameTime}>
                          {new Date(game.startTimeUTC).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </Text>
                        {badge && (
                          <Text style={[
                            badge.type === 'live' && s.liveTag,
                            badge.type === 'final' && s.finalTag,
                            badge.type === 'lock' && s.lockTag,
                            badge.type === 'ai' && s.smartTag,
                          ]}>
                            {badge.text}
                          </Text>
                        )}
                      </View>

                      {/* Matchup */}
                      <View style={s.matchup}>
                        <Animated.View style={{
                          flex: 1,
                          transform: [{
                            scale: lastPickedGame === `${game.id}-${game.awayTeam?.abbrev}` ? 0.95 : 1
                          }]
                        }}>
                          <TouchableOpacity
                            style={[
                              s.teamBtn,
                              userPick?.predictedWinner === game.awayTeam?.abbrev && s.picked,
                              !canMakePick && s.disabled
                            ]}
                            onPress={() => canMakePick && makePick(String(game.id), game.awayTeam?.abbrev, game.homeTeam?.abbrev, game.awayTeam?.abbrev)}
                            disabled={!canMakePick}
                          >
                            <Text style={s.teamText}>{game.awayTeam?.abbrev}</Text>
                            {gameStarted && awayScore !== undefined && (
                              <Text style={[
                                s.scoreText,
                                getScoreStyle(awayScore, homeScore ?? 0, gameStarted)
                              ]}>
                                {awayScore}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </Animated.View>

                        <Text style={s.vs}>@</Text>

                        <Animated.View style={{
                          flex: 1,
                          transform: [{
                            scale: lastPickedGame === `${game.id}-${game.homeTeam?.abbrev}` ? 0.95 : 1
                          }]
                        }}>
                          <TouchableOpacity
                            style={[
                              s.teamBtn,
                              userPick?.predictedWinner === game.homeTeam?.abbrev && s.picked,
                              !canMakePick && s.disabled
                            ]}
                            onPress={() => canMakePick && makePick(String(game.id), game.homeTeam?.abbrev, game.homeTeam?.abbrev, game.awayTeam?.abbrev)}
                            disabled={!canMakePick}
                          >
                            <Text style={s.teamText}>{game.homeTeam?.abbrev}</Text>
                            {gameStarted && homeScore !== undefined && (
                              <Text style={[
                                s.scoreText,
                                getScoreStyle(homeScore, awayScore ?? 0, gameStarted)
                              ]}>
                                {homeScore}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </Animated.View>
                      </View>

                      {/* Status / Action */}
                      <TouchableOpacity style={s.action} onPress={() => setModalGame(game)}>
                        {userPick?.outcome ? (
                          <Text style={[s.result, { color: userPick.outcome === 'win' ? '#10b981' : '#ef4444' }]}>
                            {userPick.outcome === 'win' ? 'W' : 'L'}
                          </Text>
                        ) : userPick && !gameStarted ? (
                          <Text style={s.selected}>P</Text>
                        ) : (
                          <Text style={s.info}>i</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={[styles.title, { marginBottom: 8, textAlign: 'center', fontSize: 18 }]}>
                  🏒 No Games Today
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
            prediction={getProbability(modalGame.homeTeam?.abbrev || '', modalGame.awayTeam?.abbrev || '')}
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
              • Tap on a team to make your pick{'\n'}
              • You can change your pick anytime before the 3rd period starts{'\n'}
              • Once the 3rd period begins, picks are locked{'\n'}
              • Games marked LOCK are our highest confidence picks{'\n'}
              • Games marked AI show our AI predictions{'\n'}
              • Tap the i icon to view detailed game analysis{'\n'}
              • Your pick history and accuracy are tracked above
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
    gap: 12,
    width: '100%',
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
  lockTag: {
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
});
