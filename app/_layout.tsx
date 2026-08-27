import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { AnalyticsProvider } from '../components/analytics/AnalyticsProvider';
import { AuthProvider } from '../components/auth/AuthProvider';
import { SubscriptionProvider } from '../components/SubscriptionProvider';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function AppContent() {
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
            <SafeAreaProvider>
              <AppContent />
            </SafeAreaProvider>
          </ThemeProvider>
        </AnalyticsProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
