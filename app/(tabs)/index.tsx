import React, { useState, useCallback, useEffect } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FinishSetupCard from '../../components/FinishSetupCard';
import LiveNowBar from '../../components/LiveNowBar';
import EmptyNightCard from '../../components/EmptyNightCard';
import { ThemedView } from '../../components/ThemedView';
import DashboardContainer from '../../components/dashboard/DashboardContainer';
import { SettingsButton } from '../../components/SettingsButton';
import { makeStyles, rinkGlass, theme } from '../../constants/theme';
import Toast from '../../components/Toast';
import { useTonightData } from '../../hooks/useTonightData';

export default function TonightScreen() {
  const styles = makeStyles();

  // All data, state, and logic from the hook
  const {
    isLoading,
    refreshing,
    onRefresh,
    todaysGames,
    gameCount,
    toastMessage,
    currentStandings,
  } = useTonightData();

  // Favorite team from AsyncStorage
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('selectedTeam').then(team => {
      if (team) setSelectedTeam(team);
    });
  }, []);

  // No-op game press handler (deep dive modal removed for now)
  const handleGamePress = useCallback(() => {}, []);

  return (
    <ThemedView style={[styles.container, { backgroundColor: rinkGlass.ice }]}>
      <ScrollView
        style={{ alignSelf: 'stretch', width: '100%' }}
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        {/* Compact header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
          <View>
            <Text style={{ fontSize: 24, fontWeight: '700', color: rinkGlass.textPrimary, fontFamily: 'Display-Bold', letterSpacing: 1 }}>
              PuckIQ
            </Text>
            <Text style={{ fontSize: 12, color: rinkGlass.textSecondary, marginTop: 2 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <SettingsButton />
        </View>

        {/* LOADING STATE */}
        {isLoading && (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        )}

        {/* LIVE NOW BAR — compact ticker for live games */}
        {gameCount > 0 && (
          <LiveNowBar
            games={todaysGames?.games ?? []}
            onGamePress={handleGamePress}
          />
        )}

        {/* DASHBOARD COMMAND CENTER — modular fantasy widgets (primary content) */}
        <View style={{ marginTop: 4 }}>
          <DashboardContainer />
        </View>

        {/* FINISH SETUP NUDGE — below dashboard, less prominent */}
        <FinishSetupCard onSetUpNow={() => {}} />

        {/* EMPTY STATE — no games today */}
        {!isLoading && gameCount === 0 && (
          <EmptyNightCard
            selectedTeam={selectedTeam}
            standings={currentStandings}
          />
        )}
      </ScrollView>

      {/* Toast Notification */}
      <Toast message={toastMessage} />
    </ThemedView>
  );
}
