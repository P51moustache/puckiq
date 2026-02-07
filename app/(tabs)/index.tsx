import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GameDeepDiveModal from '../../components/GameDeepDiveModal';
import HeroBanner from '../../components/HeroBanner';
import LiveNowBar from '../../components/LiveNowBar';
import AllGamesCard from '../../components/AllGamesCard';
import EdgeSpotlight from '../../components/EdgeSpotlight';
import EmptyNightCard from '../../components/EmptyNightCard';
import StatOfTheNight from '../../components/StatOfTheNight';
import PlayerSpotlightCarousel from '../../components/PlayerSpotlightCarousel';
import CompactGameRow from '../../components/CompactGameRow';
import StandingsWidget from '../../components/StandingsWidget';
import InsightFeed from '../../components/InsightFeed';
import { ThemedView } from '../../components/ThemedView';
import { SkeletonPickCard, Skeleton } from '../../components/ui/SkeletonLoader';
import { SettingsButton } from '../../components/SettingsButton';
import { makeStyles, theme } from '../../constants/theme';
import Toast from '../../components/Toast';
import InfoTooltip from '../../components/InfoTooltip';
import { useTonightData } from '../../hooks/useTonightData';
import { useGlossary } from '../../hooks/useGlossary';
import type { SituationalFactors } from '../../types/predictions';

export default function TonightScreen() {
  const styles = makeStyles();

  // Deep dive modal state (UI-coupled, stays in component)
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedGame, setSelectedGame] = useState<any>(null);

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
    tonightHeadline,
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

  // Split remaining games: first 2 as featured full cards, rest as compact rows
  const featuredGames = remainingGames.slice(0, 2);
  const compactGames = remainingGames.slice(2);

  // Pick the best insight as "Stat of the Night"
  const statOfTheNight = useMemo(() => {
    if (!data.insights || data.insights.length === 0) return null;
    return data.insights[0];
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
    <ThemedView style={styles.container}>
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
            <View style={{ paddingHorizontal: 16 }}>
              <SkeletonPickCard variant="top" />
              <View style={{ marginTop: 16 }}>
                <Skeleton width={120} height={14} style={{ marginBottom: 12 }} />
                <Skeleton width="100%" height={80} style={{ borderRadius: 14, marginBottom: 12 }} />
                <Skeleton width="100%" height={80} style={{ borderRadius: 14 }} />
              </View>
            </View>
          </View>
        )}

        {/* HERO BANNER — cinematic hero zone with photo background */}
        {!isLoading && heroGame && (
          <HeroBanner
            game={heroGame}
            prediction={heroPrediction}
            confidenceScore={heroConfidence}
            h2hRecord={heroH2H}
            situationalFactors={heroSituationalFactors}
            headline={tonightHeadline}
            onPress={() => handleOpenDeepDive(heroGame)}
            onShare={handleShareHero}
            onInfoPress={glossary.showTerm}
            awayForm={formMap.get(heroGame.awayTeam?.abbrev) ?? null}
            homeForm={formMap.get(heroGame.homeTeam?.abbrev) ?? null}
            isYourTeam={selectedTeam ? (heroGame.homeTeam?.abbrev === selectedTeam || heroGame.awayTeam?.abbrev === selectedTeam) : false}
          />
        )}

        {/* LIVE NOW BAR — below hero during live games */}
        {!isLoading && gameCount > 0 && (
          <LiveNowBar
            games={todaysGames?.games ?? []}
            onGamePress={handleOpenDeepDive}
          />
        )}


        {/* STAT OF THE NIGHT — bold single-stat visual break */}
        {!isLoading && gameCount > 0 && (
          <View style={{ marginTop: 24 }}>
            <StatOfTheNight
              stat={statOfTheNight}
              onShare={handleShareStat}
              onInfoPress={glossary.showTerm}
            />
          </View>
        )}

        {/* PLAYERS TO WATCH — horizontal carousel */}
        {!isLoading && gameCount > 0 && (
          <View style={{ marginTop: 24 }}>
            <PlayerSpotlightCarousel
              games={todaysGames?.games ?? []}
              playerStatsMap={playerStatsMap}
            />
          </View>
        )}

        {/* MORE GAMES — featured full cards (first 2) */}
        {!isLoading && featuredGames.length > 0 && (
          <View style={{ marginTop: 24, width: '100%' }}>
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <Text style={{
                fontSize: 13,
                fontWeight: '800',
                color: theme.accent,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}>
                More Games
              </Text>
              <View style={{
                width: 32,
                height: 2,
                backgroundColor: theme.accent,
                borderRadius: 1,
                marginTop: 4,
                opacity: 0.6,
              }} />
            </View>
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              {featuredGames.map((game: any, idx: number) => {
                const pred = predictionsMap.get(String(game.id)) ?? { homeWinProb: 50, awayWinProb: 50 };
                const h2hKey = `${game.awayTeam?.abbrev}-${game.homeTeam?.abbrev}`;
                const h2h = h2hMap.get(h2hKey) ?? null;
                const gameInsight = data.getInsightForGame(game);

                return (
                  <AllGamesCard
                    key={String(game.id)}
                    game={game}
                    prediction={pred}
                    h2hRecord={h2h}
                    insight={gameInsight}
                    index={idx}
                    onPress={() => handleOpenDeepDive(game)}
                    onShare={() => handleShareGame(game)}
                    onInfoPress={glossary.showTerm}
                    awayMomentum={momentumMap.get(game.awayTeam?.abbrev) ?? null}
                    homeMomentum={momentumMap.get(game.homeTeam?.abbrev) ?? null}
                    restAdvantage={{
                      home: restMap.get(game.homeTeam?.abbrev) ?? 50,
                      away: restMap.get(game.awayTeam?.abbrev) ?? 50,
                    }}
                    awayForm={formMap.get(game.awayTeam?.abbrev) ?? null}
                    homeForm={formMap.get(game.homeTeam?.abbrev) ?? null}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* DIVISION STANDINGS — compact table */}
        {!isLoading && currentStandings && (
          <View style={{ marginTop: 24 }}>
            <StandingsWidget
              standings={currentStandings}
              selectedTeam={selectedTeam}
            />
          </View>
        )}

        {/* COMPACT GAME ROWS — remaining games after featured 2 */}
        {!isLoading && compactGames.length > 0 && (
          <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
            <View style={{ marginBottom: 12 }}>
              <Text style={{
                fontSize: 13,
                fontWeight: '800',
                color: theme.accent,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}>
                Also Tonight
              </Text>
              <View style={{
                width: 32,
                height: 2,
                backgroundColor: theme.accent,
                borderRadius: 1,
                marginTop: 4,
                opacity: 0.6,
              }} />
            </View>
            {compactGames.map((game: any, idx: number) => {
              const pred = predictionsMap.get(String(game.id)) ?? { homeWinProb: 50, awayWinProb: 50 };
              return (
                <CompactGameRow
                  key={String(game.id)}
                  game={game}
                  prediction={pred}
                  onPress={() => handleOpenDeepDive(game)}
                  index={idx}
                />
              );
            })}
          </View>
        )}

        {/* EDGE SPOTLIGHT — hot players + edge stats in one scroll */}
        {!isLoading && gameCount > 0 && (
          <View style={{ marginTop: 24 }}>
            <EdgeSpotlight
              playerStatsMap={playerStatsMap}
              games={todaysGames?.games ?? []}
              skaterLanding={edgeSkaterLanding}
              teamLanding={edgeTeamLanding}
            />
          </View>
        )}

        {/* TONIGHT'S INTEL — insight cards */}
        {!isLoading && data.insights.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <InsightFeed insights={data.insights} onShareInsight={handleShareInsight} />
          </View>
        )}

        {/* EMPTY STATE — PuckIQ branding + no games tonight */}
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

      {/* Toast Notification */}
      <Toast message={toastMessage} />
    </ThemedView>
  );
}
