import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import 'react-native-reanimated';
import { AnalyticsProvider } from '../components/analytics/AnalyticsProvider';
import { AuthProvider } from '../components/auth/AuthProvider';
import { SubscriptionProvider } from '../components/SubscriptionProvider';
import { initializeNotifications } from '../services/notifications';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
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
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="light" />
          </ThemeProvider>
        </AnalyticsProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

