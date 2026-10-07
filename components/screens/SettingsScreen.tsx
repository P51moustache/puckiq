/**
 * Settings — Pro, lineup reminders, leagues, optional account backup, about.
 */

import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '../../constants/legal';
import { deleteAccount } from '../../services/cloudBackup';
import { REMINDER_OPTIONS } from '../../services/lineupReminders';
import { PLATFORM_LABEL, teamLimit } from '../../services/teams';
import { isSupabaseConfigured } from '../../lib/supabase';
import PageHeader from '../PageHeader';
import { useAuthContext } from '../auth/AuthProvider';
import { useTeams } from '../TeamsProvider';
import { useSubscription } from '../SubscriptionProvider';
import { usePaywall } from '../PaywallProvider';
import { useReminders } from '../RemindersProvider';
import LeagueSettingsSheet from '../sheets/LeagueSettingsSheet';
import FeedbackSheet from '../sheets/FeedbackSheet';
import { AlertsCard } from '../settings/AlertsCard';
import {
  Card,
  colors,
  Columns,
  IconButton,
  contentFrame,
  GhostButton,
  ProBadge,
  SectionLabel,
  useWide,
} from '../coach/ui';
import AnalyticsService from '../../services/analytics/AnalyticsService';
import { posthogConfig } from '../../services/analytics/posthog';
import { track } from '../../services/analytics/track';

import { ONBOARDING_KEY } from '../../constants/release';
import { PlanCard } from '../settings/PlanCard';
import { ReleaseNotice } from '../release/ReleaseNotice';

const ANALYTICS_REMOTE = posthogConfig() !== null;

export { ONBOARDING_KEY } from '../../constants/release';

function Row({ icon, label, detail, onPress, right, testID }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  testID?: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && onPress && styles.pressed]} testID={testID}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={colors.muted} /> : null)}
    </Pressable>
  );
}

export default function SettingsScreen({ onBack }: { onBack?: () => void } = {}) {
  const wide = useWide();
  const { user, signInWithApple, appleSignInReady, signOut } = useAuthContext();
  const { isPremium } = useSubscription();
  const { openPaywall } = usePaywall();
  const { teams, team, setActiveTeam, addTeam } = useTeams();
  const reminders = useReminders();
  const [shareUsage, setShareUsage] = useState(() => AnalyticsService.getInstance().isEnabled());
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const version = Constants.expoConfig?.version ?? '';

  const toggleReminders = async (on: boolean) => {
    if (!on) {
      await reminders.update({ ...reminders.settings, enabled: false });
      return;
    }
    const ok = await reminders.enable();
    if (!ok) {
      Alert.alert('Notifications are off', 'Turn on notifications for PuckIQ in iOS Settings to get lineup reminders.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
    }
  };

  const handleAddTeam = () => {
    if (teams.length >= teamLimit(isPremium)) {
      if (!isPremium) openPaywall('teams');
      else Alert.alert('Team limit reached', `Pro supports up to ${teamLimit(true)} teams.`);
      return;
    }
    const created = addTeam({ name: `Team ${teams.length + 1}`, platform: team?.platform, slots: team?.slots });
    setEditingTeamId(created.id);
  };

  const handleDeleteAccount = () => {
    if (!user) return;
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your PuckIQ account and its cloud backup. Teams on this device stay. A Pro subscription is managed by Apple — cancel it in your App Store account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteAccount(user.id);
              await signOut();
              Alert.alert(
                result === 'deleted' ? 'Account deleted' : 'Backup deleted',
                result === 'deleted'
                  ? 'Your account and backup are gone.'
                  : `Your backed-up data was removed.${SUPPORT_EMAIL ? ` Email ${SUPPORT_EMAIL} to finish deleting the login.` : ''}`,
              );
            } catch {
              Alert.alert('Couldn’t delete right now', 'Check your connection and try again.');
            }
          },
        },
      ],
    );
  };

  const resetOnboarding = async () => {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
    Alert.alert('Onboarding reset', 'Relaunch the app to see it again.');
  };

  const editingTeam = teams.find((row) => row.id === editingTeamId) ?? null;

  return (
    <View style={styles.container} testID="settings-screen">
      <PageHeader
        title="Settings"
        accessory={onBack ? <IconButton icon="chevron-back" label="Back" onPress={onBack} testID="settings-back" /> : undefined}
      />
      <ScrollView contentContainerStyle={[styles.content, contentFrame]} showsVerticalScrollIndicator={false}>
        <Columns
          left={(
            <>
        <PlanCard />

        {/* Reminders */}
        <SectionLabel title="Lineup reminders" />
        <Card>
          <Row
            icon="alarm-outline"
            label="Remind me before first puck"
            detail="One heads-up a night, only when your players play."
            right={(
              <Switch
                value={reminders.settings.enabled && reminders.permission === 'granted'}
                onValueChange={toggleReminders}
                trackColor={{ true: colors.accent, false: colors.raised }}
                testID="reminders-toggle"
              />
            )}
          />
          {reminders.settings.enabled ? (
            <View style={styles.minutes}>
              {REMINDER_OPTIONS.map((minutes) => {
                const on = reminders.settings.minutesBefore === minutes;
                return (
                  <Pressable
                    key={minutes}
                    onPress={() => reminders.update({ ...reminders.settings, minutesBefore: minutes })}
                    style={[styles.minute, on && styles.minuteOn]}
                    testID={`reminder-${minutes}`}
                  >
                    <Text style={[styles.minuteText, on && styles.minuteTextOn]}>{minutes} min</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {reminders.permission === 'denied' ? (
            <Text style={styles.warn} onPress={() => Linking.openSettings()}>Notifications are blocked in iOS Settings. Tap to open.</Text>
          ) : null}
        </Card>

        <AlertsCard />

            </>
          )}
          right={(
            <>
        {/* Leagues */}
        <SectionLabel title="Leagues" flush={wide} right={!isPremium ? <Text style={styles.limit}>1 on Free · 5 on Pro</Text> : null} />
        <Card style={styles.listCard}>
          {teams.map((row) => (
            <Row
              key={row.id}
              icon={row.id === team?.id ? 'radio-button-on' : 'radio-button-off'}
              label={row.name}
              detail={`${PLATFORM_LABEL[row.platform]} · ${row.players.length} players`}
              onPress={() => {
                setActiveTeam(row.id);
                setEditingTeamId(row.id);
              }}
              testID={`settings-team-${row.id}`}
            />
          ))}
          <Row
            icon="add-circle-outline"
            label="Add another league"
            onPress={handleAddTeam}
            right={!isPremium ? <ProBadge small /> : undefined}
            testID="settings-add-team"
          />
        </Card>

        {/* Account */}
        {/* Shown once Sign in with Apple is live (or to let a signed-in user sign out / delete). */}
        {isSupabaseConfigured && (user || appleSignInReady) ? (
          <>
            <SectionLabel title="Backup" />
            <Card>
              {user ? (
                <>
                  <Row icon="cloud-done-outline" label={user.email ?? 'Signed in'} detail="Teams back up automatically and follow you to new devices." />
                  <View style={styles.accountActions}>
                    <GhostButton label="Sign out" onPress={signOut} tone="neutral" testID="sign-out-button" />
                    <GhostButton label="Delete account" onPress={handleDeleteAccount} tone="bad" testID="delete-account-button" />
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.backupCopy}>Optional. Sign in to back up your teams and restore them on a new phone.</Text>
                  <View style={styles.authButtons}>
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={24}
                      style={styles.appleButton}
                      onPress={signInWithApple}
                      testID="sign-in-apple"
                    />
                  </View>
                </>
              )}
            </Card>
          </>
        ) : null}

        {/* About */}
        <SectionLabel title="About" />
        <Card style={styles.listCard}>
          <Row icon="sparkles-outline" label="What’s new in PuckIQ 3.0" detail="See your new coach and early-user benefits." onPress={() => setReleaseOpen(true)} testID="release-notes-link" />
          <Row
            icon="chatbubble-ellipses-outline"
            label="Send feedback"
            detail="Report a bug or tell us what to build next."
            onPress={() => {
              track('feedback_opened', { source: 'settings' });
              setFeedbackOpen(true);
            }}
            testID="feedback-link"
          />
          {SUPPORT_EMAIL ? (
            <Row icon="mail-outline" label="Contact support" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=PuckIQ ${version}`)} testID="support-link" />
          ) : null}
          {PRIVACY_URL ? <Row icon="shield-checkmark-outline" label="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL)} /> : null}
          {ANALYTICS_REMOTE ? (
            <Row
              icon="analytics-outline"
              label="Share anonymous usage stats"
              detail="Which screens and features get used. Never your name, email, or roster."
              right={(
                <Switch
                  value={shareUsage}
                  onValueChange={(next) => {
                    AnalyticsService.getInstance().setEnabled(next);
                    setShareUsage(next);
                  }}
                  trackColor={{ true: colors.accent, false: colors.raised }}
                  testID="analytics-toggle"
                />
              )}
            />
          ) : null}
          <Row icon="document-text-outline" label="Terms of use" onPress={() => Linking.openURL(TERMS_URL)} />
          <Row icon="information-circle-outline" label="Version" right={<Text style={styles.version}>{version}</Text>} />
        </Card>
            </>
          )}
        />
        <Text style={styles.disclaimer}>
          Schedules, scratches, and stats come from public NHL data. PuckIQ is not affiliated with or endorsed by the NHL, Yahoo, ESPN, or Fantrax, and never signs in to or changes your fantasy league.
        </Text>

        {__DEV__ ? (
          <Pressable onPress={resetOnboarding} style={styles.devRow}>
            <Text style={styles.devText}>Dev: reset onboarding</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <LeagueSettingsSheet visible={!!editingTeam} team={editingTeam} onClose={() => setEditingTeamId(null)} />
      {releaseOpen ? <ReleaseNotice hadSavedSetup replay onClose={() => setReleaseOpen(false)} /> : null}
      <FeedbackSheet visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  pressed: {
    opacity: 0.7,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  rowDetail: {
    fontSize: 12,
    color: colors.sub,
    marginTop: 2,
  },
  minutes: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginLeft: 30,
  },
  minute: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.raised,
  },
  minuteOn: {
    backgroundColor: colors.accent,
  },
  minuteText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.sub,
  },
  minuteTextOn: {
    color: colors.onAccent,
  },
  warn: {
    fontSize: 12,
    color: colors.warn,
    marginTop: 8,
  },
  limit: {
    fontSize: 11,
    color: colors.muted,
  },
  listCard: {
    paddingVertical: 4,
  },
  accountActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  backupCopy: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.sub,
  },
  appleButton: {
    height: 48,
  },
  authButtons: {
    gap: 8,
    marginTop: 12,
  },
  version: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.sub,
  },
  disclaimer: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    marginTop: 16,
  },
  devRow: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  devText: {
    fontSize: 12,
    color: colors.muted,
  },
});
