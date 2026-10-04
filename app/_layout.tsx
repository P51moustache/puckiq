import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalyticsProvider } from '../components/analytics/AnalyticsProvider';
import { AuthProvider } from '../components/auth/AuthProvider';
import { SubscriptionProvider } from '../components/SubscriptionProvider';
import { TeamsProvider } from '../components/TeamsProvider';
import { RemindersProvider } from '../components/RemindersProvider';
import { PaywallProvider } from '../components/PaywallProvider';
import { PlayerSheetProvider } from '../components/sheets/PlayerSheet';
import CloudSync from '../components/CloudSync';
import { CoachOnboarding } from '../components/onboarding/CoachOnboarding';
import { ONBOARDING_KEY } from '../constants/release';
import { LEGACY_ACTIVITY_KEYS } from '../services/releaseNotice';
import { ReleaseNotice } from '../components/release/ReleaseNotice';
import { LEGACY_ROSTER_KEY } from '../services/teams';
import { pruneNhlDiskCache } from '../services/nhl/client';
import { colors } from '../components/coach/ui';
import { useUsageJourney } from '../hooks/useUsageJourney';
import { TeamActivity } from '../components/analytics/TeamActivity';

const NAV_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.card, text: colors.text, primary: colors.accent },
};

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [hadSavedSetup, setHadSavedSetup] = useState(false);
  const pathname = usePathname();

  useUsageJourney(onboardingComplete === null ? null : onboardingComplete ? (pathname === '/' ? '/tonight' : pathname) : '/onboarding');

  useEffect(() => {
    AsyncStorage.multiGet([ONBOARDING_KEY, LEGACY_ROSTER_KEY, ...LEGACY_ACTIVITY_KEYS])
      .then((entries) => {
        const values = new Map(entries);
        setHadSavedSetup(values.get(ONBOARDING_KEY) === 'true' || Boolean(values.get(LEGACY_ROSTER_KEY)) || LEGACY_ACTIVITY_KEYS.some((key) => Boolean(values.get(key))));
        setOnboardingComplete(values.get(ONBOARDING_KEY) === 'true');
      })
      .catch(() => setOnboardingComplete(false));
    // Housekeeping off the critical path.
    pruneNhlDiskCache().catch(() => undefined);
  }, []);

  const handleOnboardingComplete = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setOnboardingComplete(true);
  }, []);

  // Still loading onboarding state
  if (onboardingComplete === null) {
    return null;
  }

  if (!onboardingComplete) {
    // Onboarding is a one-hand flow: on iPad it sits in a centered column on carbon.
    return (
      <View style={styles.frame}>
        <View style={styles.column}>
          <CoachOnboarding onComplete={handleOnboardingComplete} />
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="dark" />
      <ReleaseNotice hadSavedSetup={hadSavedSetup} />
    </>
  );
}

const ONBOARDING_MAX_WIDTH = 600;

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.ink,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: ONBOARDING_MAX_WIDTH,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
});

export default function RootLayout() {
  const analyticsConfig = useMemo(() => ({ enabled: true, debug: __DEV__ }), []);

  // The UI uses the system face (heavy italic) — no custom fonts to wait for.
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <AnalyticsProvider config={analyticsConfig}>
            <TeamsProvider>
              <TeamActivity />
              <RemindersProvider>
                <PaywallProvider>
                  <PlayerSheetProvider>
                    <ThemeProvider value={NAV_THEME}>
                      <CloudSync />
                      <AppContent />
                    </ThemeProvider>
                  </PlayerSheetProvider>
                </PaywallProvider>
              </RemindersProvider>
            </TeamsProvider>
          </AnalyticsProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
