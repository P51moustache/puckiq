import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { theme } from '../../constants/theme';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { getAllPicks, calculatePickStats } from '../../services/pickTracking';
import { getStreakData } from '../../services/streakTracking';
import { getAccuracyHistory } from '../../utils/accuracyTracking';

// Mock factor data - TODO: implement factor-level tracking in pick service
const FACTOR_ACCURACY = [
  { name: 'Goaltending', accuracy: 73, picks: 45 },
  { name: 'Home Ice', accuracy: 66, picks: 89 },
  { name: 'Recent Form', accuracy: 61, picks: 52 },
  { name: 'Special Teams', accuracy: 55, picks: 34 },
  { name: 'Rest Advantage', accuracy: 49, picks: 41 },
  { name: 'Divisional', accuracy: 51, picks: 28 },
];

interface UserStats {
  overallAccuracy: number;
  totalPicks: number;
  currentStreak: number;
  longestStreak: number;
  bestWeek: { theme: string; accuracy: number };
  lessonsCompleted: number;
  totalLessons: number;
}

export default function MyIQScreen() {
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState<UserStats>({
    overallAccuracy: 0,
    totalPicks: 0,
    currentStreak: 0,
    longestStreak: 0,
    bestWeek: { theme: 'Goaltending', accuracy: 0 },
    lessonsCompleted: 0,
    totalLessons: 24,
  });

  useEffect(() => {
    loadUserData();
  }, []);

  async function loadUserData() {
    try {
      setLoading(true);

      // Fetch all picks and calculate stats
      const allPicks = await getAllPicks();
      const pickStats = calculatePickStats(allPicks);

      // Fetch streak data
      const streakData = await getStreakData();

      // Fetch accuracy history to find best week
      const accuracyHistory = await getAccuracyHistory();
      const sortedDates = Object.keys(accuracyHistory).sort().reverse();

      // Find best week (highest accuracy in last 7 days of any period)
      let bestWeekAccuracy = 0;
      for (let i = 0; i < sortedDates.length - 6; i++) {
        const weekDates = sortedDates.slice(i, i + 7);
        const weekAvg = Math.round(
          weekDates.reduce((sum, date) => sum + accuracyHistory[date].overallAccuracy, 0) / weekDates.length
        );
        if (weekAvg > bestWeekAccuracy) {
          bestWeekAccuracy = weekAvg;
        }
      }

      setUserStats({
        overallAccuracy: pickStats.accuracy,
        totalPicks: pickStats.total,
        currentStreak: streakData.currentStreak,
        longestStreak: streakData.longestStreak,
        bestWeek: { theme: 'Overall', accuracy: bestWeekAccuracy },
        lessonsCompleted: 0, // TODO: implement lessons tracking
        totalLessons: 24,
      });
    } catch (error) {
      console.error('[My IQ] Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  }

  const strengths = FACTOR_ACCURACY.filter(f => f.accuracy >= 60).slice(0, 3);
  const weaknesses = FACTOR_ACCURACY.filter(f => f.accuracy < 55).slice(0, 3);

  // Show loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading your stats...</Text>
      </View>
    );
  }

  // Show empty state if no picks yet
  if (userStats.totalPicks === 0) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <IconSymbol name="chart.bar.fill" size={64} color={theme.subtext} />
        <Text style={styles.emptyTitle}>No picks yet!</Text>
        <Text style={styles.emptySubtitle}>
          Make your first pick on the Today tab to start tracking your Hockey IQ.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Hockey IQ</Text>
        <Text style={styles.subtitle}>Track your progress</Text>
      </View>

      {/* Overall Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.mainStat}>
          <Text style={styles.mainStatValue}>{userStats.overallAccuracy}%</Text>
          <Text style={styles.mainStatLabel}>Overall Accuracy</Text>
        </View>
        <View style={styles.statsDivider} />
        <View style={styles.secondaryStats}>
          <View style={styles.secondaryStat}>
            <Text style={styles.secondaryStatValue}>{userStats.totalPicks}</Text>
            <Text style={styles.secondaryStatLabel}>Picks</Text>
          </View>
          <View style={styles.secondaryStat}>
            <Text style={styles.secondaryStatValue}>{userStats.currentStreak}</Text>
            <Text style={styles.secondaryStatLabel}>Streak</Text>
          </View>
        </View>
      </View>

      {/* Strengths */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="checkmark.circle.fill" size={18} color="#22c55e" />
          <Text style={styles.sectionTitle}>Your Strengths</Text>
        </View>
        <View style={styles.factorList}>
          {strengths.map((factor) => (
            <View key={factor.name} style={styles.factorRow}>
              <Text style={styles.factorName}>{factor.name}</Text>
              <View style={styles.factorStats}>
                <Text style={[styles.factorAccuracy, { color: '#22c55e' }]}>
                  {factor.accuracy}%
                </Text>
                <Text style={styles.factorPicks}>{factor.picks} picks</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Room to Grow */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="arrow.up.circle.fill" size={18} color="#f59e0b" />
          <Text style={styles.sectionTitle}>Room to Grow</Text>
        </View>
        <View style={styles.factorList}>
          {weaknesses.map((factor) => (
            <View key={factor.name} style={styles.factorRow}>
              <Text style={styles.factorName}>{factor.name}</Text>
              <View style={styles.factorStats}>
                <Text style={[styles.factorAccuracy, { color: '#f59e0b' }]}>
                  {factor.accuracy}%
                </Text>
                <Text style={styles.factorPicks}>{factor.picks} picks</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.growthTip}>
          This week focuses on Head-to-Head History. Practice makes perfect!
        </Text>
      </View>

      {/* Milestones */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="trophy.fill" size={18} color={theme.accent} />
          <Text style={styles.sectionTitle}>Milestones</Text>
        </View>
        <View style={styles.milestoneGrid}>
          <View style={styles.milestoneCard}>
            <Text style={styles.milestoneValue}>{userStats.longestStreak}</Text>
            <Text style={styles.milestoneLabel}>Longest Streak</Text>
          </View>
          <View style={styles.milestoneCard}>
            <Text style={styles.milestoneValue}>
              {userStats.bestWeek.accuracy > 0 ? `${userStats.bestWeek.accuracy}%` : 'N/A'}
            </Text>
            <Text style={styles.milestoneLabel}>Best Week</Text>
            {userStats.bestWeek.accuracy > 0 && (
              <Text style={styles.milestoneDetail}>{userStats.bestWeek.theme}</Text>
            )}
          </View>
          <View style={styles.milestoneCard}>
            <Text style={styles.milestoneValue}>
              {userStats.lessonsCompleted}/{userStats.totalLessons}
            </Text>
            <Text style={styles.milestoneLabel}>Lessons</Text>
          </View>
        </View>
      </View>

      {/* Encouragement */}
      <View style={styles.encouragement}>
        <Text style={styles.encouragementText}>
          You're beating the average hockey fan. Keep learning!
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 100,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: theme.subtext,
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: theme.subtext,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.text,
  },
  subtitle: {
    fontSize: 16,
    color: theme.subtext,
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainStat: {
    flex: 1,
    alignItems: 'center',
  },
  mainStatValue: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.accent,
  },
  mainStatLabel: {
    fontSize: 14,
    color: theme.subtext,
    marginTop: 4,
  },
  statsDivider: {
    width: 1,
    height: 60,
    backgroundColor: theme.subtle,
    marginHorizontal: 20,
  },
  secondaryStats: {
    flex: 1,
    gap: 16,
  },
  secondaryStat: {
    alignItems: 'center',
  },
  secondaryStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
  },
  secondaryStatLabel: {
    fontSize: 12,
    color: theme.subtext,
    marginTop: 2,
  },
  section: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  factorList: {
    gap: 12,
  },
  factorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factorName: {
    fontSize: 14,
    color: theme.text,
  },
  factorStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  factorAccuracy: {
    fontSize: 16,
    fontWeight: '700',
  },
  factorPicks: {
    fontSize: 12,
    color: theme.subtext,
    width: 55,
  },
  growthTip: {
    fontSize: 13,
    color: theme.subtext,
    fontStyle: 'italic',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.subtle,
  },
  milestoneGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  milestoneCard: {
    flex: 1,
    backgroundColor: theme.subtle,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  milestoneValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  milestoneLabel: {
    fontSize: 11,
    color: theme.subtext,
    marginTop: 4,
  },
  milestoneDetail: {
    fontSize: 10,
    color: theme.accent,
    marginTop: 2,
  },
  encouragement: {
    backgroundColor: theme.subtle,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  encouragementText: {
    fontSize: 14,
    color: theme.subtext,
    textAlign: 'center',
  },
});
