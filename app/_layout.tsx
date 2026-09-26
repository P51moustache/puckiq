import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
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
  // Status bar sits over the dark frame once the screen is wider than the column.
  const framed = useWindowDimensions().width > MAX_COLUMN_WIDTH;

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
    return (
      <View style={styles.frame}>
        <View style={styles.column}>
          <CoachOnboarding onComplete={handleOnboardingComplete} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <View style={styles.column}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </View>
      <StatusBar style={framed ? 'light' : 'dark'} />
    </View>
  );
}

/** Phone-shaped column on iPad: the layouts are built for one hand, so keep them that width. */
const MAX_COLUMN_WIDTH = 640;

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.ink,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_COLUMN_WIDTH,
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
