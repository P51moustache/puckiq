import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useSubscription } from './SubscriptionProvider';

const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';

function getAdUnitId(): string {
  if (__DEV__) return TEST_BANNER_ID;
  return process.env.EXPO_PUBLIC_ADMOB_BANNER_ID ?? TEST_BANNER_ID;
}

export default function BannerAd() {
  const { isPremium } = useSubscription();

  if (isPremium) return null;

  // Skip ads on web — AdMob only supports iOS/Android
  if (Platform.OS === 'web') return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ads = require('react-native-google-mobile-ads');
    const AdMobBanner = ads.BannerAd;
    const { BannerAdSize } = ads;

    return (
      <View style={styles.container} testID="banner-ad-container">
        <AdMobBanner
          unitId={getAdUnitId()}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        />
      </View>
    );
  } catch {
    // react-native-google-mobile-ads not installed — silently skip
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
});
