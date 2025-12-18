import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import 'react-native-reanimated';
import { AnalyticsProvider } from '../components/analytics/AnalyticsProvider';
import { initializeNotifications } from '../services/notifications';
// Auth disabled for now - uncomment when ready to implement user accounts
// import { AuthProvider } from '../components/auth/AuthProvider';
// import { useAuth } from '../hooks/useAuth';

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

  // Auth disabled for now - wrap with AuthProvider when ready to implement user accounts
  return (
    <AnalyticsProvider config={analyticsConfig}>
      <ThemeProvider value={DarkTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* Auth routes disabled - uncomment when ready to implement user accounts */}
          {/* <Stack.Screen name="(auth)" options={{ headerShown: false }} /> */}
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </AnalyticsProvider>
  );
}

// Auth disabled for now - uncomment RootNavigator when ready to implement user accounts
/*
function RootNavigator() {
  const { initializing } = useAuth();

  if (initializing) {
    return null;
  }

  // Allow guest access - authentication is optional
  // Users can sign in from Settings to sync picks and enable cloud features
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
*/
