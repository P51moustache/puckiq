import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import AdvancedStatCard from '../../components/AdvancedStatCard';
import TeamCard from '../../components/TeamCard';
import TeamModal from '../../components/TeamModal';
import TeamStatusBadges from '../../components/TeamStatusBadges';
import { ThemedView } from '../../components/ThemedView';
import { ADVANCED_METRICS } from '../../constants/advancedMetrics';
import { makeStyles, theme } from '../../constants/theme';
import {
  AdvancedTeamStats,
  getAdvancedTeamStats,
} from '../../services/advancedTeamStats';
import {
  getFavoriteTeams,
  toggleFavoriteTeam,
} from '../../services/teamFavorites';

type Team = {
  id: string;
  name: string;
  abbrev: string;
  record?: string;
  points?: number;
  conference?: string;
  division?: string;
  wins?: number;
  losses?: number;
  otLosses?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  streakCode?: string;
  gamesPlayed?: number;
  l10Wins?: number;
  l10Losses?: number;
  l10OtLosses?: number;
  // Home/Road splits from standings API
  homeWins?: number;
  homeLosses?: number;
  homeOtLosses?: number;
  roadWins?: number;
  roadLosses?: number;
  roadOtLosses?: number;
  // OT/Shootout stats from standings API
  shootoutWins?: number;
  shootoutLosses?: number;
  regulationWins?: number;
  regulationPlusOtWins?: number;
};

type TeamStats = {
  currentSeasonYear?: string;
  previousSeasonYear?: string;
  currentStats?: any;
  seasonOverview?: any;
  currentSeasonStats?: any;
  scoreboard?: any;
  lastSeasonStats?: any;
};

type AdvancedStatsState = Record<string, {
  stats: AdvancedTeamStats | null;
  loading: boolean;
  error: string | null;
}>;

type StandingsData = {
  currentRanks: { league: number | null; conf: number | null; div: number | null };
  avgRanks: { league: number | null; conf: number | null; div: number | null };
  currentTotals: { league: number; conf: number; div: number };
  historicalData: Array<{ year: string; league: number | null; conf: number | null; div: number | null }>;
  teamInfo: { conference: string | null; division: string | null };
  loading: boolean;
  error: string | null;
};

export default function TeamsScreen() {
  const styles = makeStyles();

  // Teams state
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  // Favorites state
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>([]);

  // Filter state
  const [conferenceFilter, setConferenceFilter] = useState<'All' | 'East' | 'West'>('All');
  const [divisionFilter, setDivisionFilter] = useState<'All' | 'Atlantic' | 'Metropolitan' | 'Central' | 'Pacific'>('All');
  const [favoritesOnlyFilter, setFavoritesOnlyFilter] = useState(false);

  // Selected team and modal state
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Team data state (loaded when modal opens)
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [teamStatsLoading, setTeamStatsLoading] = useState(false);

  const [standingsData, setStandingsData] = useState<StandingsData>({
    currentRanks: { league: null, conf: null, div: null },
    avgRanks: { league: null, conf: null, div: null },
    currentTotals: { league: 32, conf: 16, div: 8 },
    historicalData: [],
    teamInfo: { conference: null, division: null },
    loading: false,
    error: null,
  });

  // Advanced stats state (keyed by team abbreviation)
  const [advancedStats, setAdvancedStats] = useState<AdvancedStatsState>({});

  // Load teams and favorites on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      setLoadingTeams(true);

      // Load favorites
      const favorites = await getFavoriteTeams();
      setFavoriteTeams(favorites.map(f => f.triCode));

      // Fetch current standings - this is our source of truth for active teams
      const standingsRes = await fetch('https://api-web.nhle.com/v1/standings/now');
      if (!standingsRes.ok) throw new Error('Failed to fetch standings');

      const standingsJson = await standingsRes.json();
      const standings = standingsJson?.standings || [];

      // Build teams list ONLY from current standings (ensures only active teams)
      const activeTeams: Team[] = standings
        .map((standing: any) => {
          const abbrev = standing.teamAbbrev?.default || standing.teamAbbrev;
          const wins = standing.wins || 0;
          const losses = standing.losses || 0;
          const otLosses = standing.otLosses || 0;

          // Properly format conference name
          const confAbbrev = standing.conferenceAbbrev;
          const conferenceName = confAbbrev === 'E' ? 'East' : confAbbrev === 'W' ? 'West' : confAbbrev;


          return {
            id: String(standing.teamId || abbrev),
            name: standing.teamName?.default || standing.teamCommonName?.default || abbrev,
            abbrev: abbrev,
            record: `${wins}-${losses}-${otLosses}`,
            points: standing.points || 0,
            conference: conferenceName,
            division: standing.divisionAbbrev,
            wins,
            losses,
            otLosses,
            goalsFor: standing.goalFor || standing.goalsFor || 0,
            goalsAgainst: standing.goalAgainst || standing.goalsAgainst || 0,
            streakCode: standing.streakCode || standing.streak || '',
            gamesPlayed: wins + losses + otLosses,
            l10Wins: standing.l10Wins,
            l10Losses: standing.l10Losses,
            l10OtLosses: standing.l10OtLosses,
            // Home/Road splits
            homeWins: standing.homeWins,
            homeLosses: standing.homeLosses,
            homeOtLosses: standing.homeOtLosses,
            roadWins: standing.roadWins,
            roadLosses: standing.roadLosses,
            roadOtLosses: standing.roadOtLosses,
            // OT/Shootout stats
            shootoutWins: standing.shootoutWins,
            shootoutLosses: standing.shootoutLosses,
            regulationWins: standing.regulationWins,
            regulationPlusOtWins: standing.regulationPlusOtWins,
          };
        })
        .filter((team: Team) => team.abbrev && team.name) // Only teams with valid data
        .sort((a: Team, b: Team) => a.name.localeCompare(b.name)); // Sort alphabetically

      setTeams(activeTeams);
      setLoadingTeams(false);
    } catch (error: any) {
      console.error('Error loading initial data:', error);
      setTeamsError(error?.message || 'Failed to load teams');
      setLoadingTeams(false);
    }
  }

  // Handle favorite toggle
  const handleToggleFavorite = async (triCode: string) => {
    try {
      const team = teams.find(t => t.abbrev === triCode);
      if (!team) return;

      await toggleFavoriteTeam(triCode, team.name);
      const favorites = await getFavoriteTeams();
      setFavoriteTeams(favorites.map(f => f.triCode));
    } catch (error) {
      console.warn('Failed to toggle favorite:', error);
    }
  };

  // Handle team selection
  const handleTeamPress = async (teamAbbrev: string) => {
    setSelectedTeam(teamAbbrev);
    setShowModal(true);

    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem('selectedTeam', teamAbbrev);
    } catch (error) {
      console.warn('Failed to save team preference:', error);
    }

    // Start loading team data
    loadTeamData(teamAbbrev);
  };

  // Load team data (stats, standings, etc.)
  async function loadTeamData(teamAbbrev: string) {
    setTeamStatsLoading(true);
    setTeamStats(null);
    setStandingsData(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Fetch team stats and standings in parallel
      await Promise.all([
        fetchTeamStats(teamAbbrev),
        fetchStandingsData(teamAbbrev),
      ]);
    } catch (error: any) {
      console.error('Error loading team data:', error);
    } finally {
      setTeamStatsLoading(false);
    }
  }

  async function fetchTeamStats(teamAbbrev: string) {
    try {
      const getCurrentSeason = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        return month >= 9 ? `${year}${year + 1}` : `${year - 1}${year}`;
      };

      const getPreviousSeason = (currentSeason: string) => {
        const startYear = parseInt(currentSeason.substring(0, 4));
        return `${startYear - 1}${startYear}`;
      };

      const currentSeasonYear = getCurrentSeason();
      const previousSeasonYear = getPreviousSeason(currentSeasonYear);

      const [currentStats, seasonOverview, currentSeason, lastSeason] = await Promise.allSettled([
        fetch(`https://api-web.nhle.com/v1/club-stats/${teamAbbrev}/now`),
        fetch(`https://api-web.nhle.com/v1/club-stats-season/${teamAbbrev}`),
        fetch(`https://api-web.nhle.com/v1/club-stats/${teamAbbrev}/${currentSeasonYear}/2`),
        fetch(`https://api-web.nhle.com/v1/club-stats/${teamAbbrev}/${previousSeasonYear}/2`),
      ]);

      const results: TeamStats = {
        currentSeasonYear,
        previousSeasonYear,
      };

      if (currentStats.status === 'fulfilled' && currentStats.value.ok) {
        results.currentStats = await currentStats.value.json();
      }

      if (seasonOverview.status === 'fulfilled' && seasonOverview.value.ok) {
        results.seasonOverview = await seasonOverview.value.json();
      }

      if (currentSeason.status === 'fulfilled' && currentSeason.value.ok) {
        results.currentSeasonStats = await currentSeason.value.json();
      }

      if (lastSeason.status === 'fulfilled' && lastSeason.value.ok) {
        results.lastSeasonStats = await lastSeason.value.json();
      }

      setTeamStats(results);
    } catch (error: any) {
      console.error('Error fetching team stats:', error);
    }
  }

  async function fetchStandingsData(teamAbbrev: string) {
    try {
      // This is a simplified version - you can expand with historical data
      const res = await fetch('https://api-web.nhle.com/v1/standings/now');
      if (!res.ok) throw new Error('Failed to fetch standings');

      const json = await res.json();
      const standings = json?.standings || [];
      const teamStanding = standings.find(
        (s: any) => (s.teamAbbrev?.default || s.teamAbbrev) === teamAbbrev
      );

      if (teamStanding) {
        setStandingsData({
          currentRanks: {
            league: teamStanding.leagueSequence || null,
            conf: teamStanding.conferenceSequence || null,
            div: teamStanding.divisionSequence || null,
          },
          avgRanks: { league: null, conf: null, div: null },
          currentTotals: { league: 32, conf: 16, div: 8 },
          historicalData: [],
          teamInfo: {
            conference: teamStanding.conferenceAbbrev === 'E' ? 'Eastern' : teamStanding.conferenceAbbrev === 'W' ? 'Western' : teamStanding.conferenceAbbrev,
            division: teamStanding.divisionAbbrev,
          },
          loading: false,
          error: null,
        });
      }
    } catch (error: any) {
      console.error('Error fetching standings:', error);
      setStandingsData(prev => ({ ...prev, loading: false, error: error.message }));
    }
  }

  async function loadAdvancedStats(teamAbbrev: string, forceReload: boolean = false) {
    const teamCache = advancedStats[teamAbbrev];

    // Don't reload if already loading or already loaded (unless force reload)
    if (teamCache?.loading) return;
    if (teamCache?.stats && !forceReload) return;

    // Set loading state for this team
    setAdvancedStats(prev => ({
      ...prev,
      [teamAbbrev]: { stats: null, loading: true, error: null }
    }));

    try {
      const stats = await getAdvancedTeamStats(teamAbbrev, teamStats?.currentStats);
      setAdvancedStats(prev => ({
        ...prev,
        [teamAbbrev]: { stats, loading: false, error: null }
      }));
    } catch (error: any) {
      console.error('Error loading advanced stats for', teamAbbrev, ':', error);
      setAdvancedStats(prev => ({
        ...prev,
        [teamAbbrev]: { stats: null, loading: false, error: error.message }
      }));
    }
  }

  // Load advanced stats when team stats are available
  useEffect(() => {
    if (showModal && selectedTeam && teamStats?.currentStats) {
      const teamCache = advancedStats[selectedTeam];
      if (!teamCache?.stats && !teamCache?.loading) {
        loadAdvancedStats(selectedTeam);
      }
    }
  }, [showModal, selectedTeam, teamStats?.currentStats]);

  // Memoize tabs array to prevent unnecessary re-renders
  const modalTabs = useMemo(() => [
    { id: 'overview', label: 'Overview' },
    { id: 'stats', label: 'Statistics' },
  ], []);

  // Apply filters to teams
  const getFilteredTeams = () => {
    return teams.filter(team => {
      // Conference filter
      if (conferenceFilter !== 'All' && team.conference !== conferenceFilter) {
        return false;
      }

      // Division filter
      if (divisionFilter !== 'All') {
        // Map division abbreviations
        const divisionMap: Record<string, string> = {
          'A': 'Atlantic',
          'M': 'Metropolitan',
          'C': 'Central',
          'P': 'Pacific',
        };
        const teamDivision = divisionMap[team.division || ''] || team.division;
        if (teamDivision !== divisionFilter) {
          return false;
        }
      }

      // Favorites only filter
      if (favoritesOnlyFilter && !favoriteTeams.includes(team.abbrev)) {
        return false;
      }

      return true;
    });
  };

  // Render team grid
  const renderTeamGrid = () => {
    const filteredTeams = getFilteredTeams();
    const favoriteList = filteredTeams.filter(t => favoriteTeams.includes(t.abbrev));
    const nonFavoriteList = filteredTeams.filter(t => !favoriteTeams.includes(t.abbrev));

    return (
      <FlatList
        data={[...favoriteList, ...nonFavoriteList]}
        renderItem={({ item }) => (
          <TeamCard
            teamName={item.name}
            teamAbbrev={item.abbrev}
            isFavorite={favoriteTeams.includes(item.abbrev)}
            record={item.record}
            points={item.points}
            conference={item.conference}
            onPress={() => handleTeamPress(item.abbrev)}
            onToggleFavorite={() => handleToggleFavorite(item.abbrev)}
          />
        )}
        keyExtractor={(item) => item.abbrev}
        numColumns={2}
        columnWrapperStyle={localStyles.gridRow}
        contentContainerStyle={localStyles.gridContainer}
        ListHeaderComponent={
          favoriteList.length > 0 ? (
            <View style={localStyles.sectionHeader}>
              <Text style={localStyles.sectionTitle}>⭐ My Teams</Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    );
  };

  // Render modal tabs
  const renderTabContent = (tabId: string) => {
    if (!selectedTeam) return null;

    switch (tabId) {
      case 'overview':
        return renderOverviewTab();
      case 'stats':
        return renderStatsTab();
      case 'charts':
        return renderChartsTab();
      default:
        return null;
    }
  };

  const renderOverviewTab = () => {
    if (standingsData.loading || teamStatsLoading) {
      return (
        <View style={localStyles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.subtext}>Loading team data...</Text>
        </View>
      );
    }

    // Use standings data as the primary source for current season stats
    const teamStanding = teams.find(t => t.abbrev === selectedTeam);
    if (!teamStanding) {
      return (
        <View>
          <Text style={styles.greeting}>Team Overview</Text>
          <Text style={styles.subtext}>No data available</Text>
        </View>
      );
    }

    // Basic stats
    const wins = teamStanding.wins || 0;
    const losses = teamStanding.losses || 0;
    const otLosses = teamStanding.otLosses || 0;
    const points = teamStanding.points || 0;
    const gamesPlayed = teamStanding.gamesPlayed || wins + losses + otLosses || 1;
    const goalsFor = teamStanding.goalsFor || 0;
    const goalsAgainst = teamStanding.goalsAgainst || 0;
    const goalDifferential = goalsFor - goalsAgainst;
    const streak = teamStanding.streakCode || 'N/A';
    const last10Wins = teamStanding.l10Wins || 0;
    const last10Losses = teamStanding.l10Losses || 0;
    const last10OtLosses = teamStanding.l10OtLosses || 0;

    // Calculate efficiency metrics
    const pointsPct = ((points / (gamesPlayed * 2)) * 100).toFixed(1);
    const goalsPerGame = (goalsFor / gamesPlayed).toFixed(2);
    const goalsAgainstPerGame = (goalsAgainst / gamesPlayed).toFixed(2);
    const goalDiffPerGame = (goalDifferential / gamesPlayed).toFixed(2);
    const pointsPerGame = (points / gamesPlayed).toFixed(2);
    const projectedPoints = Math.round((points / gamesPlayed) * 82);

    // Last 10 games efficiency
    const last10Games = last10Wins + last10Losses + last10OtLosses;
    const last10Points = (last10Wins * 2) + last10OtLosses;
    const last10PossiblePoints = last10Games * 2;
    const last10Pct = last10Games > 0 ? ((last10Points / last10PossiblePoints) * 100).toFixed(0) : '0';

    // Rankings
    const leagueRank = standingsData.currentRanks.league || 0;
    const confRank = standingsData.currentRanks.conf || 0;
    const divRank = standingsData.currentRanks.div || 0;

    // Playoff positioning
    const playoffLine = confRank && confRank <= 8 ? 'In Playoff Position' : confRank && confRank <= 11 ? 'In Wild Card Race' : 'Outside Playoffs';
    const playoffStatus = playoffLine.replace('In ', '');
    const playoffColor = confRank && confRank <= 8 ? '#10b981' : confRank && confRank <= 11 ? '#f59e0b' : '#ef4444';

    // Performance rating based on points % (recalibrated for NHL)
    const performanceRating =
      parseFloat(pointsPct) >= 65 ? { label: 'Elite', color: '#10b981' }
      : parseFloat(pointsPct) >= 55 ? { label: 'Strong', color: '#3b82f6' }
      : parseFloat(pointsPct) >= 50 ? { label: 'Average', color: '#f59e0b' }
      : { label: 'Struggling', color: '#ef4444' };

    // Momentum indicator
    const momentum =
      parseFloat(last10Pct) >= 65 ? { label: 'Hot', color: '#ef4444' }
      : parseFloat(last10Pct) >= 50 ? { label: 'Steady', color: '#3b82f6' }
      : { label: 'Cold', color: '#60a5fa' };

    // Extract situational stats from standings API data (teamStanding)
    // Home/Road efficiency (from standings API)
    const homeWins = teamStanding.homeWins || 0;
    const homeLosses = teamStanding.homeLosses || 0;
    const homeOtLosses = teamStanding.homeOtLosses || 0;
    const homeGames = homeWins + homeLosses + homeOtLosses || 1;
    const homePoints = (homeWins * 2) + homeOtLosses;
    const homePct = ((homePoints / (homeGames * 2)) * 100).toFixed(0);

    const roadWins = teamStanding.roadWins || 0;
    const roadLosses = teamStanding.roadLosses || 0;
    const roadOtLosses = teamStanding.roadOtLosses || 0;
    const roadGames = roadWins + roadLosses + roadOtLosses || 1;
    const roadPoints = (roadWins * 2) + roadOtLosses;
    const roadPct = ((roadPoints / (roadGames * 2)) * 100).toFixed(0);

    // Overtime/Shootout record (from standings API)
    const shootoutWins = teamStanding.shootoutWins || 0;
    const shootoutLosses = teamStanding.shootoutLosses || 0;
    const regulationWins = teamStanding.regulationWins || 0;
    const regulationPlusOtWins = teamStanding.regulationPlusOtWins || 0;
    const otWins = regulationPlusOtWins - regulationWins; // OT wins = (Reg+OT wins) - (Reg wins)

    // Total OT/SO record: wins in OT/SO vs losses in OT (which became OTL)
    const otShootoutWins = otWins + shootoutWins;
    const otShootoutLosses = otLosses; // OT losses from standings
    const otShootoutRecord = `${otShootoutWins}-${otShootoutLosses}`;

    // Special teams and one-goal games from optional teamStats if available
    const currentStats = teamStats?.currentStats;
    const seasonStats = teamStats?.seasonOverview;

    const oneGoalWins = currentStats?.oneGoalWins || 0;
    const oneGoalLosses = currentStats?.oneGoalLosses || 0;
    const oneGoalGames = oneGoalWins + oneGoalLosses;

    const ppPct =
      currentStats?.powerPlayPct ? (currentStats.powerPlayPct * 100).toFixed(1)
      : currentStats?.powerPlayPctg ? (currentStats.powerPlayPctg * 100).toFixed(1)
      : seasonStats?.powerPlayPct ? (seasonStats.powerPlayPct * 100).toFixed(1)
      : seasonStats?.powerPlayPctg ? (seasonStats.powerPlayPctg * 100).toFixed(1)
      : null;

    const pkPct =
      currentStats?.penaltyKillPct ? (currentStats.penaltyKillPct * 100).toFixed(1)
      : currentStats?.penaltyKillPctg ? (currentStats.penaltyKillPctg * 100).toFixed(1)
      : seasonStats?.penaltyKillPct ? (seasonStats.penaltyKillPct * 100).toFixed(1)
      : seasonStats?.penaltyKillPctg ? (seasonStats.penaltyKillPctg * 100).toFixed(1)
      : null;

    // Create apiStats object for TeamStatusBadges
    const apiStats = {
      wins,
      losses,
      otLosses,
      goalsFor,
      goalsAgainst,
      gamesPlayed,
      streakCode: streak,
      l10Wins: last10Wins,
      l10Losses: last10Losses,
      l10OtLosses: last10OtLosses,
      ...currentStats,
      ...seasonStats,
    };

    // Generate key insights
    const insights: Array<{ text: string; color: string }> = [];

    // Insight 1: Standing/Ranking
    if (leagueRank <= 5) {
      insights.push({
        text: `Top 5 in NHL - ${leagueRank}${leagueRank === 1 ? 'st' : leagueRank === 2 ? 'nd' : leagueRank === 3 ? 'rd' : 'th'} overall`,
        color: '#10b981'
      });
    } else if (confRank <= 3) {
      insights.push({
        text: `Top 3 in conference - ${confRank}${confRank === 1 ? 'st' : confRank === 2 ? 'nd' : 'rd'} place`,
        color: '#3b82f6'
      });
    } else if (confRank > 8) {
      insights.push({
        text: `Outside playoff position - ${confRank}${confRank === 11 ? 'th' : confRank === 12 ? 'th' : 'th'} in conference`,
        color: '#ef4444'
      });
    }

    // Insight 2: Recent form/streak
    if (streak && streak.length >= 2) {
      const streakNum = parseInt(streak.substring(1));
      if (streak.startsWith('W') && streakNum >= 3) {
        insights.push({
          text: `On a ${streakNum}-game winning streak`,
          color: '#10b981'
        });
      } else if (streak.startsWith('L') && streakNum >= 3) {
        insights.push({
          text: `Lost ${streakNum} games in a row`,
          color: '#ef4444'
        });
      }
    }

    // Insight 3: Performance standout
    if (parseFloat(last10Pct) >= 70) {
      insights.push({
        text: `Hot form - ${last10Pct}% points in last 10 games`,
        color: '#ef4444'
      });
    } else if (parseFloat(last10Pct) <= 30) {
      insights.push({
        text: `Cold stretch - Only ${last10Pct}% points in last 10`,
        color: '#60a5fa'
      });
    }

    // Insight 4: Goal differential
    if (goalDifferential >= 30) {
      insights.push({
        text: `Dominant goal differential: +${goalDifferential}`,
        color: '#10b981'
      });
    } else if (goalDifferential <= -20) {
      insights.push({
        text: `Struggling defensively: ${goalDifferential} goal differential`,
        color: '#ef4444'
      });
    }

    return (
      <View>
        {/* Key Insights */}
        {insights.length > 0 && (
          <>
            <Text style={[styles.greeting, { fontSize: 16, marginBottom: 12 }]}>
              Key Insights
            </Text>
            <View style={styles.factboxOne}>
              {insights.slice(0, 3).map((insight, index) => (
                <View
                  key={index}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderBottomWidth: index < insights.slice(0, 3).length - 1 ? 1 : 0,
                    borderBottomColor: theme.subtle,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: insight.color,
                      marginRight: 12,
                    }}
                  />
                  <Text style={[styles.subtext, { fontSize: 13, flex: 1, color: theme.text }]}>
                    {insight.text}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Season Snapshot */}
        <Text style={[styles.greeting, { fontSize: 16, marginBottom: 12, marginTop: insights.length > 0 ? 20 : 0 }]}>
          Season Snapshot
        </Text>

        <View style={styles.factboxrow}>
          <View style={styles.factboxThree}>
            <Text style={styles.boxtitle}>Record</Text>
            <Text style={styles.boxvalue}>{wins}-{losses}-{otLosses}</Text>
            <Text style={[styles.subtext, { fontSize: 11 }]}>{points} pts</Text>
          </View>
          <View style={styles.factboxThree}>
            <Text style={styles.boxtitle}>Points %</Text>
            <Text style={[styles.boxvalue, { color: performanceRating.color }]}>{pointsPct}%</Text>
            <Text style={[styles.subtext, { fontSize: 11, color: performanceRating.color }]}>{performanceRating.label}</Text>
          </View>
          <View style={styles.factboxThree}>
            <Text style={styles.boxtitle}>82-Gm Pace</Text>
            <Text style={styles.boxvalue}>{projectedPoints}</Text>
            <Text style={[styles.subtext, { fontSize: 11 }]}>{pointsPerGame} pts/gm</Text>
          </View>
        </View>

        <View style={[styles.factboxrow, { marginTop: 8 }]}>
          <View style={styles.factboxThree}>
            <Text style={styles.boxtitle}>League</Text>
            <Text style={styles.boxvalue}>{leagueRank}</Text>
            <Text style={[styles.subtext, { fontSize: 11 }]}>of 32</Text>
          </View>
          <View style={styles.factboxThree}>
            <Text style={styles.boxtitle}>Conference</Text>
            <Text style={styles.boxvalue}>{confRank}</Text>
            <Text style={[styles.subtext, { fontSize: 11, color: playoffColor }]}>{playoffStatus}</Text>
          </View>
          <View style={styles.factboxThree}>
            <Text style={styles.boxtitle}>Division</Text>
            <Text style={styles.boxvalue}>{divRank}</Text>
            <Text style={[styles.subtext, { fontSize: 11 }]}>of 8</Text>
          </View>
        </View>

        {/* Form & Momentum */}
        <Text style={[styles.greeting, { fontSize: 16, marginTop: 20, marginBottom: 12 }]}>
          Recent Form
        </Text>
        <View style={styles.factboxrow}>
          <View style={styles.factboxThree}>
            <Text style={styles.boxtitle}>Last 10</Text>
            <Text style={styles.boxvalue}>{last10Wins}-{last10Losses}-{last10OtLosses}</Text>
            <Text style={[styles.subtext, { fontSize: 11 }]}>{last10Points}/{last10PossiblePoints} pts</Text>
          </View>
          <View style={styles.factboxThree}>
            <Text style={styles.boxtitle}>L10 Form</Text>
            <Text style={[styles.boxvalue, { color: momentum.color }]}>{last10Pct}%</Text>
            <Text style={[styles.subtext, { fontSize: 11, color: momentum.color }]}>{momentum.label}</Text>
          </View>
          <View style={styles.factboxThree}>
            <Text style={styles.boxtitle}>Streak</Text>
            <Text style={styles.boxvalue}>{streak || 'N/A'}</Text>
          </View>
        </View>

        {/* Efficiency Metrics */}
        <Text style={[styles.greeting, { fontSize: 16, marginTop: 20, marginBottom: 12 }]}>
          Efficiency
        </Text>
        <View style={styles.factboxrow}>
          <View style={styles.factboxThree}>
            <Text style={styles.boxtitle}>GF/Game</Text>
            <Text style={styles.boxvalue}>{goalsPerGame}</Text>
          </View>
          <View style={styles.factboxThree}>
            <Text style={styles.boxtitle}>GA/Game</Text>
            <Text style={styles.boxvalue}>{goalsAgainstPerGame}</Text>
          </View>
          <View style={styles.factboxThree}>
            <Text style={styles.boxtitle}>Diff/Game</Text>
            <Text style={[styles.boxvalue, { color: parseFloat(goalDiffPerGame) >= 0 ? '#10b981' : '#ef4444' }]}>
              {parseFloat(goalDiffPerGame) > 0 ? '+' : ''}{goalDiffPerGame}
            </Text>
          </View>
        </View>

        {/* Situational Performance */}
        <Text style={[styles.greeting, { fontSize: 16, marginTop: 20, marginBottom: 12 }]}>
          Situational
        </Text>

        {/* Home/Road - Always available from standings API */}
        <View style={styles.factboxrow}>
          <View style={styles.factboxTwo}>
            <Text style={styles.boxtitle}>Home</Text>
            <Text style={styles.boxvalue}>{homeWins}-{homeLosses}-{homeOtLosses}</Text>
            <Text style={[styles.subtext, { fontSize: 11 }]}>{homePct}% pts</Text>
          </View>
          <View style={styles.factboxTwo}>
            <Text style={styles.boxtitle}>Road</Text>
            <Text style={styles.boxvalue}>{roadWins}-{roadLosses}-{roadOtLosses}</Text>
            <Text style={[styles.subtext, { fontSize: 11 }]}>{roadPct}% pts</Text>
          </View>
        </View>

        {/* OT/SO & Regulation Stats - Always available from standings API */}
        <View style={[styles.factboxrow, { marginTop: 8 }]}>
          <View style={styles.factboxTwo}>
            <Text style={styles.boxtitle}>OT/Shootout</Text>
            <Text style={styles.boxvalue}>{otShootoutRecord}</Text>
            <Text style={[styles.subtext, { fontSize: 11 }]}>
              {shootoutWins > 0 || shootoutLosses > 0
                ? `${shootoutWins}-${shootoutLosses} in SO`
                : `${otWins}-${otShootoutLosses} in OT`}
            </Text>
          </View>
          <View style={styles.factboxTwo}>
            <Text style={styles.boxtitle}>Regulation</Text>
            <Text style={styles.boxvalue}>{regulationWins}-{losses - otLosses}</Text>
            <Text style={[styles.subtext, { fontSize: 11 }]}>Reg only</Text>
          </View>
        </View>

        {/* One-Goal Games - Optional, only if available */}
        {oneGoalGames > 0 && (
          <View style={[styles.factboxrow, { marginTop: 8 }]}>
            <View style={styles.factboxTwo}>
              <Text style={styles.boxtitle}>One-Goal Games</Text>
              <Text style={styles.boxvalue}>{oneGoalWins}-{oneGoalLosses}</Text>
              <Text style={[styles.subtext, { fontSize: 11 }]}>
                {((oneGoalWins / oneGoalGames) * 100).toFixed(0)}% win rate
              </Text>
            </View>
            <View style={styles.factboxTwo}>
              <Text style={styles.boxtitle}>Close Game Pts</Text>
              <Text style={styles.boxvalue}>{(oneGoalWins * 2) + oneGoalLosses}</Text>
              <Text style={[styles.subtext, { fontSize: 11 }]}>in {oneGoalGames} games</Text>
            </View>
          </View>
        )}

        {/* Special Teams */}
        {ppPct && pkPct && (
          <View style={[styles.factboxrow, { marginTop: 8 }]}>
            <View style={styles.factboxTwo}>
              <Text style={styles.boxtitle}>Power Play</Text>
              <Text style={styles.boxvalue}>{ppPct}%</Text>
            </View>
            <View style={styles.factboxTwo}>
              <Text style={styles.boxtitle}>Penalty Kill</Text>
              <Text style={styles.boxvalue}>{pkPct}%</Text>
            </View>
          </View>
        )}

        {/* Team Insights */}
        {apiStats && <TeamStatusBadges teamStats={apiStats} standings={standingsData} />}
      </View>
    );
  };

  const renderStatsTab = () => {
    if (teamStatsLoading) {
      return (
        <View style={localStyles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.subtext}>Loading statistics...</Text>
        </View>
      );
    }

    // Use standings data as fallback (same as Overview tab)
    const teamStanding = teams.find(t => t.abbrev === selectedTeam);
    const stats = teamStats?.currentStats;

    // Get team-specific advanced stats from cache
    const teamAdvancedStats = selectedTeam ? advancedStats[selectedTeam] : undefined;

    if (!teamStanding && !stats) {
      return (
        <View>
          <Text style={styles.greeting}>Team Statistics</Text>
          <Text style={styles.subtext}>No statistics available</Text>
        </View>
      );
    }

    // Get games played from standings or stats
    const gamesPlayed = stats?.gamesPlayed ||
                       (teamStanding ? (teamStanding.wins || 0) + (teamStanding.losses || 0) + (teamStanding.otLosses || 0) : 1) || 1;

    const shotsForPerGame = stats?.shotsForPerGame || 0;
    const shotsAgainstPerGame = stats?.shotsAgainstPerGame || 0;
    const faceoffWinPct = stats?.faceoffWinPct ? (stats.faceoffWinPct * 100).toFixed(1) : null;
    const shootingPct = stats?.shootingPct ? (stats.shootingPct * 100).toFixed(1) : null;
    const savePct = stats?.savePct ? (stats.savePct * 100).toFixed(3) : null;
    const penaltyMinutesPerGame = stats?.penaltyMinutesPerGame || 0;

    // Home/Road splits - prefer standings data which is more reliable
    const homeWins = teamStanding?.homeWins || stats?.homeWins || 0;
    const homeLosses = teamStanding?.homeLosses || stats?.homeLosses || 0;
    const homeOtLosses = teamStanding?.homeOtLosses || stats?.homeOtLosses || 0;
    const roadWins = teamStanding?.roadWins || stats?.roadWins || 0;
    const roadLosses = teamStanding?.roadLosses || stats?.roadLosses || 0;
    const roadOtLosses = teamStanding?.roadOtLosses || stats?.roadOtLosses || 0;

    return (
      <View>
        <Text style={styles.greeting}>Detailed Statistics</Text>
        <Text style={styles.subtext}>Complete team performance breakdown</Text>

        {/* Shooting Stats - Only show if data available */}
        {(shotsForPerGame > 0 || shotsAgainstPerGame > 0 || shootingPct || faceoffWinPct || savePct) && (
          <>
            <Text style={[styles.greeting, { fontSize: 16, marginTop: 20, marginBottom: 12 }]}>
              Shooting & Possession
            </Text>
            {(shotsForPerGame > 0 || shotsAgainstPerGame > 0 || shootingPct) && (
              <View style={styles.factboxrow}>
                <View style={styles.factboxThree}>
                  <Text style={styles.boxtitle}>Shots For/Game</Text>
                  <Text style={styles.boxvalue}>{shotsForPerGame > 0 ? shotsForPerGame.toFixed(1) : 'N/A'}</Text>
                </View>
                <View style={styles.factboxThree}>
                  <Text style={styles.boxtitle}>Shots Against/Game</Text>
                  <Text style={styles.boxvalue}>{shotsAgainstPerGame > 0 ? shotsAgainstPerGame.toFixed(1) : 'N/A'}</Text>
                </View>
                <View style={styles.factboxThree}>
                  <Text style={styles.boxtitle}>Shooting %</Text>
                  <Text style={styles.boxvalue}>{shootingPct ? `${shootingPct}%` : 'N/A'}</Text>
                </View>
              </View>
            )}

            {(faceoffWinPct || savePct) && (
              <View style={[styles.factboxrow, { marginTop: 8 }]}>
                <View style={styles.factboxTwo}>
                  <Text style={styles.boxtitle}>Faceoff Win %</Text>
                  <Text style={styles.boxvalue}>{faceoffWinPct ? `${faceoffWinPct}%` : 'N/A'}</Text>
                </View>
                <View style={styles.factboxTwo}>
                  <Text style={styles.boxtitle}>Save %</Text>
                  <Text style={styles.boxvalue}>{savePct ? `${savePct}%` : 'N/A'}</Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* Discipline - Only show if data available */}
        {penaltyMinutesPerGame > 0 && (
          <>
            <Text style={[styles.greeting, { fontSize: 16, marginTop: 20, marginBottom: 12 }]}>
              Discipline
            </Text>
            <View style={styles.factboxrow}>
              <View style={styles.factboxTwo}>
                <Text style={styles.boxtitle}>PIM/Game</Text>
                <Text style={styles.boxvalue}>{penaltyMinutesPerGame.toFixed(1)}</Text>
              </View>
              <View style={styles.factboxTwo}>
                <Text style={styles.boxtitle}>Total PIM</Text>
                <Text style={styles.boxvalue}>{(penaltyMinutesPerGame * gamesPlayed).toFixed(0)}</Text>
              </View>
            </View>
          </>
        )}

        {/* Home/Road Splits - Always show from standings */}
        <Text style={[styles.greeting, { fontSize: 16, marginTop: 20, marginBottom: 12 }]}>
          Home/Road Splits
        </Text>
        <View style={styles.factboxrow}>
          <View style={styles.factboxTwo}>
            <Text style={styles.boxtitle}>Home Record</Text>
            <Text style={styles.boxvalue}>
              {homeWins}-{homeLosses}-{homeOtLosses}
            </Text>
            <Text style={[styles.subtext, { fontSize: 11, marginTop: 4 }]}>
              {((homeWins / (homeWins + homeLosses + homeOtLosses || 1)) * 100).toFixed(0)}% Win Rate
            </Text>
          </View>
          <View style={styles.factboxTwo}>
            <Text style={styles.boxtitle}>Road Record</Text>
            <Text style={styles.boxvalue}>
              {roadWins}-{roadLosses}-{roadOtLosses}
            </Text>
            <Text style={[styles.subtext, { fontSize: 11, marginTop: 4 }]}>
              {((roadWins / (roadWins + roadLosses + roadOtLosses || 1)) * 100).toFixed(0)}% Win Rate
            </Text>
          </View>
        </View>

        {/* Advanced Analytics */}
        <Text style={[styles.greeting, { fontSize: 16, marginTop: 20, marginBottom: 12 }]}>
          Advanced Analytics
        </Text>

        {teamAdvancedStats?.loading && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={theme.accent} />
            <Text style={styles.subtext}>Loading advanced stats...</Text>
          </View>
        )}

        {teamAdvancedStats?.error && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={[styles.subtext, { color: '#ef4444' }]}>{teamAdvancedStats.error}</Text>
          </View>
        )}

        {teamAdvancedStats?.stats && (
          <>
            {/* Shot Metrics */}
            <Text style={[styles.subtext, { fontSize: 14, fontWeight: '600' }]}>
              Shot Metrics
            </Text>
            <View style={styles.factboxrow}>
              <AdvancedStatCard
                metric={ADVANCED_METRICS.corsiFor}
                value={teamAdvancedStats.stats.corsiFor}
                leagueRank={teamAdvancedStats.stats.corsiForRank}
                leagueThresholds={teamAdvancedStats.stats.leagueThresholds?.corsiFor}
              />
              <AdvancedStatCard
                metric={ADVANCED_METRICS.fenwickFor}
                value={teamAdvancedStats.stats.fenwickFor}
                leagueRank={teamAdvancedStats.stats.fenwickForRank}
                leagueThresholds={teamAdvancedStats.stats.leagueThresholds?.fenwickFor}
              />
              <AdvancedStatCard
                metric={ADVANCED_METRICS.shotsOnGoalPct}
                value={teamAdvancedStats.stats.shotsOnGoalPct}
                leagueRank={teamAdvancedStats.stats.shotsOnGoalPctRank}
                leagueThresholds={teamAdvancedStats.stats.leagueThresholds?.shotsOnGoalPct}
              />
            </View>

            {/* Expected Goals */}
            <Text style={[styles.subtext, { fontSize: 14, fontWeight: '600', marginTop: 20 }]}>
              Expected Goals
            </Text>
            <View style={styles.factboxrow}>
              <AdvancedStatCard
                metric={ADVANCED_METRICS.expectedGoals}
                value={teamAdvancedStats.stats.expectedGoals}
                leagueRank={teamAdvancedStats.stats.expectedGoalsRank}
                leagueThresholds={teamAdvancedStats.stats.leagueThresholds?.expectedGoals}
              />
              <AdvancedStatCard
                metric={ADVANCED_METRICS.expectedGoalsDiff}
                value={teamAdvancedStats.stats.expectedGoalsDiff}
                leagueRank={teamAdvancedStats.stats.expectedGoalsDiffRank}
                leagueThresholds={teamAdvancedStats.stats.leagueThresholds?.expectedGoalsDiff}
              />
            </View>

            <View style={[styles.factboxrow, { marginTop: 8 }]}>
              <AdvancedStatCard
                metric={ADVANCED_METRICS.highDangerChances}
                value={teamAdvancedStats.stats.highDangerChances}
                leagueRank={teamAdvancedStats.stats.highDangerChancesRank}
                leagueThresholds={teamAdvancedStats.stats.leagueThresholds?.highDangerChances}
              />
              <AdvancedStatCard
                metric={ADVANCED_METRICS.shootingTalent}
                value={teamAdvancedStats.stats.shootingTalent}
                leagueRank={teamAdvancedStats.stats.shootingTalentRank}
                leagueThresholds={teamAdvancedStats.stats.leagueThresholds?.shootingTalent}
              />
            </View>

            {/* PDO */}
            <Text style={[styles.subtext, { fontSize: 14, fontWeight: '600', marginTop: 20 }]}>
              Luck & Sustainability
            </Text>
            <View style={styles.factboxrow}>
              <AdvancedStatCard
                metric={ADVANCED_METRICS.pdo}
                value={teamAdvancedStats.stats.pdo}
                leagueRank={teamAdvancedStats.stats.pdoRank}
                leagueThresholds={teamAdvancedStats.stats.leagueThresholds?.pdo}
              />
            </View>

            {/* Special Teams */}
            <Text style={[styles.subtext, { fontSize: 14, fontWeight: '600', marginTop: 20 }]}>
              Special Teams
            </Text>
            <View style={styles.factboxrow}>
              <AdvancedStatCard
                metric={ADVANCED_METRICS.powerPlayXG}
                value={teamAdvancedStats.stats.powerPlayXG}
                leagueRank={teamAdvancedStats.stats.powerPlayXGRank}
                leagueThresholds={teamAdvancedStats.stats.leagueThresholds?.powerPlayXG}
              />
              <AdvancedStatCard
                metric={ADVANCED_METRICS.penaltyKillXGA}
                value={teamAdvancedStats.stats.penaltyKillXGA}
                leagueRank={teamAdvancedStats.stats.penaltyKillXGARank}
                leagueThresholds={teamAdvancedStats.stats.leagueThresholds?.penaltyKillXGA}
              />
            </View>

            {/* Goaltending */}
            <Text style={[styles.subtext, { fontSize: 14, fontWeight: '600', marginTop: 20 }]}>
              Goaltending
            </Text>
            <View style={styles.factboxrow}>
              <AdvancedStatCard
                metric={ADVANCED_METRICS.goalsAllowedAboveExpected}
                value={teamAdvancedStats.stats.goalsAllowedAboveExpected}
                leagueRank={teamAdvancedStats.stats.goalsAllowedAboveExpectedRank}
                leagueThresholds={teamAdvancedStats.stats.leagueThresholds?.goalsAllowedAboveExpected}
              />
              <AdvancedStatCard
                metric={ADVANCED_METRICS.highDangerSavePct}
                value={teamAdvancedStats.stats.highDangerSavePct}
                leagueRank={teamAdvancedStats.stats.highDangerSavePctRank}
                leagueThresholds={teamAdvancedStats.stats.leagueThresholds?.highDangerSavePct}
              />
            </View>

            <View style={[styles.factboxrow, { marginTop: 8 }]}>
              <AdvancedStatCard
                metric={ADVANCED_METRICS.reboundControl}
                value={teamAdvancedStats.stats.reboundControl}
                leagueRank={teamAdvancedStats.stats.reboundControlRank}
                leagueThresholds={teamAdvancedStats.stats.leagueThresholds?.reboundControl}
              />
              <AdvancedStatCard
                metric={ADVANCED_METRICS.qualityStart}
                value={teamAdvancedStats.stats.qualityStart}
                leagueRank={teamAdvancedStats.stats.qualityStartRank}
                leagueThresholds={teamAdvancedStats.stats.leagueThresholds?.qualityStart}
              />
            </View>
          </>
        )}

      </View>
    );
  };

  const renderChartsTab = () => {
    if (teamStatsLoading || standingsData.loading) {
      return (
        <View style={localStyles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.subtext}>Loading chart data...</Text>
        </View>
      );
    }

    const teamStanding = teams.find(t => t.abbrev === selectedTeam);
    if (!teamStanding) {
      return (
        <View>
          <Text style={styles.greeting}>Charts & Visualizations</Text>
          <Text style={styles.subtext}>No data available</Text>
        </View>
      );
    }

    // Calculate data for charts
    const wins = teamStanding.wins || 0;
    const losses = teamStanding.losses || 0;
    const otLosses = teamStanding.otLosses || 0;
    const gamesPlayed = wins + losses + otLosses || 1;
    const points = teamStanding.points || 0;
    const goalsFor = teamStanding.goalsFor || 0;
    const goalsAgainst = teamStanding.goalsAgainst || 0;

    // Helper function to ensure valid chart values
    const sanitizeValue = (val: number, fallback: number = 0): number => {
      if (val === null || val === undefined || isNaN(val) || !isFinite(val)) {
        return fallback;
      }
      return Math.max(0, val); // Ensure non-negative
    };

    // Calculate league averages for comparison with safety checks
    const leagueAvgGoalsFor = teams.length > 0
      ? teams.reduce((sum, t) => sum + (t.goalsFor || 0), 0) / teams.length
      : 1;
    const leagueAvgGoalsAgainst = teams.length > 0
      ? teams.reduce((sum, t) => sum + (t.goalsAgainst || 0), 0) / teams.length
      : 1;
    const leagueAvgPoints = teams.length > 0
      ? teams.reduce((sum, t) => sum + (t.points || 0), 0) / teams.length
      : 1;
    const leagueAvgWinPct = teams.length > 0
      ? teams.reduce((sum, t) => {
          const gp = (t.wins || 0) + (t.losses || 0) + (t.otLosses || 0) || 1;
          return sum + ((t.wins || 0) / gp);
        }, 0) / teams.length
      : 0.5;

    const teamWinPct = wins / gamesPlayed;

    // Chart configuration
    const screenWidth = Dimensions.get('window').width - 40;
    const chartConfig = {
      backgroundColor: theme.factbox,
      backgroundGradientFrom: theme.factbox,
      backgroundGradientTo: theme.factbox,
      decimalPlaces: 1,
      color: (opacity = 1) => `rgba(96, 165, 250, ${opacity})`,
      labelColor: (opacity = 1) => `rgba(230, 238, 248, ${opacity})`,
      style: {
        borderRadius: 16,
      },
      propsForDots: {
        r: '4',
        strokeWidth: '2',
        stroke: theme.accent,
      },
      propsForBackgroundLines: {
        strokeDasharray: '',
        stroke: theme.subtle,
        strokeWidth: 1,
      },
    };

    // Performance comparison data with safe calculations
    const goalsForPct = sanitizeValue((goalsFor / gamesPlayed) / Math.max(0.1, leagueAvgGoalsFor / 82) * 100, 100);
    const goalsAgainstPct = sanitizeValue((goalsAgainst / gamesPlayed) / Math.max(0.1, leagueAvgGoalsAgainst / 82) * 100, 100);
    const pointsPct = sanitizeValue((points / gamesPlayed) / Math.max(0.1, leagueAvgPoints / 82) * 100, 100);
    const winPctComparison = sanitizeValue((teamWinPct / Math.max(0.01, leagueAvgWinPct)) * 100, 100);

    const performanceComparisonData = {
      labels: ['GF', 'GA', 'Pts', 'Win%'],
      datasets: [
        {
          data: [goalsForPct, goalsAgainstPct, pointsPct, winPctComparison],
          color: (opacity = 1) => `rgba(96, 165, 250, ${opacity})`,
        },
      ],
    };

    // Season progress simulation (estimated progression)
    const progressData = {
      labels: ['0', Math.floor(gamesPlayed / 4).toString(), Math.floor(gamesPlayed / 2).toString(), Math.floor(gamesPlayed * 3 / 4).toString(), gamesPlayed.toString()],
      datasets: [
        {
          data: [
            0,
            sanitizeValue(points * 0.23),
            sanitizeValue(points * 0.48),
            sanitizeValue(points * 0.75),
            sanitizeValue(points),
          ],
          color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
          strokeWidth: 3,
        },
      ],
    };

    return (
      <View>
        <Text style={styles.greeting}>Charts & Visualizations</Text>
        <Text style={styles.subtext}>Visual analytics and performance trends</Text>

        {/* Season Points Progression */}
        <Text style={[styles.greeting, { fontSize: 16, marginTop: 20, marginBottom: 12 }]}>
          Season Points Progression
        </Text>
        <View style={[styles.factbox, { padding: 16 }]}>
          <LineChart
            data={progressData}
            width={screenWidth - 32}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
            withInnerLines={true}
            withOuterLines={true}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            fromZero={true}
          />
          <Text style={[styles.subtext, { fontSize: 11, textAlign: 'center', marginTop: 8 }]}>
            Games Played (Estimated Progression)
          </Text>
        </View>

        {/* Performance vs League Average */}
        <Text style={[styles.greeting, { fontSize: 16, marginTop: 20, marginBottom: 12 }]}>
          Performance vs League Average
        </Text>
        <View style={[styles.factbox, { padding: 16 }]}>
          <BarChart
            data={performanceComparisonData}
            width={screenWidth - 32}
            height={220}
            yAxisLabel=""
            yAxisSuffix="%"
            chartConfig={{
              ...chartConfig,
              barPercentage: 0.7,
            }}
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
            fromZero={true}
            showValuesOnTopOfBars={true}
          />
          <Text style={[styles.subtext, { fontSize: 11, textAlign: 'center', marginTop: 8 }]}>
            Team performance relative to league average (100% = average)
          </Text>
        </View>

        {/* Goal Differential Visualization */}
        <Text style={[styles.greeting, { fontSize: 16, marginTop: 20, marginBottom: 12 }]}>
          Scoring Trends
        </Text>
        <View style={[styles.factbox, { padding: 16 }]}>
          <LineChart
            data={{
              labels: ['Start', 'Q1', 'Q2', 'Q3', 'Current'],
              datasets: [
                {
                  data: [0, sanitizeValue(goalsFor * 0.2), sanitizeValue(goalsFor * 0.45), sanitizeValue(goalsFor * 0.7), sanitizeValue(goalsFor)],
                  color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                  strokeWidth: 2,
                },
                {
                  data: [0, sanitizeValue(goalsAgainst * 0.2), sanitizeValue(goalsAgainst * 0.45), sanitizeValue(goalsAgainst * 0.7), sanitizeValue(goalsAgainst)],
                  color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                  strokeWidth: 2,
                },
              ],
              legend: ['Goals For', 'Goals Against'],
            }}
            width={screenWidth - 32}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
          />
          <Text style={[styles.subtext, { fontSize: 11, textAlign: 'center', marginTop: 8 }]}>
            Green = Goals For, Red = Goals Against (Estimated Progression)
          </Text>
        </View>

        {/* Advanced Stats Comparison */}
        {advancedStats.stats && (
          <>
            <Text style={[styles.greeting, { fontSize: 16, marginTop: 20, marginBottom: 12 }]}>
              Advanced Stats Snapshot
            </Text>
            <View style={[styles.factbox, { padding: 16 }]}>
              <BarChart
                data={{
                  labels: ['Corsi', 'Fenwick', 'xG', 'PDO'],
                  datasets: [
                    {
                      data: [
                        sanitizeValue(advancedStats.stats.corsiFor, 50),
                        sanitizeValue(advancedStats.stats.fenwickFor, 50),
                        sanitizeValue(advancedStats.stats.expectedGoals / 2, 50),
                        sanitizeValue(advancedStats.stats.pdo - 900, 100),
                      ],
                    },
                  ],
                }}
                width={screenWidth - 32}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                  ...chartConfig,
                  barPercentage: 0.7,
                }}
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                }}
                fromZero={true}
                showValuesOnTopOfBars={true}
              />
              <Text style={[styles.subtext, { fontSize: 11, textAlign: 'center', marginTop: 8 }]}>
                Key advanced metrics (values normalized for visualization)
              </Text>
            </View>
          </>
        )}

        {/* Conference Standing Visualization */}
        <Text style={[styles.greeting, { fontSize: 16, marginTop: 20, marginBottom: 12 }]}>
          Conference Position
        </Text>
        <View style={[styles.factbox, { padding: 16 }]}>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.boxvalue, { fontSize: 48, color: theme.accent }]}>
              {standingsData.currentRanks.conf || '—'}
            </Text>
            <Text style={[styles.subtext, { fontSize: 14, marginTop: 8 }]}>
              out of 16 teams
            </Text>
            <View style={{ width: '100%', height: 20, backgroundColor: theme.subtle, borderRadius: 10, marginTop: 20, overflow: 'hidden' }}>
              <View
                style={{
                  width: `${((17 - (standingsData.currentRanks.conf || 8)) / 16) * 100}%`,
                  height: '100%',
                  backgroundColor: standingsData.currentRanks.conf && standingsData.currentRanks.conf <= 8 ? '#10b981' : standingsData.currentRanks.conf && standingsData.currentRanks.conf <= 11 ? '#f59e0b' : '#ef4444',
                }}
              />
            </View>
            <Text style={[styles.subtext, { fontSize: 11, textAlign: 'center', marginTop: 12 }]}>
              {standingsData.currentRanks.conf && standingsData.currentRanks.conf <= 8 ? 'In Playoff Position' : standingsData.currentRanks.conf && standingsData.currentRanks.conf <= 11 ? 'Wild Card Race' : 'Outside Playoffs'}
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingHorizontal: 20 }]}>
        <Text style={styles.title}>Teams</Text>
        <Text style={styles.subtitle}>Explore NHL teams and analytics</Text>
      </View>

      {/* Filters */}
      <View style={localStyles.filterSection}>
        {/* Conference Filter */}
        <View style={localStyles.filterRow}>
          <Text style={localStyles.filterLabel}>Conference:</Text>
          <View style={localStyles.filterButtonsRow}>
            {(['All', 'East', 'West'] as const).map((conf) => (
              <TouchableOpacity
                key={conf}
                style={[
                  localStyles.filterButton,
                  conferenceFilter === conf && localStyles.filterButtonActive,
                ]}
                onPress={() => setConferenceFilter(conf)}
              >
                <Text
                  style={[
                    localStyles.filterButtonText,
                    conferenceFilter === conf && localStyles.filterButtonTextActive,
                  ]}
                >
                  {conf}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Division Filter */}
        <View style={localStyles.filterRow}>
          <Text style={localStyles.filterLabel}>Division:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={localStyles.filterScrollView}
            contentContainerStyle={{ gap: 6 }}
          >
            {(['All', 'Atlantic', 'Metropolitan', 'Central', 'Pacific'] as const).map((div) => (
              <TouchableOpacity
                key={div}
                style={[
                  localStyles.filterButton,
                  divisionFilter === div && localStyles.filterButtonActive,
                ]}
                onPress={() => setDivisionFilter(div)}
              >
                <Text
                  style={[
                    localStyles.filterButtonText,
                    divisionFilter === div && localStyles.filterButtonTextActive,
                  ]}
                >
                  {div}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Favorites Toggle */}
        <View style={localStyles.filterRow}>
          <Text style={localStyles.filterLabel}>Show:</Text>
          <View style={localStyles.filterButtonsRow}>
            <TouchableOpacity
              style={[
                localStyles.filterButton,
                !favoritesOnlyFilter && localStyles.filterButtonActive,
              ]}
              onPress={() => setFavoritesOnlyFilter(false)}
            >
              <Text
                style={[
                  localStyles.filterButtonText,
                  !favoritesOnlyFilter && localStyles.filterButtonTextActive,
                ]}
              >
                All Teams
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                localStyles.filterButton,
                favoritesOnlyFilter && localStyles.filterButtonActive,
              ]}
              onPress={() => setFavoritesOnlyFilter(true)}
            >
              <Text
                style={[
                  localStyles.filterButtonText,
                  favoritesOnlyFilter && localStyles.filterButtonTextActive,
                ]}
              >
                ⭐ Favorites
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Teams Grid */}
      {loadingTeams ? (
        <View style={localStyles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.subtext}>Loading teams...</Text>
        </View>
      ) : teamsError ? (
        <View style={{ padding: 20 }}>
          <Text style={[styles.subtext, { color: 'red' }]}>Error: {teamsError}</Text>
        </View>
      ) : (
        renderTeamGrid()
      )}

      {/* Team Modal */}
      {selectedTeam && (
        <TeamModal
          visible={showModal}
          onClose={() => {
            setShowModal(false);
            // Reset data when closing (but keep advanced stats cache)
            setTimeout(() => {
              setSelectedTeam(null);
              setTeamStats(null);
            }, 300);
          }}
          teamName={teams.find(t => t.abbrev === selectedTeam)?.name || selectedTeam}
          teamAbbrev={selectedTeam}
          tabs={modalTabs}
          renderTabContent={renderTabContent}
          initialTab="overview"
          onTabChange={(tabId) => {
            if (tabId === 'stats' && selectedTeam && teamStats?.currentStats) {
              loadAdvancedStats(selectedTeam, true); // Force reload
            }
          }}
        />
      )}
    </ThemedView>
  );
}

const localStyles = StyleSheet.create({
  gridContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  gridRow: {
    gap: 12,
    marginBottom: 12,
  },
  sectionHeader: {
    marginBottom: 12,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  filterSection: {
    backgroundColor: theme.card,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.subtle,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
    width: '100%',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.subtext,
    width: 90,
    flexShrink: 0,
  },
  filterButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  filterScrollView: {
    flexGrow: 1,
    flexShrink: 1,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.factbox,
    borderWidth: 1,
    borderColor: theme.subtle,
  },
  filterButtonActive: {
    backgroundColor: theme.accent + '22',
    borderColor: theme.accent,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.subtext,
  },
  filterButtonTextActive: {
    color: theme.accent,
    fontWeight: '700',
  },
});
