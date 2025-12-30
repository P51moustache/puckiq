import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import AccuracyTrendsCard from '../../components/AccuracyTrendsCard';
import Dropdown from '../../components/Dropdown';
import PickPerformanceChart from '../../components/PickPerformanceChart';
import StreakBadge from '../../components/StreakBadge';
import { ThemedView } from '../../components/ThemedView';
import { Achievement, getAchievementsWithStatus } from '../../constants/achievements';
import { makeStyles, theme } from '../../constants/theme';
import {
  getNotificationSettings,
  NotificationSettings,
  toggleNotifications,
  updateNotificationTime,
  updateNotificationTypes,
  updateGameStartSettings,
} from '../../services/notificationSettings';
import {
  cancelAllNotifications,
  requestNotificationPermissions,
  scheduleDailyNotification,
  triggerTestNotification,
} from '../../services/notifications';
import {
  clearUserPickHistory,
  clearAIPickHistory,
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

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    enabled: false,
    time: '09:00',
    notifyLockResults: true,
    notifySmartPickResults: true,
    notifyUserPickResults: true,
    notifyGameStart: true,
    gameStartMinutesBefore: 30,
  });

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
      const [settings, streak, allPicks, streakInfo, smartPickStats] = await Promise.all([
        getNotificationSettings(),
        getStreakData(),
        getAllPicks(),
        getUserStreakInfo(),
        getSmartPickStats(),
      ]);
      setNotificationSettings(settings);
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
          <Text style={styles.subtitle}>Your stats and settings</Text>
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

        {/* Notification Settings Card */}
        <View style={[styles.card, { marginBottom: 16 }]}>
          <Text style={styles.greeting}>Notifications</Text>

          {/* Master Toggle */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingVertical: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>Daily Pick Results</Text>
              <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>Get notified about yesterday's picks</Text>
            </View>
            <Switch
              value={notificationSettings.enabled}
              onValueChange={async (value) => {
                if (value) {
                  const hasPermission = await requestNotificationPermissions();
                  if (!hasPermission) {
                    Alert.alert('Notifications Disabled', 'Please enable notifications in your device settings to receive daily results.');
                    return;
                  }
                  await scheduleDailyNotification(notificationSettings.time);
                }

                await toggleNotifications(value);
                setNotificationSettings(prev => ({ ...prev, enabled: value }));

                if (!value) {
                  await cancelAllNotifications();
                }
              }}
              trackColor={{ false: theme.subtle, true: theme.accent }}
              thumbColor={notificationSettings.enabled ? '#ffffff' : '#f4f3f4'}
            />
          </View>

          {/* Time Picker (shown when enabled) */}
          {notificationSettings.enabled && (
            <>
              <View style={{ marginTop: 16 }}>
                <Dropdown
                  label="Notification Time"
                  placeholder="Select time"
                  options={[
                    { label: '6:00 AM', value: '06:00' },
                    { label: '7:00 AM', value: '07:00' },
                    { label: '8:00 AM', value: '08:00' },
                    { label: '9:00 AM', value: '09:00' },
                    { label: '10:00 AM', value: '10:00' },
                    { label: '11:00 AM', value: '11:00' },
                    { label: '12:00 PM', value: '12:00' },
                  ]}
                  value={notificationSettings.time}
                  onChange={async (value) => {
                    if (value) {
                      await updateNotificationTime(value);
                      setNotificationSettings(prev => ({ ...prev, time: value }));
                      await scheduleDailyNotification(value);
                    }
                  }}
                  selectedTextStyle={{ fontWeight: '700', fontSize: 16, textAlign: 'center' }}
                />
              </View>

              {/* Pick Type Filters */}
              <View style={{ marginTop: 16 }}>
                <Text style={{ color: theme.subtext, fontSize: 12, marginBottom: 8 }}>Include in notification:</Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, gap: 16 }}>
                  <Text style={{ color: theme.text, fontSize: 14 }}>Best Bet of the Day</Text>
                  <Switch
                    value={notificationSettings.notifyLockResults}
                    onValueChange={async (value) => {
                      if (!value && !notificationSettings.notifySmartPickResults && !notificationSettings.notifyUserPickResults) {
                        Alert.alert('Selection Required', 'At least one pick type must be selected.');
                        return;
                      }

                      await updateNotificationTypes(value, notificationSettings.notifySmartPickResults, notificationSettings.notifyUserPickResults);
                      setNotificationSettings(prev => ({ ...prev, notifyLockResults: value }));
                    }}
                    trackColor={{ false: theme.subtle, true: theme.accent }}
                    thumbColor={notificationSettings.notifyLockResults ? '#ffffff' : '#f4f3f4'}
                  />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, gap: 16 }}>
                  <Text style={{ color: theme.text, fontSize: 14 }}>Smart Picks</Text>
                  <Switch
                    value={notificationSettings.notifySmartPickResults}
                    onValueChange={async (value) => {
                      if (!value && !notificationSettings.notifyLockResults && !notificationSettings.notifyUserPickResults) {
                        Alert.alert('Selection Required', 'At least one pick type must be selected.');
                        return;
                      }

                      await updateNotificationTypes(notificationSettings.notifyLockResults, value, notificationSettings.notifyUserPickResults);
                      setNotificationSettings(prev => ({ ...prev, notifySmartPickResults: value }));
                    }}
                    trackColor={{ false: theme.subtle, true: theme.accent }}
                    thumbColor={notificationSettings.notifySmartPickResults ? '#ffffff' : '#f4f3f4'}
                  />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, gap: 16 }}>
                  <Text style={{ color: theme.text, fontSize: 14 }}>My Picks</Text>
                  <Switch
                    value={notificationSettings.notifyUserPickResults}
                    onValueChange={async (value) => {
                      if (!value && !notificationSettings.notifyLockResults && !notificationSettings.notifySmartPickResults) {
                        Alert.alert('Selection Required', 'At least one pick type must be selected.');
                        return;
                      }

                      await updateNotificationTypes(notificationSettings.notifyLockResults, notificationSettings.notifySmartPickResults, value);
                      setNotificationSettings(prev => ({ ...prev, notifyUserPickResults: value }));
                    }}
                    trackColor={{ false: theme.subtle, true: theme.accent }}
                    thumbColor={notificationSettings.notifyUserPickResults ? '#ffffff' : '#f4f3f4'}
                  />
                </View>
              </View>

              {/* Test Notification Button */}
              <TouchableOpacity
                style={{
                  backgroundColor: theme.accent + '22',
                  borderWidth: 1,
                  borderColor: theme.accent,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  marginTop: 20,
                }}
                onPress={triggerTestNotification}
              >
                <Text style={{ color: theme.accent, fontWeight: '600', textAlign: 'center' }}>Send Test Notification</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Game Start Alerts Section */}
          <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.subtle }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>Game Start Alerts</Text>
                <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>Get notified before your picked games start</Text>
              </View>
              <Switch
                value={notificationSettings.notifyGameStart}
                onValueChange={async (value) => {
                  if (value) {
                    const hasPermission = await requestNotificationPermissions();
                    if (!hasPermission) {
                      Alert.alert('Notifications Disabled', 'Please enable notifications in your device settings.');
                      return;
                    }
                  }
                  await updateGameStartSettings(value);
                  setNotificationSettings(prev => ({ ...prev, notifyGameStart: value }));
                }}
                trackColor={{ false: theme.subtle, true: theme.accent }}
                thumbColor={notificationSettings.notifyGameStart ? '#ffffff' : '#f4f3f4'}
              />
            </View>

            {notificationSettings.notifyGameStart && (
              <View style={{ marginTop: 12 }}>
                <Dropdown
                  label="Alert Time"
                  placeholder="Select when to be notified"
                  options={[
                    { label: '15 minutes before', value: '15' },
                    { label: '30 minutes before', value: '30' },
                    { label: '1 hour before', value: '60' },
                  ]}
                  value={String(notificationSettings.gameStartMinutesBefore)}
                  onChange={async (value) => {
                    if (value) {
                      const minutes = parseInt(value, 10);
                      await updateGameStartSettings(true, minutes);
                      setNotificationSettings(prev => ({ ...prev, gameStartMinutesBefore: minutes }));
                    }
                  }}
                  selectedTextStyle={{ fontWeight: '700', fontSize: 16, textAlign: 'center' }}
                />
              </View>
            )}
          </View>
        </View>

        {/* Data Management Section */}
        <View style={[styles.card, { marginBottom: 16 }]}>
          <Text style={styles.greeting}>Data Management</Text>

          {/* Clear My Picks History Button */}
          <TouchableOpacity
            style={{
              backgroundColor: '#ef4444' + '22',
              borderWidth: 1,
              borderColor: '#ef4444',
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 8,
              marginTop: 16,
            }}
            onPress={() => {
              Alert.alert(
                'Clear My Picks History',
                'This will permanently delete all your pick history. AI picks will be preserved. This action cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await clearUserPickHistory();
                        setPickStats({ total: 0, wins: 0, losses: 0, accuracy: 0 });
                        Alert.alert('Success', 'Your pick history has been cleared.');
                      } catch {
                        Alert.alert('Error', 'Failed to clear pick history. Please try again.');
                      }
                    },
                  },
                ]
              );
            }}
          >
            <Text style={{ color: '#ef4444', fontWeight: '600', textAlign: 'center' }}>Clear My Picks History</Text>
          </TouchableOpacity>

          {/* Clear AI Picks Button */}
          <TouchableOpacity
            style={{
              backgroundColor: '#f59e0b' + '22',
              borderWidth: 1,
              borderColor: '#f59e0b',
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 8,
              marginTop: 12,
            }}
            onPress={() => {
              Alert.alert(
                'Clear AI Picks History',
                'This will permanently delete all Smart Picks and Best Bet of the Day history. Your personal picks will be preserved. This action cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await clearAIPickHistory();
                        Alert.alert('Success', 'AI pick history has been cleared.');
                      } catch {
                        Alert.alert('Error', 'Failed to clear AI pick history. Please try again.');
                      }
                    },
                  },
                ]
              );
            }}
          >
            <Text style={{ color: '#f59e0b', fontWeight: '600', textAlign: 'center' }}>Clear AI Picks History</Text>
          </TouchableOpacity>
        </View>

        {/* Analytics Section */}
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.greeting, { marginBottom: 12, marginLeft: 4 }]}>Analytics</Text>
          <AccuracyTrendsCard />
        </View>

        <View style={{ marginBottom: 16 }}>
          <PickPerformanceChart />
        </View>

        {/* About Section */}
        <View style={styles.card}>
          <Text style={styles.greeting}>About</Text>
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: theme.text, fontSize: 14, marginBottom: 4 }}>PuckIQ</Text>
            <Text style={{ color: theme.subtext, fontSize: 12 }}>Version 2.1.0</Text>
            <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
              Get AI-powered NHL pick predictions, track your accuracy, and compete against our algorithms.
            </Text>
          </View>
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
