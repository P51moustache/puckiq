import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import { ONBOARDING_KEY } from '../components/screens/SettingsScreen';
import { pruneNhlDiskCache } from '../services/nhl/client';
import { colors } from '../components/coach/ui';
import { trackScreen } from '../services/analytics/track';

const NAV_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.card, text: colors.text, primary: colors.accent },
};

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (onboardingComplete) trackScreen(pathname === '/' ? '/tonight' : pathname);
  }, [pathname, onboardingComplete]);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((value) => setOnboardingComplete(value === 'true'))
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
    return <CoachOnboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}

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
