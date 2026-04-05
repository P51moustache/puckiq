import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { theme } from '../constants/theme';
import { useAuthContext } from './auth/AuthProvider';

interface NotificationPrefs {
  morningBrief: boolean;
  injuryAlerts: boolean;
  gameReminders: boolean;
}

export default function HubScreen() {
  const { user, signInWithApple, signInWithGoogle, signOut } = useAuthContext();
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    morningBrief: false,
    injuryAlerts: false,
    gameReminders: false,
  });

  const togglePref = (key: keyof NotificationPrefs) => {
    setNotificationPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Hub</Text>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            {user ? (
              <View>
                <Text style={styles.emailText}>{user.email}</Text>
                <Pressable
                  style={styles.signOutButton}
                  onPress={signOut}
                  testID="sign-out-button"
                >
                  <Text style={styles.signOutText}>Sign Out</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.authButtons}>
                <Pressable
                  style={styles.authButton}
                  onPress={signInWithApple}
                  testID="sign-in-apple"
                >
                  <Text style={styles.authButtonText}>Sign in with Apple</Text>
                </Pressable>
                <Pressable
                  style={styles.authButton}
                  onPress={signInWithGoogle}
                  testID="sign-in-google"
                >
                  <Text style={styles.authButtonText}>Sign in with Google</Text>
                </Pressable>
                <Pressable
                  style={[styles.authButton, styles.emailAuthButton]}
                  testID="sign-in-email"
                >
                  <Text style={styles.authButtonText}>Sign in with Email</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={styles.card}>
            <View style={styles.subscriptionRow}>
              <Text style={styles.planLabel}>Current Plan</Text>
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeText}>Free Plan</Text>
              </View>
            </View>
            <Pressable style={styles.upgradeButton} testID="upgrade-button">
              <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
            </Pressable>
          </View>
        </View>

        {/* Notification Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Morning Brief</Text>
              <Switch
                value={notificationPrefs.morningBrief}
                onValueChange={() => togglePref('morningBrief')}
                trackColor={{ false: theme.subtle, true: theme.accent }}
                testID="toggle-morning-brief"
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Injury Alerts</Text>
              <Switch
                value={notificationPrefs.injuryAlerts}
                onValueChange={() => togglePref('injuryAlerts')}
                trackColor={{ false: theme.subtle, true: theme.accent }}
                testID="toggle-injury-alerts"
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Game Reminders</Text>
              <Switch
                value={notificationPrefs.gameReminders}
                onValueChange={() => togglePref('gameReminders')}
                trackColor={{ false: theme.subtle, true: theme.accent }}
                testID="toggle-game-reminders"
              />
            </View>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Version</Text>
              <Text style={styles.aboutValue}>2.2.0</Text>
            </View>
            <Pressable style={styles.supportLink} testID="support-link">
              <Text style={styles.supportLinkText}>Support</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 120,
  },
  screenTitle: {
    fontSize: theme.typography.sizes['3xl'],
    fontWeight: theme.typography.weights.bold as '700',
    color: theme.text,
    marginBottom: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold as '600',
    color: theme.text,
    marginBottom: theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: theme.spacing.md,
    ...theme.elevation.low,
  },
  emailText: {
    fontSize: theme.typography.sizes.base,
    color: theme.text,
    marginBottom: theme.spacing.md,
  },
  signOutButton: {
    backgroundColor: theme.subtle,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  signOutText: {
    color: theme.semantic.negative,
    fontWeight: theme.typography.weights.semibold as '600',
    fontSize: theme.typography.sizes.sm,
  },
  authButtons: {
    gap: theme.spacing.sm,
  },
  authButton: {
    backgroundColor: theme.factbox,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  emailAuthButton: {
    backgroundColor: theme.subtle,
  },
  authButtonText: {
    color: theme.text,
    fontWeight: theme.typography.weights.semibold as '600',
    fontSize: theme.typography.sizes.sm,
  },
  subscriptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  planLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.subtext,
  },
  freeBadge: {
    backgroundColor: theme.factbox,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  freeBadgeText: {
    color: theme.accent,
    fontWeight: theme.typography.weights.semibold as '600',
    fontSize: theme.typography.sizes.xs,
  },
  upgradeButton: {
    backgroundColor: theme.accent,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#fff',
    fontWeight: theme.typography.weights.bold as '700',
    fontSize: theme.typography.sizes.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  toggleLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.text,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  aboutLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.subtext,
  },
  aboutValue: {
    fontSize: theme.typography.sizes.sm,
    color: theme.text,
    fontWeight: theme.typography.weights.medium as '500',
  },
  supportLink: {
    paddingVertical: theme.spacing.sm,
  },
  supportLinkText: {
    color: theme.accent,
    fontWeight: theme.typography.weights.semibold as '600',
    fontSize: theme.typography.sizes.sm,
  },
});
