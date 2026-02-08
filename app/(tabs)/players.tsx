import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight, FadeInUp } from 'react-native-reanimated';
import { getTeamColors } from '../../constants/teamColors';
import { Ionicons } from '@expo/vector-icons';
import CompactPlayerRow from '../../components/CompactPlayerRow';
import ElevatedPlayerRow from '../../components/ElevatedPlayerRow';
import GoalieSpotlightCard from '../../components/GoalieSpotlightCard';
import HeroLeaderCard from '../../components/HeroLeaderCard';
import PlayerDetailModal from '../../components/PlayerDetailModal';
import PlayerProjectionCard from '../../components/PlayerProjectionCard';
import { ThemedView } from '../../components/ThemedView';
import { theme } from '../../constants/theme';
import { useAnalytics } from '../../hooks/useAnalytics';
import {
  searchPlayers,
  type PlayerSearchResult,
} from '../../services/playerLeaders';
import {
  getTrendingPlayers,
  getLeagueLeaders,
  getPlayerProjections,
  getLeaderTrends,
  getTrendingGoalies,
  batchGetHitRates,
  clearTrendsCache,
  type TrendingPlayer,
  type TrendingGoalie,
  type PlayerProjection,
  type LeaderTrend,
  type StatCategory,
  type HitRateResult,
} from '../../services/playerTrends';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_STAT_CATEGORY: StatCategory = 'points';
const SEARCH_ROW_HEIGHT = 64;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlayersScreen() {
  const analytics = useAnalytics('PlayersTab');

  // Stat category is fixed to points (no selector)
  const statCategory = DEFAULT_STAT_CATEGORY;

  // State — trending players & league leaders
  const [leagueLeaders, setLeagueLeaders] = useState<TrendingPlayer[]>([]);
  const [trendingUp, setTrendingUp] = useState<TrendingPlayer[]>([]);
  const [trendingDown, setTrendingDown] = useState<TrendingPlayer[]>([]);
  const [projections, setProjections] = useState<PlayerProjection[]>([]);
  const [leaderTrends, setLeaderTrends] = useState<Map<number, LeaderTrend>>(new Map());
  const [trendingGoalies, setTrendingGoalies] = useState<TrendingGoalie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // State — hit rates (loaded per-player)
  const [hitRates, setHitRates] = useState<Map<number, HitRateResult>>(new Map());

  // State — search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State — player detail modal
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Clean up search timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // No position filtering — show all positions in unified feed

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadTrendingData = useCallback(async () => {
    try {
      // Step 1: Leaders first (most visible, queries skater_trend_summary VIEW)
      const leaders = await getLeagueLeaders(statCategory, 10);
      setLeagueLeaders(leaders);

      // Step 2: Trending + goalies (sequential to avoid VIEW query overload)
      const [up, down, goalies] = await Promise.all([
        getTrendingPlayers('up', 10),
        getTrendingPlayers('down', 5),
        getTrendingGoalies('up', 3),
      ]);
      setTrendingUp(up);
      setTrendingDown(down);
      setTrendingGoalies(goalies);

      // Step 3: Projections (calls getPlayersPlayingTonight which also hits the VIEW)
      const tonight = await getPlayerProjections(15);
      setProjections(tonight);

      // Step 4: Supplementary data (hit rates, L10 stats, leader trends)
      const allPlayerIds = [
        ...leaders.map(p => p.playerId),
        ...tonight.map(p => p.playerId),
        ...up.map(p => p.playerId),
        ...down.map(p => p.playerId),
      ];
      const uniqueIds = [...new Set(allPlayerIds)];

      if (uniqueIds.length > 0) {
        const [rates, trends] = await Promise.all([
          batchGetHitRates(uniqueIds, statCategory),
          getLeaderTrends(leaders.map(p => p.playerId)),
        ]);
        setHitRates(rates);
        setLeaderTrends(trends);
      }
    } catch (err) {
      console.error('[PLAYERS TAB] Error loading trending data:', err);
    }
  }, [statCategory]);

  // Initial load
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      await loadTrendingData();
      if (mounted) setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [loadTrendingData]);

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    clearTrendsCache();
    await loadTrendingData();
    setRefreshing(false);
    analytics.trackCustomEvent('players_refresh', {});
  }, [loadTrendingData, analytics]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handlePlayerTap = useCallback((playerId: number) => {
    setSelectedPlayerId(playerId);
    setDetailModalVisible(true);
    analytics.trackCustomEvent('players_player_tap', { playerId });
  }, [analytics]);

  const handleDetailModalClose = useCallback(() => {
    setDetailModalVisible(false);
    setSelectedPlayerId(null);
  }, []);

  // Debounced search
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (text.trim().length < 2) {
      setIsSearchActive(false);
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setIsSearchActive(true);
    setSearchLoading(true);

    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchPlayers(text, 20);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchActive(false);
    setSearchLoading(false);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }, []);

  // ---------------------------------------------------------------------------
  // Render: Search results
  // ---------------------------------------------------------------------------

  const renderSearchResult = useCallback(({ item }: { item: PlayerSearchResult }) => (
    <TouchableOpacity
      style={styles.searchRow}
      onPress={() => handlePlayerTap(item.playerId)}
      testID={`search-result-${item.playerId}`}
    >
      <Image
        source={{ uri: item.headshotUrl }}
        style={styles.searchHeadshot}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={`search-${item.playerId}`}
        accessibilityLabel={`${item.firstName} ${item.lastName} headshot`}
      />
      <View style={styles.searchInfo}>
        <Text style={styles.searchName} numberOfLines={1}>
          {item.firstName} {item.lastName}
        </Text>
        <Text style={styles.searchMeta}>
          {item.teamAbbrev} / {item.position}{item.sweaterNumber ? ` / #${item.sweaterNumber}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
    </TouchableOpacity>
  ), [handlePlayerTap]);

  // ---------------------------------------------------------------------------
  // Render: Section header
  // ---------------------------------------------------------------------------

  const renderSectionHeader = (label: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.accentBar} />
    </View>
  );

  // ---------------------------------------------------------------------------
  // Render: Search view
  // ---------------------------------------------------------------------------

  if (isSearchActive) {
    return (
      <ThemedView style={styles.container} testID="players-tab">
        <View style={styles.header}>
          <Text style={styles.title}>Players</Text>
        </View>

        <View style={styles.searchContainerActive}>
          <View style={styles.searchBarRow}>
            <Ionicons name="search" size={18} color={theme.subtext} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search players..."
              placeholderTextColor={theme.subtext}
              value={searchQuery}
              onChangeText={handleSearchChange}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              testID="player-search-input-active"
            />
            <TouchableOpacity onPress={clearSearch} testID="search-clear-button" style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={theme.subtext} />
            </TouchableOpacity>
          </View>
        </View>

        {searchLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : (
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={item => String(item.playerId)}
            getItemLayout={(_data, index) => ({
              length: SEARCH_ROW_HEIGHT,
              offset: SEARCH_ROW_HEIGHT * index,
              index,
            })}
            initialNumToRender={10}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery.length < 2 ? 'Type at least 2 characters to search' : 'No players found'}
                </Text>
              </View>
            }
            testID="search-results-list"
          />
        )}

        <PlayerDetailModal
          visible={detailModalVisible}
          playerId={selectedPlayerId}
          onClose={handleDetailModalClose}
        />
      </ThemedView>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render: Edge Finder
  // ---------------------------------------------------------------------------

  return (
    <ThemedView style={styles.container} testID="players-tab">
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Players</Text>
          </View>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => setIsSearchActive(true)}
            testID="search-toggle"
          >
            <Ionicons name="search" size={22} color={theme.subtext} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={styles.loadingText}>Loading players...</Text>
          </View>
        ) : (
          <>
            {/* SPOTLIGHT — players outperforming their season averages */}
            {trendingUp.length >= 3 && (
              <Animated.View entering={FadeInDown.duration(400)}>
                {renderSectionHeader('SPOTLIGHT')}
                <Text style={styles.spotlightSubtitle}>Outperforming their season averages</Text>
                <FlatList
                  horizontal
                  data={trendingUp.slice(0, 8)}
                  keyExtractor={item => `spotlight-${item.playerId}`}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.spotlightList}
                  renderItem={({ item, index }) => {
                    const tc = getTeamColors(item.teamAbbrev);
                    // Show how much they're above season avg
                    const seasonPpg = item.gamesPlayed > 0 ? item.seasonPoints / item.gamesPlayed : 0;
                    const recentPpg = item.avgPoints5g;
                    const aboveAvgPct = seasonPpg > 0 ? Math.round(((recentPpg - seasonPpg) / seasonPpg) * 100) : 0;
                    return (
                      <Animated.View entering={FadeInRight.duration(300).delay(index * 80)}>
                        <Pressable
                          onPress={() => handlePlayerTap(item.playerId)}
                          style={({ pressed }) => [
                            styles.spotlightCard,
                            { borderTopColor: tc.primary, borderTopWidth: 3 },
                            pressed && { transform: [{ scale: 0.95 }], opacity: 0.9 },
                          ]}
                        >
                          <View style={styles.spotlightInner}>
                            <View style={styles.spotlightHeader}>
                              <Image
                                source={{ uri: item.headshotUrl }}
                                style={[styles.spotlightHeadshot, { borderColor: tc.primary + '66' }]}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                                recyclingKey={`spot-${item.playerId}`}
                              />
                            </View>
                            <Text style={styles.spotlightName} numberOfLines={1}>
                              {item.firstName.charAt(0)}. {item.lastName}
                            </Text>
                            <Text style={[styles.spotlightTeam, { color: tc.primary }]}>
                              {item.teamAbbrev} · {item.position}
                            </Text>
                            <Text style={styles.spotlightBigStat}>{item.seasonPoints}</Text>
                            <Text style={styles.spotlightStatLabel}>Points</Text>
                            {aboveAvgPct > 15 && (
                              <View style={styles.spotlightAboveAvg}>
                                <Ionicons name="trending-up" size={10} color={theme.semantic.positive} />
                                <Text style={styles.spotlightAboveAvgText}>
                                  +{aboveAvgPct > 99 ? '99' : aboveAvgPct}% vs avg
                                </Text>
                              </View>
                            )}
                            {item.pointStreak >= 3 && (
                              <View style={styles.spotlightStreakRow}>
                                <Ionicons name="flame" size={10} color="#f97316" />
                                <Text style={styles.spotlightStreak}>{item.pointStreak}g point streak</Text>
                              </View>
                            )}
                          </View>
                        </Pressable>
                      </Animated.View>
                    );
                  }}
                />
              </Animated.View>
            )}

            {/* TONIGHT'S EDGE section — projection cards */}
            {projections.length > 0 && (
              <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
                {renderSectionHeader("TONIGHT'S EDGE")}
                {projections.slice(0, 10).map((proj, i) => (
                  <Animated.View key={proj.playerId} entering={FadeInUp.duration(400).delay(i * 80)}>
                    <PlayerProjectionCard
                      projection={proj}
                      featuredStats={[statCategory]}
                      onPress={handlePlayerTap}
                    />
                  </Animated.View>
                ))}
              </Animated.View>
            )}

            {/* LEAGUE LEADERS -- tiered layout, sorted by actual stats */}
            {leagueLeaders.length > 0 && (
              <Animated.View entering={FadeInUp.duration(400).delay(100)} style={styles.section}>
                {renderSectionHeader('LEAGUE LEADERS')}
                {/* Hero card: #1 player */}
                <Animated.View entering={FadeInUp.duration(400).delay(180)}>
                  <HeroLeaderCard
                    player={leagueLeaders[0]}
                    leaderTrend={leaderTrends.get(leagueLeaders[0].playerId)}
                    statCategory={statCategory}
                    onPress={handlePlayerTap}
                  />
                </Animated.View>
                {/* Elevated rows: #2-5 */}
                {leagueLeaders.slice(1, 5).map((player, i) => (
                  <Animated.View key={player.playerId} entering={FadeInUp.duration(400).delay(260 + i * 80)}>
                    <ElevatedPlayerRow
                      player={player}
                      rank={i + 2}
                      hitRate={hitRates.get(player.playerId)}
                      statCategory={statCategory}
                      onPress={handlePlayerTap}
                    />
                  </Animated.View>
                ))}
                {/* Compact rows: #6-10 */}
                {leagueLeaders.length > 5 && (
                  <Animated.View entering={FadeInUp.duration(400).delay(580)} style={styles.compactContainer}>
                    {leagueLeaders.slice(5, 10).map((player, i) => (
                      <CompactPlayerRow
                        key={player.playerId}
                        player={player}
                        rank={i + 6}
                        statCategory={statCategory}
                        onPress={handlePlayerTap}
                      />
                    ))}
                  </Animated.View>
                )}
              </Animated.View>
            )}

            {/* TRENDING HOT section removed — SPOTLIGHT above covers these players */}

            {/* GOALIE SPOTLIGHT — always show when goalies available */}
            {trendingGoalies.length > 0 && (
              <Animated.View entering={FadeInUp.duration(400).delay(300)} style={styles.section}>
                {renderSectionHeader('GOALIE SPOTLIGHT')}
                <GoalieSpotlightCard
                  goalie={trendingGoalies[0]}
                  onPress={handlePlayerTap}
                />
              </Animated.View>
            )}

            {/* COOLING DOWN section */}
            {trendingDown.length > 0 && (
              <Animated.View entering={FadeInUp.duration(400).delay(300)} style={styles.section}>
                {renderSectionHeader('COOLING DOWN')}
                <View style={styles.compactContainer}>
                  {trendingDown.slice(0, 5).map((player, i) => (
                    <CompactPlayerRow
                      key={player.playerId}
                      player={player}
                      rank={i + 1}
                      statCategory={statCategory}
                      onPress={handlePlayerTap}
                    />
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Empty state */}
            {leagueLeaders.length === 0 && trendingUp.length === 0 && projections.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="trending-up" size={48} color={theme.subtext} />
                <Text style={styles.emptyTitle}>No Trend Data Available</Text>
                <Text style={styles.emptyText}>
                  Player trend data requires at least 10 games played.
                  Check back once more games have been completed.
                </Text>
              </View>
            )}

            {/* Bottom padding for tab bar */}
            <View style={{ height: 100 }} />
          </>
        )}
      </ScrollView>

      <PlayerDetailModal
        visible={detailModalVisible}
        playerId={selectedPlayerId}
        onClose={handleDetailModalClose}
      />
    </ThemedView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
  },
  searchButton: {
    padding: 8,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  // Section
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  accentBar: {
    width: 32,
    height: 2,
    backgroundColor: theme.accent,
    borderRadius: 1,
    marginTop: 4,
    opacity: 0.6,
  },
  // Spotlight horizontal scroll
  spotlightSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
    marginBottom: 8,
  },
  spotlightList: {
    paddingBottom: 4,
    gap: 12,
  },
  spotlightCard: {
    width: 140,
    height: 210,
    backgroundColor: theme.card,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  spotlightInner: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  spotlightHeader: {
    position: 'relative',
    marginBottom: 8,
  },
  spotlightHeadshot: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.subtle,
    borderWidth: 2,
  },
  spotlightRank: {
    position: 'absolute',
    bottom: -2,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotlightRankText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  spotlightName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  spotlightTeam: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  spotlightBigStat: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
  spotlightStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.subtext,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  spotlightAboveAvg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 3,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  spotlightAboveAvgText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.semantic.positive,
  },
  spotlightStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  spotlightStreak: {
    fontSize: 9,
    fontWeight: '600',
    color: '#f97316',
  },
  // Compact rows container
  compactContainer: {
    backgroundColor: theme.card,
    borderRadius: 10,
    marginTop: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  // Search (active mode)
  searchContainerActive: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.text,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  // Search results
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  searchHeadshot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.subtle,
    marginRight: 10,
  },
  searchInfo: {
    flex: 1,
  },
  searchName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  searchMeta: {
    fontSize: 12,
    color: theme.subtext,
  },
  // Loading / Empty
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: theme.subtext,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  emptyText: {
    fontSize: 14,
    color: theme.subtext,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
