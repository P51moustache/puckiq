import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import Dropdown from '../../components/Dropdown';
import { ThemedView } from '../../components/ThemedView';
import { makeStyles, theme } from '../../constants/theme';
import { useAnalytics } from '../../hooks/useAnalytics';
// Auth disabled for now - uncomment when ready to implement user accounts
// import { useAuth } from '../../hooks/useAuth';
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
} from '../../services/pickTracking';

export default function SettingsScreen() {
  const styles = makeStyles();
  const router = useRouter();

  // Initialize analytics for this screen
  const analytics = useAnalytics('SettingsScreen');
  // Auth disabled for now - uncomment when ready to implement user accounts
  // const { user, signOut, isDeveloper } = useAuth();

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

  // Load notification settings on mount
  useEffect(() => {
    async function loadSettings() {
      const settings = await getNotificationSettings();
      setNotificationSettings(settings);
    }
    loadSettings();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={{ alignSelf: 'stretch', width: '100%' }}
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section - Disabled for now, uncomment when ready to implement user accounts */}
        {/*
        <View style={[styles.card, { alignSelf: 'stretch', width: '100%', marginBottom: 16 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>Account</Text>
            {isDeveloper ? (
              <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '700' }}>Developer Access</Text>
            ) : null}
          </View>

          {user ? (
            <>
              <Text style={{ color: theme.subtext, marginTop: 6 }}>
                {user.email || 'Signed in'}
              </Text>
              <TouchableOpacity
                style={{
                  marginTop: 12,
                  alignSelf: 'flex-start',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.accent,
                }}
                onPress={signOut}
              >
                <Text style={{ color: theme.accent, fontWeight: '600' }}>Sign out</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={{ color: theme.subtext, marginTop: 6, marginBottom: 8 }}>
                Guest Mode - Sign in to sync your picks across devices and enable cloud backup
              </Text>
              <TouchableOpacity
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: theme.accent,
                }}
                onPress={() => router.push('/(auth)/sign-in')}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Sign in</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        */}

        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Notification Settings Card */}
        <View style={[styles.card, { alignSelf: 'stretch', width: '100%', marginBottom: 16 }]}>
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
                  // Schedule notification when enabling
                  await scheduleDailyNotification(notificationSettings.time);
                }

                await toggleNotifications(value);
                setNotificationSettings(prev => ({ ...prev, enabled: value }));

                // Track notification settings change
                analytics.trackCustomEvent('notification_setting_changed', {
                  setting_name: 'notifications_enabled',
                  new_value: value,
                });

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
                      // Ensure at least one type is selected
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
        <View style={[styles.card, { alignSelf: 'stretch', width: '100%', marginBottom: 16 }]}>
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
                        // Track history clear action
                        analytics.trackCustomEvent('user_pick_history_cleared', {
                          source: 'settings_screen',
                        });

                        await clearUserPickHistory();
                        Alert.alert('Success', 'Your pick history has been cleared.');
                      } catch (error) {
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
                        // Track AI history clear action
                        analytics.trackCustomEvent('ai_pick_history_cleared', {
                          source: 'settings_screen',
                        });

                        await clearAIPickHistory();
                        Alert.alert('Success', 'AI pick history has been cleared.');
                      } catch (error) {
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

        {/* About Section */}
        <View style={[styles.card, { alignSelf: 'stretch', width: '100%' }]}>
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
