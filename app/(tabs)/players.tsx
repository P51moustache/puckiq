import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Dropdown from '../../components/Dropdown';
import PlayerDetailModal from '../../components/PlayerDetailModal';
import { ThemedView } from '../../components/ThemedView';
import { theme } from '../../constants/theme';
import { useAnalytics } from '../../hooks/useAnalytics';
import {
  getLeagueLeaders,
  getGoalieLeaders,
  searchPlayers,
  getTeamRoster,
  type SkaterCategory,
  type SkaterPosition,
  type GoalieCategory,
  type SkaterLeader,
  type GoalieLeader,
  type PlayerSearchResult,
  type RosterPlayer,
} from '../../services/playerLeaders';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SKATER_CATEGORIES: { key: SkaterCategory; label: string }[] = [
  { key: 'points', label: 'Points' },
  { key: 'goals', label: 'Goals' },
  { key: 'assists', label: 'Assists' },
  { key: 'plusMinus', label: '+/-' },
  { key: 'shots', label: 'Shots' },
];

const GOALIE_CATEGORIES: { key: GoalieCategory; label: string }[] = [
  { key: 'wins', label: 'Wins' },
  { key: 'savePctg', label: 'SV%' },
  { key: 'goalsAgainstAvg', label: 'GAA' },
];

type PositionFilter = 'All' | SkaterPosition | 'G';
const POSITION_FILTERS: { key: PositionFilter; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'C', label: 'C' },
  { key: 'L', label: 'LW' },
  { key: 'R', label: 'RW' },
  { key: 'D', label: 'D' },
  { key: 'G', label: 'G' },
];

const ALL_TEAMS = [
  'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET',
  'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 'NSH', 'NYI', 'NYR', 'OTT',
  'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK',
  'WPG', 'WSH',
];

const SEARCH_DEBOUNCE_MS = 300;
const LEADER_ROW_HEIGHT = 72; // leaderRow padding(12*2) + headshot(40) + marginBottom(8)

// ---------------------------------------------------------------------------
// Stat value formatters
// ---------------------------------------------------------------------------

function formatStatValue(leader: SkaterLeader, category: SkaterCategory): string {
  switch (category) {
    case 'points': return String(leader.points);
    case 'goals': return String(leader.goals);
    case 'assists': return String(leader.assists);
    case 'plusMinus': return leader.plusMinus > 0 ? `+${leader.plusMinus}` : String(leader.plusMinus);
    case 'shots': return String(leader.shots);
    default: return '';
  }
}

function formatGoalieValue(leader: GoalieLeader, category: GoalieCategory): string {
  switch (category) {
    case 'wins': return String(leader.wins);
    case 'savePctg': {
      const pctg = leader.savePctg;
      if (pctg >= 1) return pctg.toFixed(3);
      return `.${Math.round(pctg * 1000)}`;
    }
    case 'goalsAgainstAvg': return leader.goalsAgainstAvg.toFixed(2);
    default: return '';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlayersScreen() {
  const analytics = useAnalytics('PlayersTab');

  // State — leaders
  const [skaterCategory, setSkaterCategory] = useState<SkaterCategory>('points');
  const [goalieCategory, setGoalieCategory] = useState<GoalieCategory>('wins');
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('All');
  const [teamFilter, setTeamFilter] = useState<string | null>(null);

  const [skaterLeaders, setSkaterLeaders] = useState<SkaterLeader[]>([]);
  const [goalieLeaders, setGoalieLeaders] = useState<GoalieLeader[]>([]);
  const [loadingSkaters, setLoadingSkaters] = useState(true);
  const [loadingGoalies, setLoadingGoalies] = useState(true);

  // State — search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State — team roster
  const [roster, setRoster] = useState<{ forwards: RosterPlayer[]; defense: RosterPlayer[]; goalies: RosterPlayer[] } | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);

  // State — player detail modal
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Clean up search timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // Load saved team preference
  useEffect(() => {
    async function loadSavedTeam() {
      try {
        const saved = await AsyncStorage.getItem('selectedTeam');
        if (saved) setTeamFilter(saved);
      } catch {
        // Ignore
      }
    }
    loadSavedTeam();
  }, []);

  // Fetch skater leaders
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoadingSkaters(true);
      try {
        const pos = positionFilter === 'All' || positionFilter === 'G' ? null : positionFilter as SkaterPosition;
        const data = await getLeagueLeaders(skaterCategory, pos, teamFilter, 10);
        if (mounted) setSkaterLeaders(data);
      } catch {
        if (mounted) setSkaterLeaders([]);
      } finally {
        if (mounted) setLoadingSkaters(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [skaterCategory, teamFilter, positionFilter]);

  // Fetch goalie leaders
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoadingGoalies(true);
      try {
        const data = await getGoalieLeaders(goalieCategory, teamFilter, 5);
        if (mounted) setGoalieLeaders(data);
      } catch {
        if (mounted) setGoalieLeaders([]);
      } finally {
        if (mounted) setLoadingGoalies(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [goalieCategory, teamFilter]);

  // Fetch team roster when a team is selected
  useEffect(() => {
    if (!teamFilter) {
      setRoster(null);
      return;
    }
    let mounted = true;
    async function load() {
      setRosterLoading(true);
      try {
        const data = await getTeamRoster(teamFilter!);
        if (mounted) setRoster(data);
      } catch {
        if (mounted) setRoster(null);
      } finally {
        if (mounted) setRosterLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [teamFilter]);

  // Debounced search
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

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

  // Handlers
  const handleSkaterCategoryChange = useCallback((cat: SkaterCategory) => {
    setSkaterCategory(cat);
    analytics.trackCustomEvent('players_skater_category', { category: cat });
  }, [analytics]);

  const handleGoalieCategoryChange = useCallback((cat: GoalieCategory) => {
    setGoalieCategory(cat);
    analytics.trackCustomEvent('players_goalie_category', { category: cat });
  }, [analytics]);

  const handlePositionFilterChange = useCallback((pos: PositionFilter) => {
    setPositionFilter(pos);
    analytics.trackCustomEvent('players_position_filter', { position: pos });
  }, [analytics]);

  const handleTeamFilterChange = useCallback((val: string | null) => {
    setTeamFilter(val);
    analytics.trackCustomEvent('players_team_filter', { team: val || 'all' });
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

  // ---------------------------------------------------------------------------
  // Render: Search results
  // ---------------------------------------------------------------------------

  const renderSearchResult = useCallback(({ item }: { item: PlayerSearchResult }) => (
    <TouchableOpacity
      style={styles.leaderRow}
      onPress={() => handlePlayerTap(item.playerId)}
      testID={`search-result-${item.playerId}`}
    >
      <Image
        source={{ uri: item.headshotUrl }}
        style={styles.headshot}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={`search-${item.playerId}`}
        accessibilityLabel={`${item.firstName} ${item.lastName} headshot`}
      />
      <View style={styles.playerDetails}>
        <Text style={styles.playerName} numberOfLines={1}>
          {item.firstName} {item.lastName}
        </Text>
        <Text style={styles.playerMeta}>
          {item.teamAbbrev} / {item.position}{item.sweaterNumber ? ` / #${item.sweaterNumber}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
    </TouchableOpacity>
  ), [handlePlayerTap]);

  // ---------------------------------------------------------------------------
  // Render: Skater leader row
  // ---------------------------------------------------------------------------

  const renderSkaterRow = useCallback(({ item, index }: { item: SkaterLeader; index: number }) => {
    const rank = index + 1;
    const statValue = formatStatValue(item, skaterCategory);
    const isTopThree = rank <= 3;

    return (
      <TouchableOpacity
        style={styles.leaderRow}
        onPress={() => handlePlayerTap(item.playerId)}
        testID={`skater-leader-${rank}`}
      >
        <Text style={[styles.rankNumber, isTopThree && styles.rankTopThree]}>
          {rank}
        </Text>
        <Image
          source={{ uri: item.headshotUrl }}
          style={styles.headshot}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={`skater-${item.playerId}`}
          accessibilityLabel={`${item.firstName} ${item.lastName} headshot`}
        />
        <View style={styles.playerDetails}>
          <Text style={styles.playerName} numberOfLines={1}>
            {item.firstName} {item.lastName}
          </Text>
          <Text style={styles.playerMeta}>
            {item.teamAbbrev} {item.position ? `/ ${item.position}` : ''}
          </Text>
        </View>
        <Text style={[styles.statValue, isTopThree && styles.statValueTopThree]}>
          {statValue}
        </Text>
      </TouchableOpacity>
    );
  }, [skaterCategory, handlePlayerTap]);

  // ---------------------------------------------------------------------------
  // Render: Goalie leader row
  // ---------------------------------------------------------------------------

  const renderGoalieRow = useCallback(({ item, index }: { item: GoalieLeader; index: number }) => {
    const rank = index + 1;
    const statValue = formatGoalieValue(item, goalieCategory);

    return (
      <TouchableOpacity
        style={styles.leaderRow}
        onPress={() => handlePlayerTap(item.playerId)}
        testID={`goalie-leader-${rank}`}
      >
        <Text style={[styles.rankNumber, rank <= 3 && styles.rankTopThree]}>
          {rank}
        </Text>
        <Image
          source={{ uri: item.headshotUrl }}
          style={styles.headshot}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={`goalie-${item.playerId}`}
          accessibilityLabel={`${item.firstName} ${item.lastName} headshot`}
        />
        <View style={styles.playerDetails}>
          <Text style={styles.playerName} numberOfLines={1}>
            {item.firstName} {item.lastName}
          </Text>
          <Text style={styles.playerMeta}>
            {item.teamAbbrev} / {item.wins}W-{item.losses}L-{item.otLosses}OT
          </Text>
        </View>
        <Text style={[styles.statValue, rank <= 3 && styles.statValueTopThree]}>
          {statValue}
        </Text>
      </TouchableOpacity>
    );
  }, [goalieCategory, handlePlayerTap]);

  // ---------------------------------------------------------------------------
  // Render: Roster player card
  // ---------------------------------------------------------------------------

  const renderRosterCard = useCallback((player: RosterPlayer) => (
    <TouchableOpacity
      key={player.playerId}
      style={styles.rosterCard}
      onPress={() => handlePlayerTap(player.playerId)}
      testID={`roster-player-${player.playerId}`}
    >
      <Image
        source={{ uri: player.headshotUrl }}
        style={styles.rosterHeadshot}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={`roster-${player.playerId}`}
      />
      <View style={styles.rosterInfo}>
        <Text style={styles.rosterName} numberOfLines={1}>
          {player.sweaterNumber ? `#${player.sweaterNumber} ` : ''}{player.firstName} {player.lastName}
        </Text>
        {player.points !== undefined && (
          <Text style={styles.rosterStats}>
            {player.gamesPlayed}GP / {player.goals}G / {player.assists}A / {player.points}P
          </Text>
        )}
      </View>
    </TouchableOpacity>
  ), [handlePlayerTap]);

  // ---------------------------------------------------------------------------
  // Render: Roster section
  // ---------------------------------------------------------------------------

  const renderRosterSection = () => {
    if (!teamFilter) return null;

    if (rosterLoading) {
      return (
        <View style={styles.rosterSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>TEAM ROSTER</Text>
            <View style={styles.accentBar} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.accent} />
          </View>
        </View>
      );
    }

    if (!roster || (roster.forwards.length === 0 && roster.defense.length === 0 && roster.goalies.length === 0)) {
      return null;
    }

    return (
      <View style={styles.rosterSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>TEAM ROSTER</Text>
          <View style={styles.accentBar} />
        </View>

        {roster.forwards.length > 0 && (
          <View style={styles.rosterGroup}>
            <Text style={styles.rosterGroupLabel}>Forwards ({roster.forwards.length})</Text>
            {roster.forwards.map(renderRosterCard)}
          </View>
        )}

        {roster.defense.length > 0 && (
          <View style={styles.rosterGroup}>
            <Text style={styles.rosterGroupLabel}>Defense ({roster.defense.length})</Text>
            {roster.defense.map(renderRosterCard)}
          </View>
        )}

        {roster.goalies.length > 0 && (
          <View style={styles.rosterGroup}>
            <Text style={styles.rosterGroupLabel}>Goalies ({roster.goalies.length})</Text>
            {roster.goalies.map(renderRosterCard)}
          </View>
        )}
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Render: List header (search + filters + skater section header)
  // ---------------------------------------------------------------------------

  const renderListHeader = () => (
    <View>
      {/* Search bar */}
      <View style={styles.searchContainer}>
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
            testID="player-search-input"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} testID="search-clear-button" style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={theme.subtext} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Team filter */}
      <View style={styles.filterContainer}>
        <Dropdown
          label="Filter by Team"
          placeholder="All Teams"
          options={[
            { label: 'All Teams', value: null },
            ...ALL_TEAMS.map(t => ({ label: t, value: t })),
          ]}
          value={teamFilter}
          onChange={handleTeamFilterChange}
          disabled={false}
          loading={false}
        />
      </View>

      {/* Position filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.positionFilterScroll}
        contentContainerStyle={styles.positionFilterContent}
      >
        {POSITION_FILTERS.map(pos => {
          const isActive = positionFilter === pos.key;
          return (
            <TouchableOpacity
              key={pos.key}
              testID={`position-filter-${pos.key}`}
              style={[styles.positionPill, isActive && styles.positionPillActive]}
              onPress={() => handlePositionFilterChange(pos.key)}
            >
              <Text style={[styles.positionPillText, isActive && styles.positionPillTextActive]}>
                {pos.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Skater Leaders section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>
          {positionFilter === 'G' ? 'GOALIE LEADERS' : 'SKATER LEADERS'}
        </Text>
        <View style={styles.accentBar} />
      </View>

      {/* Category selector — show skater or goalie categories based on position filter */}
      {positionFilter === 'G' ? (
        <View style={styles.categorySelector}>
          {GOALIE_CATEGORIES.map(cat => {
            const isActive = goalieCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                testID={`goalie-cat-${cat.key}`}
                style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                onPress={() => handleGoalieCategoryChange(cat.key)}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={styles.categorySelector}>
          {SKATER_CATEGORIES.map(cat => {
            const isActive = skaterCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                testID={`skater-cat-${cat.key}`}
                style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                onPress={() => handleSkaterCategoryChange(cat.key)}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  // ---------------------------------------------------------------------------
  // Render: List footer (goalie leaders when not in goalie mode + roster)
  // ---------------------------------------------------------------------------

  const renderListFooter = () => (
    <View>
      {/* Show goalie leaders section only when not already showing goalies via position filter */}
      {positionFilter !== 'G' && (
        <View style={styles.goalieSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>GOALIE LEADERS</Text>
            <View style={styles.accentBar} />
          </View>

          <View style={styles.categorySelector}>
            {GOALIE_CATEGORIES.map(cat => {
              const isActive = goalieCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  testID={`goalie-cat-footer-${cat.key}`}
                  style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                  onPress={() => handleGoalieCategoryChange(cat.key)}
                >
                  <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loadingGoalies ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.accent} />
            </View>
          ) : goalieLeaders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No goalie data available</Text>
            </View>
          ) : (
            goalieLeaders.map((goalie, index) => (
              <View key={goalie.playerId}>
                {renderGoalieRow({ item: goalie, index })}
              </View>
            ))
          )}
        </View>
      )}

      {/* Team roster browser */}
      {renderRosterSection()}

      {/* Bottom padding for tab bar */}
      <View style={{ height: 100 }} />
    </View>
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  // When search is active, show search results instead of leaders
  if (isSearchActive) {
    return (
      <ThemedView style={styles.container} testID="players-tab">
        <View style={styles.header}>
          <Text style={styles.title}>Players</Text>
          <Text style={styles.subtitle}>League leaders and player stats</Text>
        </View>

        {/* Search bar (always visible) */}
        <View style={[styles.searchContainer, { paddingHorizontal: 16 }]}>
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
              length: LEADER_ROW_HEIGHT,
              offset: LEADER_ROW_HEIGHT * index,
              index,
            })}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
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

  // Determine which data to show in main list based on position filter
  const isGoalieMode = positionFilter === 'G';
  const mainListData = isGoalieMode ? [] : skaterLeaders;
  const isMainListLoading = isGoalieMode ? loadingGoalies : loadingSkaters;

  return (
    <ThemedView style={styles.container} testID="players-tab">
      <View style={styles.header}>
        <Text style={styles.title}>Players</Text>
        <Text style={styles.subtitle}>League leaders and player stats</Text>
      </View>

      <FlatList
        data={isGoalieMode
          ? (goalieLeaders as any[])
          : mainListData
        }
        renderItem={isGoalieMode
          ? (({ item, index }) => renderGoalieRow({ item: item as GoalieLeader, index }))
          : renderSkaterRow
        }
        keyExtractor={item => String(item.playerId)}
        getItemLayout={(_data, index) => ({
          length: LEADER_ROW_HEIGHT,
          offset: LEADER_ROW_HEIGHT * index,
          index,
        })}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderListFooter}
        ListEmptyComponent={
          isMainListLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No data available</Text>
            </View>
          )
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        testID="players-leaders-list"
      />

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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
  },
  subtitle: {
    fontSize: 14,
    color: theme.subtext,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  // Search
  searchContainer: {
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
  // Filter
  filterContainer: {
    marginBottom: 12,
  },
  // Position filter
  positionFilterScroll: {
    marginBottom: 12,
  },
  positionFilterContent: {
    gap: 6,
  },
  positionPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  positionPillActive: {
    backgroundColor: theme.accent + '22',
    borderColor: theme.accent,
  },
  positionPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.subtext,
  },
  positionPillTextActive: {
    color: theme.accent,
    fontWeight: '700',
  },
  // Section headers
  sectionHeader: {
    marginBottom: 8,
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
  // Category pills
  categorySelector: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
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
  },
  // Leader rows
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  rankNumber: {
    width: 28,
    fontSize: 16,
    fontWeight: '700',
    color: theme.subtext,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
  rankTopThree: {
    color: theme.accent,
    fontSize: 18,
    fontWeight: '800',
  },
  headshot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.subtle,
    marginHorizontal: 10,
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  playerMeta: {
    fontSize: 12,
    color: theme.subtext,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
    minWidth: 48,
    textAlign: 'right',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
  statValueTopThree: {
    color: theme.accent,
  },
  // Goalie section
  goalieSection: {
    marginTop: 24,
  },
  // Roster section
  rosterSection: {
    marginTop: 24,
  },
  rosterGroup: {
    marginBottom: 16,
  },
  rosterGroupLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 8,
  },
  rosterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  rosterHeadshot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.subtle,
    marginRight: 10,
  },
  rosterInfo: {
    flex: 1,
  },
  rosterName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  rosterStats: {
    fontSize: 11,
    color: theme.subtext,
  },
  // Loading / Empty
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: theme.subtext,
  },
});
