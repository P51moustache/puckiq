import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalyticsProvider } from '../components/analytics/AnalyticsProvider';
import { AuthProvider, useAuthContext } from '../components/auth/AuthProvider';
import { SubscriptionProvider } from '../components/SubscriptionProvider';
import { ArenaOnboarding } from '../components/arena/ArenaOnboarding';
import { initializeNotifications } from '../services/notifications';
import { ArenaProvider, useArena } from '../components/arena/ArenaProvider';

const ONBOARDING_KEY = 'puckiq_onboarding_complete';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const { signInWithApple, signInWithGoogle } = useAuthContext();

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((value) => {
      setOnboardingComplete(value === 'true');
    });
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
      <ArenaOnboarding
        onComplete={handleOnboardingComplete}
        onApple={signInWithApple}
        onGoogle={signInWithGoogle}
      />
    );
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

function ArenaNavigation() {
  const { palette } = useArena();
  const navigationTheme = useMemo(() => ({ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: palette.page, card: palette.paper, text: palette.ink, primary: palette.link, border: palette.edge } }), [palette]);
  return <ThemeProvider value={navigationTheme}><AppContent /></ThemeProvider>;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Display-Bold': require('../assets/fonts/Oswald-Bold.ttf'),
    'Arena-Display': require('../assets/fonts/Teko-SemiBold.ttf'),
    'Arena-Sans': require('../assets/fonts/DMSans.ttf'),
  });

  const analyticsConfig = useMemo(() => ({ enabled: true, debug: __DEV__ }), []);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      // Initialize notifications (schedule daily results if enabled)
      initializeNotifications().catch((error) => {
        console.log('[Notifications] Failed to initialize:', error);
      });
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <SubscriptionProvider>
        <AnalyticsProvider config={analyticsConfig}>
          <ArenaProvider><ArenaNavigation /></ArenaProvider>
        </AnalyticsProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
