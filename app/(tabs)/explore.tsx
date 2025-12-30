import React, { lazy, Suspense, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedView } from '../../components/ThemedView';
import { makeStyles, theme } from '../../constants/theme';
import { useAnalytics } from '../../hooks/useAnalytics';

// Lazy load the existing screen content as components
const TeamsContent = lazy(() => import('./teams'));
const PlayersContent = lazy(() => import('./more'));

export default function ExploreScreen() {
  const styles = makeStyles();
  const analytics = useAnalytics('ExploreScreen');
  const [activeTab, setActiveTab] = useState<'teams' | 'players'>('teams');

  // Track tab changes within explore
  const handleTabChange = (tab: 'teams' | 'players') => {
    setActiveTab(tab);
    analytics.trackCustomEvent('explore_tab_changed', {
      tab_name: tab,
    });
  };

  const LoadingFallback = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={theme.accent} />
    </View>
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: 0 }]}>
      {/* Header with Segmented Control */}
      <View style={localStyles.headerContainer}>
        <Text style={styles.title}>Explore</Text>
        <Text style={styles.subtitle}>Teams, players, and analytics</Text>

        {/* Segmented Control */}
        <View style={localStyles.segmentedControl}>
          <TouchableOpacity
            style={[
              localStyles.segmentButton,
              activeTab === 'teams' && localStyles.segmentButtonActive,
            ]}
            onPress={() => handleTabChange('teams')}
          >
            <Text
              style={[
                localStyles.segmentText,
                activeTab === 'teams' && localStyles.segmentTextActive,
              ]}
            >
              Teams
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              localStyles.segmentButton,
              activeTab === 'players' && localStyles.segmentButtonActive,
            ]}
            onPress={() => handleTabChange('players')}
          >
            <Text
              style={[
                localStyles.segmentText,
                activeTab === 'players' && localStyles.segmentTextActive,
              ]}
            >
              Players
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content based on active tab */}
      <View style={localStyles.contentContainer}>
        <Suspense fallback={<LoadingFallback />}>
          {activeTab === 'teams' ? (
            <TeamsContent embedded />
          ) : (
            <PlayersContent embedded />
          )}
        </Suspense>
      </View>
    </ThemedView>
  );
}

const localStyles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: theme.background,
    alignSelf: 'stretch',
    width: '100%',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 4,
    marginTop: 16,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentButtonActive: {
    backgroundColor: theme.accent,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.subtext,
  },
  segmentTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
  },
});
