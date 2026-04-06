import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GameDeepDiveModal from '../../components/GameDeepDiveModal';
import FinishSetupCard from '../../components/FinishSetupCard';
import HeroBanner from '../../components/HeroBanner';
import LiveNowBar from '../../components/LiveNowBar';
import AllGamesCard from '../../components/AllGamesCard';
import Spotlight from '../../components/EdgeSpotlight';
import EmptyNightCard from '../../components/EmptyNightCard';
import StatOfTheNight from '../../components/StatOfTheNight';
import CompactGameRow from '../../components/CompactGameRow';
import StandingsWidget from '../../components/StandingsWidget';
import InsightFeed from '../../components/InsightFeed';
import { ThemedView } from '../../components/ThemedView';
import DashboardContainer from '../../components/dashboard/DashboardContainer';
import { Skeleton } from '../../components/ui/SkeletonLoader';
import { SettingsButton } from '../../components/SettingsButton';
import { makeStyles, theme, rinkGlass } from '../../constants/theme';
import Toast from '../../components/Toast';
import InfoTooltip from '../../components/InfoTooltip';
import { useTonightData } from '../../hooks/useTonightData';
import { useGlossary } from '../../hooks/useGlossary';
import RosterBuilder from '../../components/RosterBuilder';
import type { SituationalFactors } from '../../types/predictions';

export default function TonightScreen() {
  const styles = makeStyles();

  // Deep dive modal state (UI-coupled, stays in component)
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedGame, setSelectedGame] = useState<any>(null);

  // Roster builder modal (triggered by FinishSetupCard)
  const [rosterBuilderVisible, setRosterBuilderVisible] = useState(false);

  // Glossary tooltip state
  const glossary = useGlossary();

  // All data, state, and logic from the hook
  const data = useTonightData();

  const handleOpenDeepDive = useCallback((game: any) => {
    setSelectedGame(game);
    setModalVisible(true);
    data.analytics.trackCustomEvent('game_deep_dive_opened', {
      game_id: String(game.id),
      home_team: game.homeTeam?.abbrev,
      away_team: game.awayTeam?.abbrev,
      matchup: `${game.awayTeam?.abbrev} @ ${game.homeTeam?.abbrev}`,
      game_state: game.gameState,
    });
  }, [data.analytics]);

  const {
    isLoading,
    refreshing,
    onRefresh,
    todaysGames,
    gameCount,
    heroGame,
    remainingGames,
    gamesByDate,
    hasGamesToday,
    isShowingUpcoming,
    predictionsMap,
    heroPrediction,
    heroConfidence,
    heroH2H,
    calculateWinProbability,
    h2hMap,
    momentumMap,
    restMap,
    edgeSkaterLanding,
    edgeTeamLanding,
    playerStatsMap,
    formMap,
    toastMessage,
    handleShareHero,
    currentStandings,
    lastFetchTime,
  } = data;

  // Favorite team from AsyncStorage
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('selectedTeam').then(team => {
      if (team) setSelectedTeam(team);
    });
  }, []);

  // Sort remaining games by prediction confidence, strongest picks first
  const sortedRemaining = useMemo(() => {
    return [...remainingGames].sort((a, b) => {
      const predA = predictionsMap.get(String(a.id));
      const predB = predictionsMap.get(String(b.id));
      const confA = predA ? Math.abs(predA.homeWinProb - 50) : 0;
      const confB = predB ? Math.abs(predB.homeWinProb - 50) : 0;
      return confB - confA;
    });
  }, [remainingGames, predictionsMap]);

  // Featured cards = top 2 strongest picks, rest as compact rows
  const featuredGames = sortedRemaining.slice(0, 2);
  const compactGames = sortedRemaining.slice(2);

  // Pick the best positive insight as "Stat of the Night"
  const statOfTheNight = useMemo(() => {
    if (!data.insights || data.insights.length === 0) return null;
    return data.insights.find((i) => i.sentiment !== 'negative') ?? null;
  }, [data.insights]);

  const handleShareStat = useCallback(async () => {
    if (!statOfTheNight) return;
    try {
      await Share.share({ message: statOfTheNight.shareText ?? statOfTheNight.text });
    } catch (_) {
      // ignore share cancellation
    }
  }, [statOfTheNight]);

  // Share handler for AllGamesCard
  const handleShareGame = useCallback(async (game: any) => {
    const away = game.awayTeam?.abbrev || '???';
    const home = game.homeTeam?.abbrev || '???';
    const pred = predictionsMap.get(String(game.id));
    const prob = pred ? Math.round(Math.max(pred.homeWinProb, pred.awayWinProb)) : 50;
    const favored = pred && pred.homeWinProb > pred.awayWinProb ? home : away;
    try {
      await Share.share({
        message: `${away} @ ${home} -- ${favored} at ${prob}% (PuckIQ)`,
      });
    } catch {
      // User cancelled
    }
  }, [predictionsMap]);

  // Share handler for InsightFeed
  const handleShareInsight = useCallback(async (insightText: string) => {
    try {
      await Share.share({
        message: `${insightText} (PuckIQ)`,
      });
    } catch {
      // User cancelled
    }
  }, []);


  // Compute real SituationalFactors for the hero game from restMap
  const heroSituationalFactors = useMemo((): SituationalFactors | null => {
    if (!heroGame) return null;
    const homeAbbrev = heroGame.homeTeam?.abbrev;
    const awayAbbrev = heroGame.awayTeam?.abbrev;
    if (!homeAbbrev || !awayAbbrev) return null;

    const homeRest = restMap.get(homeAbbrev) ?? 50;
    const awayRest = restMap.get(awayAbbrev) ?? 50;

    // restMap values: 0=B2B, 50=1day, 75=2days, 100=3+days
    // Convert to rest days: 0→0, 50→1, 75→2, 100→3
    const homeRestDays = homeRest === 0 ? 0 : homeRest === 50 ? 1 : homeRest === 75 ? 2 : 3;
    const awayRestDays = awayRest === 0 ? 0 : awayRest === 50 ? 1 : awayRest === 75 ? 2 : 3;

    return {
      homeBackToBack: homeRest === 0,
      awayBackToBack: awayRest === 0,
      homeRestDays,
      awayRestDays,
      restAdvantage: homeRest > awayRest ? 'home' : awayRest > homeRest ? 'away' : 'neutral',
    };
  }, [heroGame, restMap]);


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
        {/* LOADING STATE — PuckIQ branding + skeleton */}
        {isLoading && !heroGame && (
          <View style={{ width: '100%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 2 }}>PuckIQ</Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.subtext, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>
                  YOUR EDGE BEFORE EVERY PICK
                </Text>
              </View>
              <SettingsButton />
            </View>
            {/* Hero skeleton */}
            <View style={{ marginHorizontal: 16, backgroundColor: theme.card, borderRadius: 18, padding: 20, height: 260, borderWidth: 1.5, borderColor: theme.factbox }}>
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Skeleton width={40} height={40} borderRadius={20} />
                <Skeleton width={24} height={14} style={{ marginHorizontal: 12 }} />
                <Skeleton width={40} height={40} borderRadius={20} />
              </View>
              <Skeleton width="60%" height={24} style={{ alignSelf: 'center', marginBottom: 14 }} />
              <Skeleton width="80%" height={32} borderRadius={16} style={{ alignSelf: 'center', marginBottom: 14 }} />
              <Skeleton width={100} height={14} style={{ alignSelf: 'center' }} />
            </View>

            {/* Section header skeleton */}
            <View style={{ paddingHorizontal: 16, marginTop: 20, marginBottom: 14 }}>
              <Skeleton width={80} height={14} style={{ marginBottom: 6 }} />
              <Skeleton width={32} height={2} />
            </View>

            {/* Game card skeletons */}
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              {[1, 2].map((i) => (
                <View key={i} style={{ backgroundColor: theme.card, borderRadius: 14, padding: 16, height: 120, borderWidth: 1, borderColor: theme.subtle }}>
                  <Skeleton width={80} height={14} style={{ marginBottom: 8 }} />
                  <Skeleton width={80} height={14} style={{ marginBottom: 14 }} />
                  <Skeleton width="60%" height={20} borderRadius={10} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* HERO BANNER — cinematic hero zone with photo background */}
        {heroGame && (
          <HeroBanner
            game={heroGame}
            prediction={heroPrediction}
            confidenceScore={heroConfidence}
            h2hRecord={heroH2H}
            situationalFactors={heroSituationalFactors}
            onPress={() => handleOpenDeepDive(heroGame)}
            onShare={handleShareHero}
            onInfoPress={glossary.showTerm}
            awayForm={formMap.get(heroGame.awayTeam?.abbrev) ?? null}
            homeForm={formMap.get(heroGame.homeTeam?.abbrev) ?? null}
            isYourTeam={selectedTeam ? (heroGame.homeTeam?.abbrev === selectedTeam || heroGame.awayTeam?.abbrev === selectedTeam) : false}
          />
        )}

        {/* FINISH SETUP NUDGE — for users who skipped onboarding roster */}
        <FinishSetupCard onSetUpNow={() => setRosterBuilderVisible(true)} />

        {/* LIVE NOW BAR — below hero during live games */}
        {gameCount > 0 && (
          <LiveNowBar
            games={todaysGames?.games ?? []}
            onGamePress={handleOpenDeepDive}
          />
        )}


        {/* DASHBOARD COMMAND CENTER — modular fantasy widgets */}
        <View style={{ marginTop: 16 }}>
          <DashboardContainer />
        </View>

        {/* EMPTY STATE — PuckIQ branding + no games today */}
        {!isLoading && gameCount === 0 && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 2 }}>PuckIQ</Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.subtext, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>
                  YOUR EDGE BEFORE EVERY PICK
                </Text>
              </View>
              <SettingsButton />
            </View>
            <EmptyNightCard
              selectedTeam={selectedTeam}
              standings={currentStandings}
            />
          </>
        )}
      </ScrollView>

      {/* Deep Dive Modal */}
      {selectedGame && (
        <GameDeepDiveModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          game={selectedGame}
          prediction={calculateWinProbability(
            selectedGame.homeTeam?.abbrev || '',
            selectedGame.awayTeam?.abbrev || '',
            String(selectedGame.id)
          )}
          restMap={restMap}
        />
      )}

      {/* Glossary Tooltip */}
      <InfoTooltip
        visible={glossary.visible}
        entry={glossary.entry}
        onClose={glossary.dismiss}
      />

      {/* Roster Builder Modal */}
      <RosterBuilder
        visible={rosterBuilderVisible}
        onDismiss={() => setRosterBuilderVisible(false)}
        onSaved={() => setRosterBuilderVisible(false)}
      />

      {/* Toast Notification */}
      <Toast message={toastMessage} />
    </ThemedView>
  );
}
