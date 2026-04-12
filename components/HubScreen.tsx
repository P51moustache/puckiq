import { useState, useEffect, useCallback } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { rinkGlass } from '../constants/theme';
import { useAuthContext } from './auth/AuthProvider';
import { useSubscription } from './SubscriptionProvider';
import AccuracyTracker from './AccuracyTracker';
import Leaderboard from './Leaderboard';
import ReferralCard from './ReferralCard';
import {
  FantasyNotificationPreferences,
  DEFAULT_FANTASY_PREFS,
  loadFantasyNotificationPrefs,
  saveFantasyNotificationPrefs,
} from '../services/notificationSettings';

type PrefKey = keyof FantasyNotificationPreferences;

const NOTIFICATION_TOGGLES: {
  key: PrefKey;
  label: string;
  testID: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { key: 'morningBrief', label: 'Morning Brief', testID: 'toggle-morning-brief', icon: 'newspaper-outline', color: rinkGlass.moduleAccents.dailyInsight },
  { key: 'goalieConfirmed', label: 'Goalie Confirmed', testID: 'toggle-goalie-confirmed', icon: 'shield-checkmark-outline', color: rinkGlass.faceoffDot },
  { key: 'injuryAlerts', label: 'Injury Alerts', testID: 'toggle-injury-alerts', icon: 'alert-circle-outline', color: rinkGlass.redLine },
  { key: 'gameReminder', label: 'Game Reminders', testID: 'toggle-game-reminders', icon: 'time-outline', color: rinkGlass.blueLight },
  { key: 'waiverAlerts', label: 'Waiver Alerts', testID: 'toggle-waiver-alerts', icon: 'trending-up-outline', color: rinkGlass.moduleAccents.waiverWire },
];

/* ── Section Header ────────────────────────────────────── */
function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionHeaderLeft}>
        <Ionicons name={icon} size={18} color={rinkGlass.blueLight} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      <LinearGradient
        colors={[rinkGlass.blueLight, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.sectionLine}
      />
    </View>
  );
}

/* ── Stat Mini-Card ────────────────────────────────────── */
function StatCard({ value, label, delay }: { value: string; label: string; delay: number }) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(500)} style={s.statCardOuter}>
      <View style={s.statCard}>
        <Text style={s.statValue}>{value}</Text>
        <Text style={s.statLabel}>{label}</Text>
      </View>
    </Animated.View>
  );
}

/* ── Main Component ────────────────────────────────────── */
export default function HubScreen() {
  const { user, signInWithApple, signInWithGoogle, signOut } = useAuthContext();
  const { isPremium } = useSubscription();
  const [notificationPrefs, setNotificationPrefs] = useState<FantasyNotificationPreferences>({
    ...DEFAULT_FANTASY_PREFS,
    morningBrief: false,
    goalieConfirmed: false,
    injuryAlerts: false,
    gameReminder: false,
    waiverAlerts: false,
  });
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setPrefsLoaded(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const prefs = await loadFantasyNotificationPrefs(user.id);
        if (!cancelled) {
          setNotificationPrefs(prefs);
          setPrefsLoaded(true);
        }
      } catch (err) {
        console.error('[HubScreen] Error loading notification prefs:', err);
        if (!cancelled) setPrefsLoaded(true);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  const togglePref = useCallback(
    (key: PrefKey) => {
      if (!user?.id || !isPremium) return;

      setNotificationPrefs((prev) => {
        const updated = { ...prev, [key]: !prev[key] };
        saveFantasyNotificationPrefs(user.id, updated).catch((err) => {
          console.error('[HubScreen] Error saving notification prefs:', err);
        });
        return updated;
      });
    },
    [user?.id, isPremium]
  );

  const canToggle = !!user && isPremium;

  const userInitial = user?.email ? user.email[0].toUpperCase() : '?';

  return (
    <View style={s.container}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header Area ─────────────────────────────── */}
        <Animated.View entering={FadeInUp.duration(400)} style={s.headerArea}>
          <Text style={s.screenTitle}>Hub</Text>

          <View style={s.profileRow}>
            {/* Avatar */}
            <LinearGradient
              colors={[rinkGlass.blueLight, rinkGlass.boards]}
              style={s.avatarRing}
            >
              <View style={s.avatarInner}>
                {user ? (
                  <Text style={s.avatarText}>{userInitial}</Text>
                ) : (
                  <Ionicons name="person-outline" size={28} color={rinkGlass.textSecondary} />
                )}
              </View>
            </LinearGradient>

            {/* Identity */}
            <View style={s.identityCol}>
              {user ? (
                <>
                  <View style={s.emailRow}>
                    <Text style={s.emailText} numberOfLines={1}>{user.email}</Text>
                    <View style={[s.tierBadge, isPremium && s.tierBadgePro]}>
                      <Text style={[s.tierBadgeText, isPremium && s.tierBadgeTextPro]}>
                        {isPremium ? 'Pro' : 'Free'}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={s.signOutButton}
                    onPress={signOut}
                    testID="sign-out-button"
                  >
                    <Text style={s.signOutText}>Sign Out</Text>
                  </Pressable>
                </>
              ) : (
                <Text style={s.signInPrompt}>Sign in to sync your data</Text>
              )}
            </View>
          </View>

          {/* Auth Buttons (signed out) */}
          {!user && (
            <View style={s.authButtons}>
              <Pressable
                style={s.authButton}
                onPress={signInWithApple}
                testID="sign-in-apple"
              >
                <Ionicons name="logo-apple" size={20} color={rinkGlass.textPrimary} style={s.authIcon} />
                <Text style={s.authButtonText}>Sign in with Apple</Text>
              </Pressable>
              <Pressable
                style={s.authButton}
                onPress={signInWithGoogle}
                testID="sign-in-google"
              >
                <Ionicons name="logo-google" size={18} color={rinkGlass.textPrimary} style={s.authIcon} />
                <Text style={s.authButtonText}>Sign in with Google</Text>
              </Pressable>
              <Pressable
                style={[s.authButton, s.emailAuthButton]}
                testID="sign-in-email"
              >
                <Ionicons name="mail-outline" size={18} color={rinkGlass.textPrimary} style={s.authIcon} />
                <Text style={s.authButtonText}>Sign in with Email</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>

        {/* ── Stats Summary Row ───────────────────────── */}
        <View style={s.statsRow}>
          <StatCard value="--" label="Total Picks" delay={100} />
          <StatCard value="--" label="Accuracy" delay={200} />
          <StatCard value="--" label="Streak" delay={300} />
        </View>

        {/* ── Subscription ────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader icon="diamond-outline" title="Subscription" />
          {isPremium ? (
            <View style={s.card}>
              <View style={s.proActiveRow}>
                <Ionicons name="checkmark-circle" size={22} color={rinkGlass.powerPlay} />
                <Text style={s.proActiveText}>PuckIQ Pro</Text>
              </View>
            </View>
          ) : (
            <Pressable testID="upgrade-button" style={s.upgradeOuter}>
              <LinearGradient
                colors={[rinkGlass.boards, rinkGlass.blueLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.upgradeCard}
              >
                <View style={s.upgradeBadgeRow}>
                  <View style={s.subscriptionRow}>
                    <Text style={s.planLabel}>Current Plan</Text>
                    <View style={s.freeBadge}>
                      <Text style={s.freeBadgeText}>Free Plan</Text>
                    </View>
                  </View>
                </View>
                <View style={s.upgradeCtaRow}>
                  <Ionicons name="flash" size={18} color="#fff" />
                  <Text style={s.upgradeButtonText}>Upgrade to Pro</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
                </View>
                <Text style={s.upgradeSubtext}>
                  Unlock notifications, advanced analytics, and more
                </Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>

        {/* ── Accuracy Tracker ────────────────────────── */}
        <View style={s.section}>
          <SectionHeader icon="analytics-outline" title="Accuracy" />
          <AccuracyTracker />
        </View>

        {/* ── Leaderboard ─────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader icon="trophy-outline" title="Leaderboard" />
          <Leaderboard />
        </View>

        {/* ── Notifications ───────────────────────────── */}
        <View style={s.section}>
          <SectionHeader icon="notifications-outline" title="Notifications" />
          <View style={s.card}>
            {NOTIFICATION_TOGGLES.map(({ key, label, testID, icon, color }, idx) => (
              <View
                style={[s.toggleRow, idx < NOTIFICATION_TOGGLES.length - 1 && s.toggleRowBorder]}
                key={key}
              >
                <View style={s.toggleLeft}>
                  <Ionicons
                    name={icon}
                    size={18}
                    color={canToggle ? color : rinkGlass.textSecondary}
                    style={s.toggleIcon}
                  />
                  <View style={s.toggleLabelRow}>
                    <Text style={[s.toggleLabel, !canToggle && s.toggleLabelDisabled]}>
                      {label}
                    </Text>
                    {!canToggle && (
                      <View style={s.proLockRow}>
                        <Ionicons name="lock-closed" size={10} color={rinkGlass.textSecondary} />
                        <Text style={s.proLabel} testID={`${testID}-pro-label`}>
                          Pro feature
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <Switch
                  value={notificationPrefs[key]}
                  onValueChange={() => togglePref(key)}
                  trackColor={{ false: '#1a2744', true: rinkGlass.blueLight }}
                  thumbColor={notificationPrefs[key] ? rinkGlass.blueLight : rinkGlass.textSecondary}
                  disabled={!canToggle}
                  testID={testID}
                />
              </View>
            ))}
          </View>
        </View>

        {/* ── Referral ────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader icon="gift-outline" title="Refer a Friend" />
          <ReferralCard />
        </View>

        {/* ── About ───────────────────────────────────── */}
        <View style={s.aboutRow}>
          <View style={s.aboutLeft}>
            <Text style={s.aboutLabel}>Version</Text>
            <Text style={s.aboutValue}>3.0.0</Text>
          </View>
          <Pressable style={s.supportLink} testID="support-link">
            <Text style={s.supportLinkText}>Support</Text>
            <Ionicons name="open-outline" size={12} color={rinkGlass.blueLight} style={{ marginLeft: 4 }} />
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

/* ── Styles ────────────────────────────────────────────── */
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: rinkGlass.ice,
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },

  /* Header */
  headerArea: {
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: rinkGlass.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 16,
    fontFamily: rinkGlass.fonts.display,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: rinkGlass.ice,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: rinkGlass.blueLight,
  },
  identityCol: {
    flex: 1,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  emailText: {
    fontSize: 15,
    color: rinkGlass.textPrimary,
    fontWeight: '500',
    flexShrink: 1,
  },
  tierBadge: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  tierBadgePro: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: rinkGlass.blueLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tierBadgeTextPro: {
    color: rinkGlass.powerPlay,
  },
  signOutButton: {
    alignSelf: 'flex-start',
  },
  signOutText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 13,
  },
  signInPrompt: {
    color: rinkGlass.textSecondary,
    fontSize: 14,
  },

  /* Auth Buttons */
  authButtons: {
    gap: 10,
    marginTop: 16,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: rinkGlass.glass,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  emailAuthButton: {
    borderColor: 'rgba(42, 64, 128, 0.5)',
    backgroundColor: 'rgba(25, 46, 94, 0.6)',
  },
  authIcon: {
    marginRight: 10,
  },
  authButtonText: {
    color: rinkGlass.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },

  /* Stats Row */
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCardOuter: {
    flex: 1,
  },
  statCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    backgroundColor: rinkGlass.glass,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: rinkGlass.blueLight,
    letterSpacing: -0.5,
    fontFamily: rinkGlass.fonts.display,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: rinkGlass.textSecondary,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  /* Sections */
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    letterSpacing: 0.2,
    fontFamily: rinkGlass.fonts.display,
  },
  sectionLine: {
    height: 1,
    borderRadius: 1,
  },

  /* Card */
  card: {
    backgroundColor: rinkGlass.glass,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    padding: 16,
  },

  /* Subscription */
  subscriptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  planLabel: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
  },
  freeBadge: {
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  freeBadgeText: {
    color: rinkGlass.blueLight,
    fontWeight: '600',
    fontSize: 12,
  },
  upgradeOuter: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: rinkGlass.blueLight,
  },
  upgradeCard: {
    padding: 18,
  },
  upgradeBadgeRow: {},
  upgradeCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  upgradeButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    flex: 1,
  },
  upgradeSubtext: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
  },
  proActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  proActiveText: {
    color: rinkGlass.powerPlay,
    fontWeight: '700',
    fontSize: 16,
  },

  /* Notifications */
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  toggleRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(42, 64, 128, 0.5)',
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleIcon: {
    marginRight: 12,
  },
  toggleLabelRow: {
    flexDirection: 'column',
  },
  toggleLabel: {
    fontSize: 14,
    color: rinkGlass.textPrimary,
    fontWeight: '500',
  },
  toggleLabelDisabled: {
    opacity: 0.5,
  },
  proLockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  proLabel: {
    fontSize: 11,
    color: rinkGlass.textSecondary,
  },

  /* About */
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(42, 64, 128, 0.4)',
  },
  aboutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aboutLabel: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
  },
  aboutValue: {
    fontSize: 13,
    color: rinkGlass.textPrimary,
    fontWeight: '500',
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  supportLinkText: {
    color: rinkGlass.blueLight,
    fontWeight: '600',
    fontSize: 13,
  },
});
