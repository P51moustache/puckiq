import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useCallback, useEffect, useMemo, useState } from 'react';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalyticsProvider } from '../components/analytics/AnalyticsProvider';
import { AuthProvider, useAuthContext } from '../components/auth/AuthProvider';
import { SubscriptionProvider } from '../components/SubscriptionProvider';
import { ArenaOnboarding } from '../components/arena/ArenaOnboarding';
import { ArenaProvider, useArena } from '../components/arena/ArenaProvider';
import { initializeNotificationsIfSupported } from '../utils/runtimeCapabilities';

const ONBOARDING_KEY = 'puckiq_onboarding_complete';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { palette } = useArena();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [onboardingError, setOnboardingError] = useState(false);
  const [onboardingAttempt, setOnboardingAttempt] = useState(0);
  const { error: authError, signInWithApple, signInWithGoogle } = useAuthContext();

  useEffect(() => {
    let mounted = true;
    setOnboardingError(false);
    AsyncStorage.getItem(ONBOARDING_KEY).then((value) => {
      if (mounted) setOnboardingComplete(value === 'true');
    }).catch(() => {
      if (mounted) setOnboardingError(true);
    });
    return () => { mounted = false; };
  }, [onboardingAttempt]);

  const handleOnboardingComplete = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setOnboardingComplete(true);
  }, []);

  // Still loading onboarding state
  if (onboardingError) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14, backgroundColor: palette.page }}><Text accessibilityRole="header" style={{ fontFamily: 'Arena-Display', fontSize: 36, color: palette.ink }}>COULD NOT START</Text><Text accessibilityRole="alert" style={{ textAlign: 'center', color: palette.muted }}>PuckIQ could not read this device’s setup. Your saved data has not been changed.</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry device setup" testID="retry-onboarding-read" onPress={() => setOnboardingAttempt((attempt) => attempt + 1)} style={{ minHeight: 48, paddingHorizontal: 20, justifyContent: 'center', backgroundColor: palette.action, borderColor: palette.frame, borderWidth: 2, borderRadius: 8 }}><Text style={{ color: palette.actionInk }}>Try again</Text></Pressable></View>;
  }
  if (onboardingComplete === null) {
    return null;
  }

  if (!onboardingComplete) {
    return (
      <ArenaOnboarding
        onComplete={handleOnboardingComplete}
        onApple={signInWithApple}
        onGoogle={signInWithGoogle}
        authError={authError}
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
      initializeNotificationsIfSupported(
        Platform.OS,
        Constants.appOwnership,
        () => import('../services/notifications'),
      ).catch((error) => {
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
