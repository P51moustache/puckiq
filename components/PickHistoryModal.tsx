import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getAchievementsWithStatus } from '../constants/achievements';
import {
  clearUserPickHistory,
  DailyPicks,
  getPickHistoryByDate,
  getLockStats,
  getSmartPickStats,
  getUserPickStats,
  getUserStreakInfo,
  Pick,
  PickStats,
} from '../services/pickTracking';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { useAnalytics } from '../hooks/useAnalytics';
import AchievementBadge from './AchievementBadge';
import PickResultModal from './PickResultModal';
import StreakIndicator from './StreakIndicator';

interface PickHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  onHistoryCleared?: () => void;
}

type TabType = 'overview' | 'achievements' | 'history';
type FilterType = 'all' | 'user' | 'smart' | 'lock';

export default function PickHistoryModal({ visible, onClose, onHistoryCleared }: PickHistoryModalProps) {
  const analytics = useAnalytics();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  // Stats
  const [userStats, setUserStats] = useState<PickStats>({ total: 0, wins: 0, losses: 0, pushes: 0, accuracy: 0 });
  const [smartStats, setSmartStats] = useState<PickStats>({ total: 0, wins: 0, losses: 0, pushes: 0, accuracy: 0 });
  const [lockStats, setLockStats] = useState<PickStats>({ total: 0, wins: 0, losses: 0, pushes: 0, accuracy: 0 });
  const [streakInfo, setStreakInfo] = useState({ current: '', currentCount: 0, bestWinStreak: 0, worstLossStreak: 0 });
  const [history, setHistory] = useState<Record<string, DailyPicks>>({});
  const [recentPicks, setRecentPicks] = useState<Pick[]>([]);

  // Pick detail modal state
  const [selectedPick, setSelectedPick] = useState<Pick | null>(null);
  const [showPickModal, setShowPickModal] = useState(false);

  const handlePickPress = (pick: Pick) => {
    setSelectedPick(pick);
    setShowPickModal(true);
    // Track when user views a specific pick from history
    analytics.trackCustomEvent('history_pick_selected', {
      game_id: pick.gameId,
      pick_type: pick.type,
      outcome: pick.outcome,
      matchup: `${pick.awayTeam} @ ${pick.homeTeam}`,
    });
  };

  const handleClosePickModal = () => {
    setShowPickModal(false);
    setSelectedPick(null);
  };

  // Handle tab change with tracking
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    analytics.trackCustomEvent('history_tab_changed', {
      tab_name: tab,
    });
  };

  // Load data when modal opens
  useEffect(() => {
    if (visible) {
      loadData();
      // Track modal opened
      analytics.trackCustomEvent('pick_history_modal_opened', {
        source: 'pick_history_button',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]); // analytics methods are memoized, no need in deps

  const loadData = async () => {
    setLoading(true);
    try {
      const [userStatsData, smartStatsData, lockStatsData, streakData, historyData] = await Promise.all([
        getUserPickStats(),
        getSmartPickStats(),
        getLockStats(),
        getUserStreakInfo(),
        getPickHistoryByDate(),
      ]);

      setUserStats(userStatsData);
      setSmartStats(smartStatsData);
      setLockStats(lockStatsData);
      setStreakInfo(streakData);
      setHistory(historyData);

      // Get recent user picks for streak timeline
      const allPicks: Pick[] = [];
      Object.values(historyData).forEach(day => {
        allPicks.push(...day.userPicks.filter(p => p.outcome));
      });
      allPicks.sort((a, b) => b.date.localeCompare(a.date));
      setRecentPicks(allPicks.slice(0, 20));
    } catch (error) {
      console.error('Error loading pick history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Pick History',
      `Are you sure you want to delete all your picks?\n\nThis will remove:\n• ${userStats.total} user picks\n• Your ${userStats.accuracy}% accuracy record\n• All achievement progress\n\nAI picks (Smart Picks & Lock) will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear My Picks',
          style: 'destructive',
          onPress: async () => {
            try {
              // Track history cleared before actually clearing
              analytics.trackCustomEvent('pick_history_cleared', {
                total_picks_cleared: userStats.total,
                accuracy_at_clear: userStats.accuracy,
                wins_cleared: userStats.wins,
                losses_cleared: userStats.losses,
              });

              await clearUserPickHistory();
              await loadData();
              onHistoryCleared?.();
              Alert.alert('Success', 'Your pick history has been cleared.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear history. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Render comparison card
  const renderComparisonCard = (title: string, stats: PickStats, color: string, rank: number) => {
    const getRankIcon = (): { name: keyof typeof Ionicons.glyphMap; color: string } | null => {
      if (rank === 1) return { name: 'trophy', color: '#fbbf24' };
      if (rank === 2) return { name: 'medal-outline', color: '#c0c0c0' };
      if (rank === 3) return { name: 'medal-outline', color: '#cd7f32' };
      return null;
    };

    const rankIcon = getRankIcon();

    return (
      <View style={[styles.comparisonCard, { borderColor: color }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{title}</Text>
          {rankIcon && <Ionicons name={rankIcon.name} size={24} color={rankIcon.color} />}
        </View>

        {/* Circular Progress */}
        <View style={styles.progressCircleContainer}>
          <View style={[styles.progressCircle, { borderColor: color }]}>
            <Text style={[styles.accuracyText, { color }]}>{stats.accuracy}%</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.cardStats}>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatValue}>{stats.wins}</Text>
            <Text style={styles.cardStatLabel}>Wins</Text>
          </View>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatValue}>{stats.losses}</Text>
            <Text style={styles.cardStatLabel}>Losses</Text>
          </View>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatValue}>{stats.total}</Text>
            <Text style={styles.cardStatLabel}>Total</Text>
          </View>
        </View>
      </View>
    );
  };

  // Render Overview Tab
  const renderOverviewTab = () => {
    // Rank the pick types by accuracy
    const ranked = [
      { title: 'Your Picks', stats: userStats, color: theme.accent, type: 'user' },
      { title: 'Smart Picks', stats: smartStats, color: theme.semantic.positive, type: 'smart' },
      { title: 'Lock of the Day', stats: lockStats, color: '#f59e0b', type: 'lock' },
    ].sort((a, b) => b.stats.accuracy - a.stats.accuracy);

    ranked.forEach((item, idx) => {
      (item as any).rank = idx + 1;
    });

    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Pick Type Comparison</Text>
        <Text style={styles.sectionSubtitle}>See how your picks stack up against AI</Text>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Cards are ranked by accuracy. Compare your picks against AI to see if you're beating the algorithm!
          </Text>
        </View>

        <View style={styles.comparisonGrid}>
          {ranked.map(item => (
            <React.Fragment key={item.type}>
              {renderComparisonCard(item.title, item.stats, item.color, (item as any).rank)}
            </React.Fragment>
          ))}
        </View>

        {/* Streak Section */}
        {userStats.total > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Your Streak</Text>
            <Text style={styles.sectionSubtitle}>
              Track your hot and cold runs. Hot streaks appear at 3+ wins, cold streaks at 3+ losses.
            </Text>
            <StreakIndicator
              currentStreak={streakInfo.current}
              currentCount={streakInfo.currentCount}
              bestWinStreak={streakInfo.bestWinStreak}
              worstLossStreak={streakInfo.worstLossStreak}
              recentPicks={recentPicks}
            />
          </>
        )}
      </ScrollView>
    );
  };

  // Render Achievements Tab
  const renderAchievementsTab = () => {
    // Calculate consecutive days (simplified - would need date tracking for real implementation)
    const consecutiveDays = Object.keys(history).filter(date => {
      const dayPicks = history[date];
      return dayPicks.userPicks.length > 0;
    }).length;

    const achievements = getAchievementsWithStatus({
      totalPicks: userStats.total,
      accuracy: userStats.accuracy,
      bestStreak: streakInfo.bestWinStreak,
      userAccuracy: userStats.accuracy,
      smartPickAccuracy: smartStats.accuracy,
      consecutiveDays,
    });

    const unlocked = achievements.filter(a => a.unlocked);
    const locked = achievements.filter(a => !a.unlocked);

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.achievementHeader}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <Text style={styles.achievementCount}>
            {unlocked.length} / {achievements.length} Unlocked
          </Text>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Earn badges by making picks, maintaining accuracy, and building streaks. Progress bars show how close you are to unlocking each achievement!
          </Text>
        </View>

        {/* Unlocked Badges */}
        {unlocked.length > 0 && (
          <>
            <Text style={styles.subsectionTitle}>Unlocked</Text>
            <View style={styles.badgeGrid}>
              {unlocked.map(achievement => (
                <AchievementBadge key={achievement.id} achievement={achievement} />
              ))}
            </View>
          </>
        )}

        {/* Locked Badges */}
        {locked.length > 0 && (
          <>
            <Text style={[styles.subsectionTitle, { marginTop: 16 }]}>Locked</Text>
            <View style={styles.badgeGrid}>
              {locked.map(achievement => (
                <AchievementBadge key={achievement.id} achievement={achievement} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    );
  };

  // Render History Tab
  const renderHistoryTab = () => {
    const dates = Object.keys(history).sort().reverse();
    const filteredDates = dates.filter(date => {
      const day = history[date];
      if (filter === 'user') return day.userPicks.some(p => p.outcome);
      if (filter === 'smart') return day.smartPicks.some(p => p.outcome);
      if (filter === 'lock') return day.lock && day.lock.outcome;
      return (day.userPicks.length > 0 || day.smartPicks.length > 0 || day.lock);
    });

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            View all completed picks by date. LOCK = Lock of the Day, AI = Smart Pick. Filter by pick type to compare performance.
          </Text>
        </View>

        {/* Filter Controls */}
        <View style={styles.filterContainer}>
          {(['all', 'user', 'smart', 'lock'] as FilterType[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterButton, filter === f && styles.filterButtonActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'All' : f === 'user' ? 'Your Picks' : f === 'smart' ? 'Smart' : 'Lock'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* History List */}
        {filteredDates.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No pick history yet</Text>
            <Text style={styles.emptySubtext}>Start making picks to build your history!</Text>
          </View>
        ) : (
          filteredDates.map(date => {
            const day = history[date];
            const dateObj = new Date(date + 'T00:00:00');
            const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            // Filter picks based on active filter
            let displayPicks: Pick[] = [];
            if (filter === 'all') {
              displayPicks = [
                ...(day.lock ? [day.lock] : []),
                ...day.smartPicks,
                ...day.userPicks,
              ];
            } else if (filter === 'user') {
              displayPicks = day.userPicks;
            } else if (filter === 'smart') {
              displayPicks = day.smartPicks;
            } else if (filter === 'lock' && day.lock) {
              displayPicks = [day.lock];
            }

            const completedPicks = displayPicks.filter(p => p.outcome);
            if (completedPicks.length === 0) return null;

            const wins = completedPicks.filter(p => p.outcome === 'win').length;
            const losses = completedPicks.filter(p => p.outcome === 'loss').length;

            return (
              <View key={date} style={styles.historyDay}>
                {/* Date Header */}
                <View style={styles.historyDateHeader}>
                  <View>
                    <Text style={styles.historyDate}>{formattedDate}</Text>
                    <Text style={styles.historyDayOfWeek}>{dayOfWeek}</Text>
                  </View>
                  <View style={styles.historyDayStats}>
                    <Text style={[styles.historyWL, { color: theme.semantic.positive }]}>{wins}W</Text>
                    <Text style={styles.historyDash}>-</Text>
                    <Text style={[styles.historyWL, { color: theme.semantic.negative }]}>{losses}L</Text>
                  </View>
                </View>

                {/* Picks */}
                {completedPicks.map((pick, idx) => (
                  <Pressable
                    key={`${pick.gameId}-${idx}`}
                    style={({ pressed }) => [
                      styles.historyPick,
                      pressed && styles.historyPickPressed,
                    ]}
                    onPress={() => handlePickPress(pick)}
                  >
                    <View style={[
                      styles.historyOutcome,
                      pick.outcome === 'win' && styles.historyOutcomeWin,
                      pick.outcome === 'loss' && styles.historyOutcomeLoss,
                    ]}>
                      <Text style={styles.historyOutcomeText}>
                        {pick.outcome === 'win' ? '✓' : '✗'}
                      </Text>
                    </View>
                    <View style={styles.historyPickInfo}>
                      <Text style={styles.historyMatchup}>
                        {pick.awayTeam} @ {pick.homeTeam}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.historyPrediction}>
                          Picked: {pick.predictedWinner}
                        </Text>
                        {pick.type === 'lock' && (
                          <Ionicons name="lock-closed" size={11} color={theme.subtext} />
                        )}
                        {pick.type === 'smart-pick' && (
                          <Ionicons name="hardware-chip-outline" size={11} color={theme.subtext} />
                        )}
                      </View>
                    </View>
                    <Text style={styles.historyChevron}>›</Text>
                  </Pressable>
                ))}
              </View>
            );
          })
        )}

        {/* Clear History Button */}
        {userStats.total > 0 && (
          <>
            <View style={styles.clearInfoBox}>
              <Text style={styles.clearInfoText}>
                Clearing history removes only YOUR picks. AI picks (Smart Picks & Lock) are preserved so you can continue comparing your performance against them.
              </Text>
            </View>
            <TouchableOpacity style={styles.clearButton} onPress={handleClearHistory}>
              <Text style={styles.clearButtonText}>Clear My Pick History</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Pick History</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={theme.text} />
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {(['overview', 'achievements', 'history'] as TabType[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => handleTabChange(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#60a5fa" />
              <Text style={styles.loadingText}>Loading your history...</Text>
            </View>
          ) : (
            <>
              {activeTab === 'overview' && renderOverviewTab()}
              {activeTab === 'achievements' && renderAchievementsTab()}
              {activeTab === 'history' && renderHistoryTab()}
            </>
          )}
        </View>
      </View>

      {/* Pick Result Modal */}
      <PickResultModal
        visible={showPickModal}
        onClose={handleClosePickModal}
        pick={selectedPick}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '90%',
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#192e5e44',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#192e5e44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#192e5e44',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: theme.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.subtext,
    textAlign: 'center',
  },
  tabTextActive: {
    color: theme.accent,
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: theme.subtext,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: theme.subtext,
    marginBottom: 16,
  },
  comparisonGrid: {
    gap: 12,
  },
  comparisonCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  progressCircleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  progressCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#071a3699',
  },
  accuracyText: {
    fontSize: 24,
    fontWeight: '900',
  },
  cardStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  cardStat: {
    alignItems: 'center',
  },
  cardStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  cardStatLabel: {
    fontSize: 10,
    color: theme.subtext,
    textTransform: 'uppercase',
  },
  achievementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  achievementCount: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.subtext,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#192e5e44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#60a5fa22',
    borderWidth: 1,
    borderColor: theme.accent,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.subtext,
    textAlign: 'center',
  },
  filterTextActive: {
    color: theme.accent,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  emptySubtext: {
    fontSize: 12,
    color: theme.subtext,
  },
  historyDay: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  historyDateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#192e5e44',
  },
  historyDate: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  historyDayOfWeek: {
    fontSize: 12,
    color: theme.subtext,
  },
  historyDayStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyWL: {
    fontSize: 16,
    fontWeight: '700',
  },
  historyDash: {
    fontSize: 14,
    color: theme.subtext,
  },
  historyPick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 8,
  },
  historyPickPressed: {
    backgroundColor: '#334e8d44',
  },
  historyChevron: {
    fontSize: 18,
    color: theme.subtext,
    marginLeft: 'auto',
  },
  historyOutcome: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  historyOutcomeWin: {
    backgroundColor: '#10b98122',
    borderColor: theme.semantic.positive,
  },
  historyOutcomeLoss: {
    backgroundColor: '#ef444422',
    borderColor: theme.semantic.negative,
  },
  historyOutcomeText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  historyPickInfo: {
    flex: 1,
  },
  historyMatchup: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  historyPrediction: {
    fontSize: 11,
    color: theme.subtext,
  },
  clearButton: {
    backgroundColor: '#ef444422',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: theme.semantic.negative,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.semantic.negative,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#60a5fa22',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#60a5fa',
  },
  infoText: {
    fontSize: 12,
    color: theme.text,
    lineHeight: 18,
  },
  clearInfoBox: {
    backgroundColor: '#ef444422',
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  clearInfoText: {
    fontSize: 11,
    color: theme.text,
    lineHeight: 16,
  },
});
