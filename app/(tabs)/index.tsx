import React, { useCallback } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import LiveNowBar from '../../components/LiveNowBar';
import LeagueBriefing from '../../components/LeagueBriefing';
import FloatingTodayBar from '../../components/FloatingTodayBar';
import { ThemedView } from '../../components/ThemedView';
import { makeStyles, rinkGlass, theme } from '../../constants/theme';
import Toast from '../../components/Toast';
import { useTonightData } from '../../hooks/useTonightData';

export default function TonightScreen() {
  const styles = makeStyles();

  const {
    isLoading,
    refreshing,
    onRefresh,
    todaysGames,
    gameCount,
    toastMessage,
    currentStandings,
    hasGamesToday,
    isShowingUpcoming,
    gamesByDate,
    predictionsMap,
    h2hMap,
    momentumMap,
    formMap,
    restMap,
    edgeTeamLanding,
    lastFetchTime,
  } = useTonightData();

  const handleGamePress = useCallback(() => {}, []);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  return (
    <ThemedView style={[styles.container, { backgroundColor: rinkGlass.ice }]}>
      <Animated.ScrollView
        style={{ alignSelf: 'stretch', width: '100%' }}
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={onScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        {/* Page header — name + date in stat-sheet voice */}
        <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: rinkGlass.textPrimary, fontFamily: 'Display-Bold', letterSpacing: 0.5 }}>
            PuckIQ
          </Text>
          <Text style={{ fontSize: 10, color: rinkGlass.textSecondary, marginTop: 2, letterSpacing: 1.5 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}
            <Text style={{ color: rinkGlass.textMuted }}>  ·  LEAGUE BRIEFING</Text>
          </Text>
        </View>

        {gameCount > 0 && (
          <LiveNowBar
            games={todaysGames?.games ?? []}
            onGamePress={handleGamePress}
          />
        )}

        <LeagueBriefing
          todaysGames={todaysGames}
          currentStandings={currentStandings}
          isLoading={isLoading}
          hasGamesToday={hasGamesToday}
          isShowingUpcoming={isShowingUpcoming}
          gamesByDate={gamesByDate}
          predictionsMap={predictionsMap}
          h2hMap={h2hMap}
          momentumMap={momentumMap}
          formMap={formMap}
          restMap={restMap}
          edgeTeamLanding={edgeTeamLanding}
          lastFetchTime={lastFetchTime}
          onRefresh={onRefresh}
        />
      </Animated.ScrollView>

      {/* Floating top bar — appears after the hero scrolls out of view */}
      <FloatingTodayBar
        scrollY={scrollY}
        threshold={320}
        gameCount={gameCount}
        onRefresh={onRefresh}
      />

      <Toast message={toastMessage} />
    </ThemedView>
  );
}
