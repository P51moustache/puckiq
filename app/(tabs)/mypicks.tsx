import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { ThemedView } from '../../components/ThemedView';
import { useAnalytics } from '../../hooks/useAnalytics';
import { ShareableCard } from '../../components/ShareableCard';
import type { ShareableStatData } from '../../components/ShareableCard';
import { ConfidenceBadge } from '../../components/ConfidenceBadge';
import AccuracyTrendsCard from '../../components/AccuracyTrendsCard';
import { getAllPicks, getUserPickStats, getSmartPickStats, getLockStats, getRollingStats } from '../../services/pickTracking';
import type { Pick, PickStats } from '../../services/pickTracking';

interface GroupedPicks {
  date: string;
  picks: Pick[];
}

function groupPicksByDate(picks: Pick[]): GroupedPicks[] {
  const grouped: Record<string, Pick[]> = {};

  for (const pick of picks) {
    if (!grouped[pick.date]) {
      grouped[pick.date] = [];
    }
    grouped[pick.date].push(pick);
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, datePicks]) => ({ date, picks: datePicks }));
}

function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    ) {
      return 'Today';
    }

    if (
      date.getFullYear() === yesterday.getFullYear() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getDate() === yesterday.getDate()
    ) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getPickTypeLabel(type: Pick['type']): string {
  switch (type) {
    case 'lock':
      return 'Lock';
    case 'smart-pick':
      return 'AI Pick';
    case 'user-pick':
      return 'Your Pick';
    default:
      return 'Pick';
  }
}

export default function MyPicksScreen() {
  const router = useRouter();
  const analytics = useAnalytics('MyPicks');

  const [overallStats, setOverallStats] = useState<PickStats | null>(null);
  const [smartStats, setSmartStats] = useState<PickStats | null>(null);
  const [lockStats, setLockStats] = useState<PickStats | null>(null);
  const [rollingStats, setRollingStats] = useState<PickStats | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [overall, smart, lock, rolling, allPicks] = await Promise.allSettled([
        getUserPickStats(),
        getSmartPickStats(),
        getLockStats(),
        getRollingStats(30),
        getAllPicks(),
      ]);

      if (overall.status === 'fulfilled') setOverallStats(overall.value);
      if (smart.status === 'fulfilled') setSmartStats(smart.value);
      if (lock.status === 'fulfilled') setLockStats(lock.value);
      if (rolling.status === 'fulfilled') setRollingStats(rolling.value);
      if (allPicks.status === 'fulfilled') setPicks(allPicks.value);
    } catch (error) {
      console.error('[MY PICKS] Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    analytics.trackCustomEvent('mypicks_refresh');
    loadData();
  }, [loadData, analytics]);

  const handleSettingsPress = useCallback(() => {
    analytics.trackCustomEvent('mypicks_settings_tap');
    router.push('/settings');
  }, [router, analytics]);

  const groupedPicks = groupPicksByDate(picks);
  const hasPicks = picks.length > 0;

  const shareableData: ShareableStatData | null = rollingStats
    ? {
        accuracy: Math.round(rollingStats.accuracy),
        totalPicks: rollingStats.total,
        period: 'this month',
      }
    : null;

  return (
    <ThemedView style={s.container} testID="mypicks-tab">
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>My Picks</Text>
        <TouchableOpacity
          onPress={handleSettingsPress}
          style={s.settingsButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="settings-outline" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.text}
          />
        }
      >
        {!hasPicks && !loading ? (
          /* Empty State */
          <View style={s.emptyState}>
            <Ionicons name="basketball-outline" size={64} color={theme.subtext} />
            <Text style={s.emptyTitle}>No Picks Yet</Text>
            <Text style={s.emptySubtitle}>
              Make your first pick on the Today tab to start tracking.
            </Text>
          </View>
        ) : (
          <>
            {/* Accuracy Summary Card */}
            <View style={s.card} testID="mypicks-accuracy">
              <Text style={s.cardTitle}>Accuracy Summary</Text>

              {/* Main Stats Row */}
              <View style={s.statsRow}>
                <View style={s.statBox}>
                  <Text style={s.statValue}>
                    {overallStats ? `${Math.round(overallStats.accuracy)}%` : '--'}
                  </Text>
                  <Text style={s.statLabel}>Overall</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={[s.statValue, { color: '#4CAF50' }]}>
                    {overallStats ? overallStats.wins : '--'}
                  </Text>
                  <Text style={s.statLabel}>Wins</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={[s.statValue, { color: '#F44336' }]}>
                    {overallStats ? overallStats.losses : '--'}
                  </Text>
                  <Text style={s.statLabel}>Losses</Text>
                </View>
              </View>

              {/* Breakdown Row */}
              <View style={s.breakdownRow}>
                <View style={s.breakdownItem}>
                  <Ionicons name="flash" size={16} color="#FFD700" />
                  <Text style={s.breakdownLabel}>AI Picks</Text>
                  <Text style={s.breakdownValue}>
                    {smartStats ? `${Math.round(smartStats.accuracy)}%` : '--'}
                  </Text>
                </View>
                <View style={s.breakdownDivider} />
                <View style={s.breakdownItem}>
                  <Ionicons name="lock-closed" size={16} color="#4CAF50" />
                  <Text style={s.breakdownLabel}>Locks</Text>
                  <Text style={s.breakdownValue}>
                    {lockStats ? `${Math.round(lockStats.accuracy)}%` : '--'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Shareable Stat Card */}
            {shareableData && (
              <View style={s.card}>
                <ShareableCard type="stat" data={shareableData} />
              </View>
            )}

            {/* Accuracy Over Time Chart */}
            <AccuracyTrendsCard />

            {/* Pick History */}
            <View style={s.card} testID="mypicks-history">
              <Text style={s.cardTitle}>Pick History</Text>

              {groupedPicks.map((group) => (
                <View key={group.date} style={s.dateGroup}>
                  <Text style={s.dateHeader}>{formatDate(group.date)}</Text>

                  {group.picks.map((pick) => (
                    <View key={`${pick.gameId}-${pick.type}`} style={s.pickRow}>
                      <View style={s.pickInfo}>
                        <Text style={s.matchup}>
                          {pick.awayTeam} @ {pick.homeTeam}
                        </Text>
                        <View style={s.pickMeta}>
                          <Text style={s.pickType}>{getPickTypeLabel(pick.type)}</Text>
                          <Text style={s.pickPrediction}>
                            Picked: {pick.predictedWinner}
                          </Text>
                        </View>
                      </View>

                      <View style={s.pickRight}>
                        {pick.confidenceScore !== undefined && (
                          <ConfidenceBadge confidence={pick.confidenceScore} />
                        )}
                        <View
                          style={[
                            s.outcomeBadge,
                            pick.outcome === 'win' && s.outcomeBadgeWin,
                            pick.outcome === 'loss' && s.outcomeBadgeLoss,
                            pick.outcome === 'push' && s.outcomeBadgePush,
                            !pick.outcome && s.outcomeBadgePending,
                          ]}
                        >
                          <Text
                            style={[
                              s.outcomeBadgeText,
                              pick.outcome === 'win' && s.outcomeBadgeTextWin,
                              pick.outcome === 'loss' && s.outcomeBadgeTextLoss,
                              pick.outcome === 'push' && s.outcomeBadgeTextPush,
                              !pick.outcome && s.outcomeBadgeTextPending,
                            ]}
                          >
                            {pick.outcome === 'win'
                              ? 'W'
                              : pick.outcome === 'loss'
                                ? 'L'
                                : pick.outcome === 'push'
                                  ? 'P'
                                  : '\u2014'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Bottom spacer for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </ThemedView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: theme.background,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
  },
  settingsButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    color: theme.subtext,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },

  // Card
  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 15,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
  },
  statLabel: {
    fontSize: 13,
    color: theme.subtext,
    marginTop: 4,
  },

  // Breakdown Row
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  breakdownLabel: {
    fontSize: 13,
    color: theme.subtext,
  },
  breakdownValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  breakdownDivider: {
    width: 1,
    height: 20,
    backgroundColor: theme.subtext,
    opacity: 0.3,
    marginHorizontal: 12,
  },

  // Pick History
  dateGroup: {
    marginBottom: 16,
  },
  dateHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.subtext,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  pickInfo: {
    flex: 1,
    marginRight: 12,
  },
  matchup: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  pickMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickType: {
    fontSize: 12,
    color: theme.subtext,
    fontWeight: '500',
  },
  pickPrediction: {
    fontSize: 12,
    color: theme.subtext,
  },
  pickRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Outcome Badge
  outcomeBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeBadgeWin: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  outcomeBadgeLoss: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
  },
  outcomeBadgePush: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
  },
  outcomeBadgePending: {
    backgroundColor: 'rgba(158, 158, 158, 0.2)',
  },
  outcomeBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  outcomeBadgeTextWin: {
    color: '#4CAF50',
  },
  outcomeBadgeTextLoss: {
    color: '#F44336',
  },
  outcomeBadgeTextPush: {
    color: '#FFC107',
  },
  outcomeBadgeTextPending: {
    color: '#9E9E9E',
  },
});
