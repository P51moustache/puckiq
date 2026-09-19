import { useState, useEffect, useCallback } from 'react';
import {
  Pressable,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass as baseRinkGlass } from '../constants/theme';
import { useArena } from './arena/ArenaProvider';
import type { ArenaPalette } from '../constants/arenaTheme';
import { arenaType } from './arena/ArenaPrimitives';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthContext } from './auth/AuthProvider';
import { useSubscription } from './SubscriptionProvider';
import { getSettingsReturnRoute, getSupportDestination } from '../utils/accountFlowPolicy';

import {
  FantasyNotificationPreferences,
  DEFAULT_FANTASY_PREFS,
  loadFantasyNotificationPrefs,
  saveFantasyNotificationPrefs,
} from '../services/notificationSettings';

function arenaSettingsTheme(p: ArenaPalette) {
  return { ...baseRinkGlass, ice: p.page, boards: p.paper, glass: p.paper, zamboni: p.soft, glassBorder: p.edge, textPrimary: p.ink, textSecondary: p.muted, textMuted: p.muted, blueLight: p.link, blueLine: p.hero, fonts: { ...baseRinkGlass.fonts, display: arenaType.display } };
}
const rinkGlass = baseRinkGlass;

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

const REMOTE_ALERTS_AVAILABLE = false;

/* ── Section Header ────────────────────────────────────── */
function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  const { palette } = useArena();
  const rinkGlass = arenaSettingsTheme(palette);
  const s = createStyles(rinkGlass);
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

/* ── Main Component ────────────────────────────────────── */
export default function HubScreen() {
  const { palette } = useArena();
  const rinkGlass = arenaSettingsTheme(palette);
  const s = createStyles(rinkGlass);
  const { user, error: authError, signInWithApple, signInWithGoogle, signOut } = useAuthContext();
  const { origin } = useLocalSearchParams<{ origin?: string }>();
  const [authBusy, setAuthBusy] = useState<'apple' | 'google' | null>(null);
  const [authFeedback, setAuthFeedback] = useState<string | null>(null);
  const [helpVisible, setHelpVisible] = useState(false);
  const [supportFeedback, setSupportFeedback] = useState<string | null>(null);
  const [signOutVisible, setSignOutVisible] = useState(false);
  const supportDestination = getSupportDestination(process.env.EXPO_PUBLIC_SUPPORT_DESTINATION);
  const {
    isPremium,
    loading: subscriptionLoading,
    showPaywall,
    subscriptionUnavailableReason,
    retrySubscription,
  } = useSubscription();
  const [notificationPrefs, setNotificationPrefs] = useState<FantasyNotificationPreferences>({
    ...DEFAULT_FANTASY_PREFS,
    morningBrief: false,
    goalieConfirmed: false,
    injuryAlerts: false,
    gameReminder: false,
    waiverAlerts: false,
  });
  const [, setPrefsLoaded] = useState(false);

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
      if (!user?.id || !isPremium || !REMOTE_ALERTS_AVAILABLE) return;

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

  const canToggle = !!user && isPremium && REMOTE_ALERTS_AVAILABLE;
  const handleSubscriptionPress = useCallback(() => {
    if (subscriptionLoading) return;
    if (subscriptionUnavailableReason) {
      void retrySubscription();
      return;
    }
    showPaywall('Subscription options and restore');
  }, [retrySubscription, showPaywall, subscriptionLoading, subscriptionUnavailableReason]);

  const subscriptionStatus = subscriptionLoading
    ? 'Checking subscription…'
    : subscriptionUnavailableReason
      ? 'Subscriptions unavailable'
      : isPremium
        ? 'PuckIQ Pro active'
        : 'No active subscription';
  const runAuth = useCallback(async (provider: 'apple' | 'google') => {
    setAuthBusy(provider);
    setAuthFeedback(null);
    try {
      const ok = await (provider === 'apple' ? signInWithApple() : signInWithGoogle());
      if (!ok) setAuthFeedback('Sign-in did not finish. You can retry or continue using PuckIQ on this device.');
    } catch {
      setAuthFeedback('Sign-in could not open. You can retry or continue using PuckIQ on this device.');
    } finally {
      setAuthBusy(null);
    }
  }, [signInWithApple, signInWithGoogle]);

  const leaveSettings = useCallback(() => {
    if (router.canGoBack?.()) router.back();
    else router.push(getSettingsReturnRoute(origin));
  }, [origin]);

  const openSupportDestination = useCallback(() => {
    if (!supportDestination) return;
    const url = supportDestination.type === 'email'
      ? `mailto:${supportDestination.value}?subject=PuckIQ%20support`
      : supportDestination.value;
    setSupportFeedback(null);
    Promise.resolve(Linking.openURL(url)).catch(() => setSupportFeedback('Could not open the support destination. Use the recovery actions here and try again.'));
  }, [supportDestination]);

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 13 }}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={leaveSettings} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}><Ionicons name="arrow-back" color={palette.ink} size={25} /></Pressable><Text style={{ fontFamily: arenaType.display, color: palette.ink, fontSize: 40 }}>SETTINGS</Text></View>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.section} testID="subscription-section">
          <SectionHeader icon="card-outline" title="Subscription" />
          <View style={s.card}>
            <View style={s.subscriptionRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.planLabel}>{subscriptionStatus}</Text>
                {subscriptionUnavailableReason && (
                  <Text style={s.toggleHelper}>{subscriptionUnavailableReason}</Text>
                )}
              </View>
              {!subscriptionLoading && !subscriptionUnavailableReason && (
                <View style={s.freeBadge}>
                  <Text style={s.freeBadgeText}>{isPremium ? 'PRO' : 'FREE'}</Text>
                </View>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              style={s.authButton}
              onPress={handleSubscriptionPress}
              disabled={subscriptionLoading}
              testID="subscription-options-button"
            >
              <Ionicons name="card-outline" size={18} color={rinkGlass.textPrimary} style={s.authIcon} />
              <Text style={s.authButtonText}>
                {subscriptionUnavailableReason ? 'Retry subscription setup' : 'Subscription options and restore'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── Notifications (the actual settings) ───────── */}
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
                  <Text style={[s.toggleLabel, !canToggle && s.toggleLabelDisabled]}>
                    {label}
                  </Text>
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
            <Text style={s.toggleHelper}>Remote alerts are unavailable in this build.</Text>
          </View>
        </View>

        {/* ── Account ───────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader icon="person-outline" title="Account" />
          <View style={s.card}>
            {user ? (
              <View style={s.accountRow}>
                <View style={s.accountInfo}>
                  <Text style={s.emailText} numberOfLines={1}>{user.email}</Text>
                  <Text style={s.accountStatus}>SIGNED IN</Text>
                </View>
                <Pressable
                  style={s.signOutButton}
                  onPress={() => setSignOutVisible(true)}
                  testID="sign-out-button"
                >
                  <Text style={s.signOutText}>Sign out</Text>
                </Pressable>
              </View>
            ) : (
              <View style={s.authButtons}>
                {Platform.OS === 'ios' && <Pressable
                  style={s.authButton}
                  onPress={() => void runAuth('apple')}
                  disabled={authBusy !== null}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: authBusy !== null, busy: authBusy === 'apple' }}
                  testID="sign-in-apple"
                >
                  <Ionicons name="logo-apple" size={18} color={rinkGlass.textPrimary} style={s.authIcon} />
                  {authBusy === 'apple' && <ActivityIndicator color={rinkGlass.textPrimary} size="small" />}
                  <Text style={s.authButtonText}>{authBusy === 'apple' ? 'Opening Apple…' : 'Continue with Apple'}</Text>
                </Pressable>}
                <Pressable
                  style={s.authButton}
                  onPress={() => void runAuth('google')}
                  disabled={authBusy !== null}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: authBusy !== null, busy: authBusy === 'google' }}
                  testID="sign-in-google"
                >
                  <Ionicons name="logo-google" size={16} color={rinkGlass.textPrimary} style={s.authIcon} />
                  {authBusy === 'google' && <ActivityIndicator color={rinkGlass.textPrimary} size="small" />}
                  <Text style={s.authButtonText}>{authBusy === 'google' ? 'Opening Google…' : 'Continue with Google'}</Text>
                </Pressable>
                {(authFeedback || authError) && <Text accessibilityRole="alert" style={s.toggleHelper}>{authFeedback || authError}</Text>}
              </View>
            )}
          </View>
        </View>

        {/* ── About ───────────────────────────────────── */}
        <View style={s.aboutRow}>
          <View style={s.aboutLeft}>
            <Text style={s.aboutLabel}>VERSION</Text>
            <Text style={s.aboutValue}>3.0.0</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open PuckIQ help" style={s.supportLink} testID="support-link" onPress={() => setHelpVisible(true)}>
            <Text style={s.supportLinkText}>Support</Text>
            <Ionicons name="open-outline" size={12} color={rinkGlass.blueLight} style={{ marginLeft: 4 }} />
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
      <Modal visible={helpVisible} transparent animationType="fade" onRequestClose={() => setHelpVisible(false)} testID="support-modal">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={[s.card, { gap: 14 }]}>
            <Text style={s.screenTitle}>HELP</Text>
            <Text style={s.planLabel}>Subscription recovery</Text><Text style={s.toggleHelper}>Open Subscription options to retry setup, restore purchases, or confirm your current entitlement.</Text>
            <Pressable accessibilityRole="button" testID="help-subscription-options" onPress={() => { setHelpVisible(false); handleSubscriptionPress(); }} style={s.authButton}><Text style={s.authButtonText}>Subscription options</Text></Pressable>
            <Text style={s.planLabel}>Feed and schedule recovery</Text><Text style={s.toggleHelper}>Return to Tonight and pull to refresh. Saved cards and preferences remain on this device.</Text>
            <Pressable accessibilityRole="button" testID="help-go-tonight" onPress={() => { setHelpVisible(false); router.push('/(tabs)'); }} style={s.authButton}><Text style={s.authButtonText}>Go to Tonight</Text></Pressable>
            {supportDestination && <Pressable accessibilityRole="link" onPress={openSupportDestination} style={s.authButton}><Text style={s.authButtonText}>Contact support</Text></Pressable>}
            {supportFeedback && <Text accessibilityRole="alert" style={s.toggleHelper}>{supportFeedback}</Text>}
            <Pressable accessibilityRole="button" onPress={() => setHelpVisible(false)} style={s.authButton}><Text style={s.authButtonText}>Close help</Text></Pressable>
          </View>
        </View>
      </Modal>
      <Modal visible={signOutVisible} transparent animationType="fade" onRequestClose={() => setSignOutVisible(false)} testID="sign-out-confirm">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}><View style={[s.card, { gap: 14 }]}>
          <Text style={s.screenTitle}>SIGN OUT?</Text><Text style={s.toggleHelper}>Saved cards, watched players, and team preferences stay on this device.</Text>
          <Pressable accessibilityRole="button" onPress={() => { setSignOutVisible(false); void signOut(); }} style={s.signOutButton}><Text style={s.signOutText}>Sign out</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setSignOutVisible(false)} style={s.authButton}><Text style={s.authButtonText}>Keep me signed in</Text></Pressable>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Styles ────────────────────────────────────────────── */
const createStyles = (rinkGlass: ReturnType<typeof arenaSettingsTheme>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: rinkGlass.ice,
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
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  signOutText: {
    color: rinkGlass.textSecondary,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  signInPrompt: {
    color: rinkGlass.textSecondary,
    fontSize: 14,
  },

  /* Auth Buttons */
  authButtons: {
    gap: 8,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: rinkGlass.zamboni,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  accountInfo: {
    flex: 1,
  },
  accountStatus: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: rinkGlass.faceoffDot,
    marginTop: 2,
    fontFamily: rinkGlass.fonts.mono,
    fontWeight: '700',
  },
  toggleHelper: {
    fontSize: 11,
    color: rinkGlass.textMuted,
    paddingHorizontal: 4,
    paddingTop: 8,
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
