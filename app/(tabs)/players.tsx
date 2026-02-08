import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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
  getPlayerProjections,
  getLeaderTrends,
  getTrendingGoalies,
  batchGetHitRates,
  getPlayerL10GameStats,
  clearTrendsCache,
  type TrendingPlayer,
  type TrendingGoalie,
  type PlayerProjection,
  type LeaderTrend,
  type StatCategory,
  type HitRateResult,
  type L10GameStat,
} from '../../services/playerTrends';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAT_CATEGORIES: { key: StatCategory; label: string }[] = [
  { key: 'goals', label: 'Goals' },
  { key: 'assists', label: 'Assists' },
  { key: 'points', label: 'Points' },
  { key: 'shots', label: 'Shots' },
];

type PositionFilter = 'ALL' | 'F' | 'D' | 'G';
const POSITION_FILTERS: { key: PositionFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'F', label: 'F' },
  { key: 'D', label: 'D' },
  { key: 'G', label: 'G' },
];

const FORWARD_POSITIONS = new Set(['C', 'LW', 'RW', 'L', 'R']);
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_ROW_HEIGHT = 64;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlayersScreen() {
  const analytics = useAnalytics('PlayersTab');

  // State -- filters
  const [statCategory, setStatCategory] = useState<StatCategory>('points');
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL');

  // State — trending players
  const [trendingUp, setTrendingUp] = useState<TrendingPlayer[]>([]);
  const [trendingDown, setTrendingDown] = useState<TrendingPlayer[]>([]);
  const [projections, setProjections] = useState<PlayerProjection[]>([]);
  const [leaderTrends, setLeaderTrends] = useState<Map<number, LeaderTrend>>(new Map());
  const [trendingGoalies, setTrendingGoalies] = useState<TrendingGoalie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // State — hit rates and L10 stats (loaded per-player)
  const [hitRates, setHitRates] = useState<Map<number, HitRateResult>>(new Map());
  const [l10Stats, setL10Stats] = useState<Map<number, L10GameStat[]>>(new Map());

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

  // ---------------------------------------------------------------------------
  // Filtered data (apply position filter in JS)
  // ---------------------------------------------------------------------------

  const filterByPosition = useCallback((players: TrendingPlayer[]): TrendingPlayer[] => {
    if (positionFilter === 'ALL' || positionFilter === 'G') return players;
    if (positionFilter === 'F') return players.filter(p => FORWARD_POSITIONS.has(p.position));
    if (positionFilter === 'D') return players.filter(p => p.position === 'D');
    return players;
  }, [positionFilter]);

  const filteredUp = useMemo(() => filterByPosition(trendingUp), [trendingUp, filterByPosition]);
  const filteredDown = useMemo(() => filterByPosition(trendingDown), [trendingDown, filterByPosition]);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadTrendingData = useCallback(async () => {
    try {
      const [up, down, tonight, goalies] = await Promise.all([
        getTrendingPlayers('up', 10),
        getTrendingPlayers('down', 10),
        getPlayerProjections(15),
        getTrendingGoalies('up', 3),
      ]);
      setTrendingUp(up);
      setTrendingDown(down);
      setProjections(tonight);
      setTrendingGoalies(goalies);

      // Batch-load hit rates, L10 stats, and leader trends for ALL visible players
      const allPlayerIds = [
        ...tonight.map(p => p.playerId),
        ...up.map(p => p.playerId),
        ...down.map(p => p.playerId),
      ];
      const uniqueIds = [...new Set(allPlayerIds)];

      if (uniqueIds.length > 0) {
        // Load hit rates, L10 stats, and leader trends in parallel
        const [rates, l10Map, trends] = await Promise.all([
          batchGetHitRates(uniqueIds, statCategory),
          (async () => {
            const map = new Map<number, L10GameStat[]>();
            await Promise.all(
              uniqueIds.map(async (id) => {
                const stats = await getPlayerL10GameStats(id, statCategory);
                if (stats.length > 0) map.set(id, stats);
              }),
            );
            return map;
          })(),
          getLeaderTrends(up.map(p => p.playerId)),
        ]);
        setHitRates(rates);
        setL10Stats(l10Map);
        setLeaderTrends(trends);
      }
    } catch (err) {
      console.error('[PLAYERS TAB] Error loading trending data:', err);
    }
  }, [statCategory]);

  // Initial load + reload on stat category change
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

  const handleStatCategoryChange = useCallback((cat: StatCategory) => {
    setStatCategory(cat);
    analytics.trackCustomEvent('players_stat_category', { category: cat });
  }, [analytics]);

  const handlePositionFilterChange = useCallback((pos: PositionFilter) => {
    setPositionFilter(pos);
    analytics.trackCustomEvent('players_position_filter', { position: pos });
  }, [analytics]);

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
          <Text style={styles.subtitle}>Edge Finder</Text>
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
            <Text style={styles.subtitle}>Edge Finder</Text>
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
        {/* Stat category selector */}
        <View style={styles.categorySelector}>
          {STAT_CATEGORIES.map(cat => {
            const isActive = statCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                testID={`stat-cat-${cat.key}`}
                style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                onPress={() => handleStatCategoryChange(cat.key)}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Position filter pills */}
        <View style={styles.filterRow}>
          {POSITION_FILTERS.map(pf => {
            const isActive = positionFilter === pf.key;
            return (
              <TouchableOpacity
                key={pf.key}
                testID={`pos-filter-${pf.key}`}
                style={[styles.positionPill, isActive && styles.positionPillActive]}
                onPress={() => handlePositionFilterChange(pf.key)}
              >
                <Text style={[styles.positionPillText, isActive && styles.positionPillTextActive]}>
                  {pf.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={styles.loadingText}>Finding edges...</Text>
          </View>
        ) : (
          <>
            {/* TONIGHT'S EDGE section — projection cards */}
            {projections.length > 0 && (
              <View style={styles.section}>
                {renderSectionHeader("TONIGHT'S EDGE")}
                {projections.slice(0, 10).map(proj => (
                  <PlayerProjectionCard
                    key={proj.playerId}
                    projection={proj}
                    featuredStats={[statCategory]}
                    onPress={handlePlayerTap}
                  />
                ))}
              </View>
            )}

            {/* No games today fallback */}
            {projections.length === 0 && !loading && (
              <View style={styles.noGamesContainer}>
                <Ionicons name="calendar-outline" size={28} color={theme.subtext} />
                <Text style={styles.noGamesText}>No games scheduled today</Text>
              </View>
            )}

            {/* LEAGUE LEADERS -- tiered layout */}
            {filteredUp.length > 0 && positionFilter !== 'G' && (
              <View style={styles.section}>
                {renderSectionHeader('LEAGUE LEADERS')}
                {/* Hero card: #1 player */}
                <HeroLeaderCard
                  player={filteredUp[0]}
                  leaderTrend={leaderTrends.get(filteredUp[0].playerId)}
                  hitRate={hitRates.get(filteredUp[0].playerId)}
                  statCategory={statCategory}
                  onPress={handlePlayerTap}
                />
                {/* Elevated rows: #2-5 */}
                {filteredUp.slice(1, 5).map((player, i) => (
                  <ElevatedPlayerRow
                    key={player.playerId}
                    player={player}
                    rank={i + 2}
                    hitRate={hitRates.get(player.playerId)}
                    statCategory={statCategory}
                    onPress={handlePlayerTap}
                  />
                ))}
                {/* Compact rows: #6-10 */}
                {filteredUp.length > 5 && (
                  <View style={styles.compactContainer}>
                    {filteredUp.slice(5, 10).map((player, i) => (
                      <CompactPlayerRow
                        key={player.playerId}
                        player={player}
                        rank={i + 6}
                        statCategory={statCategory}
                        onPress={handlePlayerTap}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* GOALIE SPOTLIGHT */}
            {trendingGoalies.length > 0 && positionFilter !== 'F' && positionFilter !== 'D' && (
              <View style={styles.section}>
                {renderSectionHeader('GOALIE SPOTLIGHT')}
                <GoalieSpotlightCard
                  goalie={trendingGoalies[0]}
                  onPress={handlePlayerTap}
                />
              </View>
            )}

            {/* STREAKING LESS section */}
            {filteredDown.length > 0 && positionFilter !== 'G' && (
              <View style={styles.section}>
                {renderSectionHeader('STREAKING LESS')}
                {filteredDown.slice(0, 5).map((player, i) => (
                  <CompactPlayerRow
                    key={player.playerId}
                    player={player}
                    rank={i + 1}
                    statCategory={statCategory}
                    onPress={handlePlayerTap}
                  />
                ))}
              </View>
            )}

            {/* Empty state */}
            {trendingUp.length === 0 && trendingDown.length === 0 && projections.length === 0 && (
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
  subtitle: {
    fontSize: 14,
    color: theme.accent,
    fontWeight: '600',
    marginTop: 4,
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
  // Category selector
  categorySelector: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  categoryPillActive: {
    backgroundColor: theme.accent,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.subtext,
  },
  categoryTextActive: {
    color: theme.text,
    fontWeight: '700',
  },
  // Position filter
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  positionPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  positionPillActive: {
    backgroundColor: theme.accent + '22',
    borderColor: theme.accent,
  },
  positionPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.subtext,
  },
  positionPillTextActive: {
    color: theme.accent,
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
  // No games fallback
  noGamesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginBottom: 12,
    backgroundColor: theme.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  noGamesText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.subtext,
  },
});
