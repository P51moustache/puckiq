import { DarkTheme, ThemeProvider } from '@react-navigation/native';
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
import { OnboardingFlow } from '../components/onboarding/OnboardingFlow';
import { initializeNotifications } from '../services/notifications';

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
      <OnboardingFlow
        onComplete={handleOnboardingComplete}
        onSignInWithApple={signInWithApple}
        onSignInWithGoogle={signInWithGoogle}
      />
    );
  }

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Display-Bold': require('../assets/fonts/Oswald-Bold.ttf'),
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
          <ThemeProvider value={DarkTheme}>
            <AppContent />
          </ThemeProvider>
        </AnalyticsProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
