import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import AccuracyTrendsCard from '../../components/AccuracyTrendsCard';
import PickPerformanceChart from '../../components/PickPerformanceChart';
import StreakBadge from '../../components/StreakBadge';
import { ThemedView } from '../../components/ThemedView';
import { Achievement, getAchievementsWithStatus } from '../../constants/achievements';
import { makeStyles, theme } from '../../constants/theme';
import {
  getAllPicks,
  getSmartPickStats,
  getUserStreakInfo,
  Pick,
} from '../../services/pickTracking';
import { getStreakData, StreakData } from '../../services/streakTracking';
import { useAnalytics } from '../../hooks/useAnalytics';

export default function ProfileScreen() {
  const styles = makeStyles();
  const analytics = useAnalytics('ProfileScreen');

  // Streak and stats
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastVisitDate: '',
    totalDays: 0,
  });
  const [pickStats, setPickStats] = useState({
    total: 0,
    wins: 0,
    losses: 0,
    accuracy: 0,
  });
  const [achievements, setAchievements] = useState<(Achievement & { unlocked: boolean; progress: number })[]>([]);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      const [streak, allPicks, streakInfo, smartPickStats] = await Promise.all([
        getStreakData(),
        getAllPicks(),
        getUserStreakInfo(),
        getSmartPickStats(),
      ]);
      setStreakData(streak);

      // Calculate stats
      const userPicks = allPicks.filter((p: Pick) => p.type === 'user-pick');
      const completed = userPicks.filter((p: Pick) => p.outcome);
      const wins = completed.filter((p: Pick) => p.outcome === 'win').length;
      const losses = completed.filter((p: Pick) => p.outcome === 'loss').length;
      const accuracy = completed.length > 0 ? Math.round((wins / completed.length) * 100) : 0;

      setPickStats({
        total: completed.length,
        wins,
        losses,
        accuracy,
      });

      // Calculate achievements
      const smartPickAccuracy = smartPickStats.total > 0
        ? Math.round((smartPickStats.wins / smartPickStats.total) * 100)
        : 0;

      const achievementsWithStatus = getAchievementsWithStatus({
        totalPicks: completed.length,
        accuracy,
        bestStreak: streakInfo.bestWinStreak,
        userAccuracy: accuracy,
        smartPickAccuracy,
        consecutiveDays: streak.currentStreak,
      });
      setAchievements(achievementsWithStatus);
    }
    loadData();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={{ alignSelf: 'stretch', width: '100%' }}
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Your stats and achievements</Text>
        </View>

        {/* Stats Overview Card */}
        <View style={[styles.card, { marginBottom: 16 }]}>
          <View style={localStyles.statsHeader}>
            <Text style={styles.greeting}>Your Stats</Text>
            <StreakBadge currentStreak={streakData.currentStreak} longestStreak={streakData.longestStreak} />
          </View>

          <View style={localStyles.statsGrid}>
            <View style={localStyles.statBox}>
              <Text style={localStyles.statValue}>{pickStats.accuracy}%</Text>
              <Text style={localStyles.statLabel}>Accuracy</Text>
            </View>
            <View style={localStyles.statBox}>
              <Text style={[localStyles.statValue, { color: '#10b981' }]}>{pickStats.wins}</Text>
              <Text style={localStyles.statLabel}>Wins</Text>
            </View>
            <View style={localStyles.statBox}>
              <Text style={[localStyles.statValue, { color: '#ef4444' }]}>{pickStats.losses}</Text>
              <Text style={localStyles.statLabel}>Losses</Text>
            </View>
            <View style={localStyles.statBox}>
              <Text style={localStyles.statValue}>{pickStats.total}</Text>
              <Text style={localStyles.statLabel}>Total Picks</Text>
            </View>
          </View>

          <View style={localStyles.streakInfo}>
            <View style={localStyles.streakRow}>
              <Text style={localStyles.streakLabel}>Current Streak</Text>
              <Text style={localStyles.streakValue}>{streakData.currentStreak} days</Text>
            </View>
            <View style={localStyles.streakRow}>
              <Text style={localStyles.streakLabel}>Longest Streak</Text>
              <Text style={localStyles.streakValue}>{streakData.longestStreak} days</Text>
            </View>
            <View style={localStyles.streakRow}>
              <Text style={localStyles.streakLabel}>Total Days Active</Text>
              <Text style={localStyles.streakValue}>{streakData.totalDays} days</Text>
            </View>
          </View>
        </View>

        {/* Achievements Card */}
        <View style={[styles.card, { marginBottom: 16 }]}>
          <View style={localStyles.statsHeader}>
            <Text style={styles.greeting}>Achievements</Text>
            <Text style={{ color: theme.subtext, fontSize: 12 }}>
              {achievements.filter(a => a.unlocked).length}/{achievements.length} unlocked
            </Text>
          </View>

          {/* Unlocked Achievements */}
          {achievements.filter(a => a.unlocked).length > 0 && (
            <View style={localStyles.achievementsGrid}>
              {achievements.filter(a => a.unlocked).map(achievement => (
                <View key={achievement.id} style={localStyles.achievementBadge}>
                  <Text style={localStyles.achievementIcon}>{achievement.icon}</Text>
                  <Text style={localStyles.achievementTitle}>{achievement.title}</Text>
                </View>
              ))}
            </View>
          )}

          {/* In Progress - show next 3 closest to completion */}
          <View style={{ marginTop: 16 }}>
            <Text style={{ color: theme.subtext, fontSize: 12, marginBottom: 8 }}>In Progress</Text>
            {achievements
              .filter(a => !a.unlocked)
              .sort((a, b) => b.progress - a.progress)
              .slice(0, 3)
              .map(achievement => (
                <View key={achievement.id} style={localStyles.progressItem}>
                  <View style={localStyles.progressHeader}>
                    <Text style={{ fontSize: 16, marginRight: 8 }}>{achievement.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>{achievement.title}</Text>
                      <Text style={{ color: theme.subtext, fontSize: 11 }}>{achievement.description}</Text>
                    </View>
                    <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>{Math.round(achievement.progress)}%</Text>
                  </View>
                  <View style={localStyles.progressBarBg}>
                    <View style={[localStyles.progressBarFill, { width: `${achievement.progress}%` }]} />
                  </View>
                </View>
              ))}
          </View>
        </View>

        {/* Analytics Section */}
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.greeting, { marginBottom: 12, marginLeft: 4 }]}>Analytics</Text>
          <AccuracyTrendsCard />
        </View>

        <View style={{ marginBottom: 16 }}>
          <PickPerformanceChart />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const localStyles = StyleSheet.create({
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  statValue: {
    fontSize: 24,
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
  streakInfo: {
    borderTopWidth: 1,
    borderTopColor: theme.subtle,
    paddingTop: 12,
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  streakLabel: {
    fontSize: 14,
    color: theme.subtext,
  },
  streakValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  achievementBadge: {
    backgroundColor: theme.factbox,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 70,
  },
  achievementIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  achievementTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
  },
  progressItem: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: theme.subtle,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.accent,
    borderRadius: 2,
  },
});
