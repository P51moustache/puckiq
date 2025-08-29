import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Modal, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeStyles } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import Dropdown from '@/components/Dropdown';
import { LineChart } from 'react-native-chart-kit';
import { Line as SvgLine } from 'react-native-svg';

type Team = {
  id: string;
  name: string;
  abbrev: string; // three-letter code
};

type StandingsRow = {
  leagueSequence: number;
  conferenceSequence: number;
  divisionSequence: number;
  teamAbbrev: { default: string } | string;
  conferenceAbbrev?: string;
  divisionAbbrev?: string;
};

type RankSet = { league: number | null; conf: number | null; div: number | null };
type TotalSet = { league: number; conf: number; div: number };
type TeamInfo = { conference: string | null; division: string | null };
type YearlyData = { year: string; league: number | null; conf: number | null; div: number | null };

export default function DeepDiveScreen() {
  const styles = makeStyles();
  
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Teams state
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null); // abbrev

  // Analysis selection state
  const [selectedAnalysis, setSelectedAnalysis] = useState<string | null>(null);

  // Basic team info state (separate from standings)
  const [basicTeamInfo, setBasicTeamInfo] = useState<TeamInfo>({ conference: null, division: null });
  const [basicTeamLoading, setBasicTeamLoading] = useState(false);
  const [basicTeamError, setBasicTeamError] = useState<string | null>(null);

  // Standings state
  const [currentRanks, setCurrentRanks] = useState<RankSet>({ league: null, conf: null, div: null });
  const [avgRanks, setAvgRanks] = useState<RankSet>({ league: null, conf: null, div: null });
  const [currentTotals, setCurrentTotals] = useState<TotalSet>({ league: 32, conf: 16, div: 8 });
  const [teamInfo, setTeamInfo] = useState<TeamInfo>({ conference: null, division: null });
  const [historicalData, setHistoricalData] = useState<YearlyData[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [standingsError, setStandingsError] = useState<string | null>(null);

  // Team stats state
  const [teamStats, setTeamStats] = useState<any>(null);
  const [teamStatsLoading, setTeamStatsLoading] = useState(false);
  const [teamStatsError, setTeamStatsError] = useState<string | null>(null);

  // Analysis options
  const analysisOptions = [
    { label: 'Standings Analysis', value: 'standings' },
    { label: 'Team Statistics', value: 'stats' },
  ];

  // Load saved team preference on app start
  useEffect(() => {
    async function loadSavedTeam() {
      try {
        const savedTeam = await AsyncStorage.getItem('selectedTeam');
        if (savedTeam) {
          setSelectedTeam(savedTeam);
        }
      } catch (error) {
        console.warn('Failed to load saved team preference:', error);
      }
    }
    loadSavedTeam();
  }, []);

  // Save team preference whenever it changes
  const handleTeamChange = async (teamAbbrev: string | null) => {
    setSelectedTeam(teamAbbrev);
    try {
      if (teamAbbrev) {
        await AsyncStorage.setItem('selectedTeam', teamAbbrev);
      } else {
        await AsyncStorage.removeItem('selectedTeam');
      }
    } catch (error) {
      console.warn('Failed to save team preference:', error);
    }
  };

  // Fetch teams once
  useEffect(() => {
    let mounted = true;
    async function loadTeams() {
      setLoadingTeams(true);
      setTeamsError(null);
      try {
        const res = await fetch('https://api.nhle.com/stats/rest/en/team');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json?.teams) ? json.teams : [];
        const EXCLUDE_ABBREV = new Set([
          'ATL', 'ARI', 'AFM', 'BRK', 'CGS', 'CLE', 'CLR', 'DCG', 'DFL', 'HAM', 'HFD', 'KCS', 'MNS', 'MMR', 'MWN', 'NYA', 'NHL',
          'OAK', 'SEN', 'QUA', 'PHX', 'PIR', 'QBD', 'QUE', 'SLE', 'TBD', 'TAN', 'TSP', 'WIN',
        ]);
        const EXCLUDE_NAMES = new Set(['UTAH HOCKEY CLUB']);
        const parsed: Team[] = rows
          .map((r: any) => ({
            id: String(r.teamId ?? r.id ?? r.abbrev ?? r.teamAbbrev ?? Math.random()),
            name: String(
              r.teamFullName ?? r.fullName ?? r.teamName ?? r.name ?? `${r.teamCommonName ?? ''} ${r.teamPlaceName ?? ''}`
            ).trim(),
            abbrev: String(r.teamAbbrev ?? r.abbrev ?? r.triCode ?? r.code ?? '').toUpperCase(),
          }))
          .filter((t: Team) => t.abbrev && t.name)
          .filter((t: Team) => !EXCLUDE_ABBREV.has(t.abbrev) && !EXCLUDE_NAMES.has(t.name.toUpperCase()));
        parsed.sort((a, b) => a.name.localeCompare(b.name));
        if (mounted) setTeams(parsed);
      } catch (e: any) {
        if (mounted) setTeamsError(e?.message ?? 'Failed to load teams');
      } finally {
        if (mounted) setLoadingTeams(false);
      }
    }
    loadTeams();
    return () => {
      mounted = false;
    };
  }, []);

  // Helpers: season utilities
  const getCurrentSeasonId = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1; // 1-12
    // NHL season starts in Oct; if before July, still in previous season end-year
    const startYear = month >= 7 ? year : year - 1;
    return Number(`${startYear}${startYear + 1}`);
  };

  // Fetch basic team info (conference/division) immediately when team is selected
  useEffect(() => {
    if (!selectedTeam) {
      setBasicTeamInfo({ conference: null, division: null });
      return;
    }

    let cancelled = false;
    async function loadBasicTeamInfo() {
      setBasicTeamLoading(true);
      setBasicTeamError(null);
      try {
        // Get current standings just for team conference/division info
        const res = await fetch('https://api-web.nhle.com/v1/standings/2024-12-01');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows: StandingsRow[] = Array.isArray(json?.standings) ? json.standings : [];
        const teamData = rows.find((r: any) => (r.teamAbbrev?.default ?? r.teamAbbrev ?? '').toUpperCase() === selectedTeam);
        
        // Map conference and division abbreviations to full names
        const conferenceNames: Record<string, string> = { 'E': 'Eastern', 'W': 'Western' };
        const divisionNames: Record<string, string> = { 
          'A': 'Atlantic', 'C': 'Central', 'M': 'Metropolitan', 'P': 'Pacific' 
        };
        
        if (!cancelled) {
          setBasicTeamInfo({ 
            conference: teamData?.conferenceAbbrev ? conferenceNames[teamData.conferenceAbbrev] || teamData.conferenceAbbrev : null,
            division: teamData?.divisionAbbrev ? divisionNames[teamData.divisionAbbrev] || teamData.divisionAbbrev : null
          });
        }
      } catch (e: any) {
        if (!cancelled) setBasicTeamError(e?.message ?? 'Failed to load team info');
      } finally {
        if (!cancelled) setBasicTeamLoading(false);
      }
    }
    loadBasicTeamInfo();
    return () => { cancelled = true; };
  }, [selectedTeam]);

  // Fetch standings for now and historical averages (only when standings analysis is selected)
  useEffect(() => {
    if (!selectedTeam || selectedAnalysis !== 'standings') {
      setCurrentRanks({ league: null, conf: null, div: null });
      setAvgRanks({ league: null, conf: null, div: null });
      setTeamInfo({ conference: null, division: null });
      setHistoricalData([]);
      return;
    }

    let cancelled = false;
    async function loadStandings() {
      setStandingsLoading(true);
      setStandingsError(null);
      try {
        // Current standings
        const resNow = await fetch('https://api-web.nhle.com/v1/standings/2024-12-01'); // Use a known date with data
        if (!resNow.ok) throw new Error(`HTTP ${resNow.status}`);
        const jsonNow = await resNow.json();
        const rowsNow: StandingsRow[] = Array.isArray(jsonNow?.standings) ? jsonNow.standings : [];
        const mineNow = rowsNow.find((r: any) => (r.teamAbbrev?.default ?? r.teamAbbrev ?? '').toUpperCase() === selectedTeam);
        
        // Calculate totals from actual data
        const leagueTotal = rowsNow.length;
        let confTotal = 16; // default
        let divTotal = 8; // default
        
        if (mineNow) {
          const myConf = mineNow.conferenceAbbrev;
          const myDiv = mineNow.divisionAbbrev;
          if (myConf) {
            confTotal = rowsNow.filter(r => r.conferenceAbbrev === myConf).length;
          }
          if (myDiv) {
            divTotal = rowsNow.filter(r => r.divisionAbbrev === myDiv).length;
          }
        }
        
        const leagueRankNow = mineNow?.leagueSequence ?? null;
        const confRankNow = mineNow?.conferenceSequence ?? null;
        const divRankNow = mineNow?.divisionSequence ?? null;
        
        // Map conference and division abbreviations to full names
        const conferenceNames: Record<string, string> = { 'E': 'Eastern', 'W': 'Western' };
        const divisionNames: Record<string, string> = { 
          'A': 'Atlantic', 'C': 'Central', 'M': 'Metropolitan', 'P': 'Pacific' 
        };
        
        if (!cancelled) {
          setCurrentRanks({ league: leagueRankNow, conf: confRankNow, div: divRankNow });
          setCurrentTotals({ league: leagueTotal, conf: confTotal, div: divTotal });
          setTeamInfo({ 
            conference: mineNow?.conferenceAbbrev ? conferenceNames[mineNow.conferenceAbbrev] || mineNow.conferenceAbbrev : null,
            division: mineNow?.divisionAbbrev ? divisionNames[mineNow.divisionAbbrev] || mineNow.divisionAbbrev : null
          });
        }

        // Get season metadata for historical standings
        const seasonsRes = await fetch('https://api-web.nhle.com/v1/standings-season');
        if (!seasonsRes.ok) throw new Error(`HTTP ${seasonsRes.status}`);
        const seasonsData = await seasonsRes.json();
        const seasons = Array.isArray(seasonsData?.seasons) ? seasonsData.seasons : [];
        
        // Get last 10 completed seasons for chart (excluding current if incomplete)
        const currentSeasonId = getCurrentSeasonId();
        const completedSeasons = seasons
          .filter((s: any) => s.id < currentSeasonId && s.standingsEnd)
          .sort((a: any, b: any) => b.id - a.id)
          .slice(0, 10);

        // Get last 5 seasons for averages
        const last5Seasons = completedSeasons.slice(0, 5);

        // Fetch standings for each completed season (10 years for chart)
        const results: Array<{ league: number | null; conf: number | null; div: number | null }> = [];
        const chartData: YearlyData[] = [];
        
        for (const season of completedSeasons) {
          try {
            const res = await fetch(`https://api-web.nhle.com/v1/standings/${season.standingsEnd}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const js = await res.json();
            const rows: StandingsRow[] = Array.isArray(js?.standings) ? js.standings : [];
            const mine = rows.find((r: any) => (r.teamAbbrev?.default ?? r.teamAbbrev ?? '').toUpperCase() === selectedTeam);
            
            const seasonData = {
              league: mine?.leagueSequence ?? null,
              conf: mine?.conferenceSequence ?? null,
              div: mine?.divisionSequence ?? null,
            };
            
            // Add to chart data
            const endYear = String(season.id).slice(-4);
            chartData.push({
              year: endYear,
              ...seasonData
            });
            
            // Add to averages (only first 5)
            if (results.length < 5) {
              results.push(seasonData);
            }
          } catch (e) {
            const nullData = { league: null, conf: null, div: null };
            const endYear = String(season.id).slice(-4);
            chartData.push({
              year: endYear,
              ...nullData
            });
            if (results.length < 5) {
              results.push(nullData);
            }
          }
        }

        // Sort chart data by year (oldest first)
        chartData.sort((a, b) => parseInt(a.year) - parseInt(b.year));
        if (!cancelled) setHistoricalData(chartData);

        const valid = (arr: Array<number | null>) => arr.filter((v): v is number => typeof v === 'number' && isFinite(v));
        const avg = (arr: Array<number | null>) => {
          const v = valid(arr);
          if (!v.length) return null;
          return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
        };

        const leagueAvg = avg(results.map(r => r.league));
        const confAvg = avg(results.map(r => r.conf));
        const divAvg = avg(results.map(r => r.div));
        if (!cancelled) setAvgRanks({ league: leagueAvg, conf: confAvg, div: divAvg });
      } catch (e: any) {
        if (!cancelled) setStandingsError(e?.message ?? 'Failed to load standings');
      } finally {
        if (!cancelled) setStandingsLoading(false);
      }
    }
    loadStandings();
    return () => { cancelled = true; };
  }, [selectedTeam, selectedAnalysis]);

  // Fetch team stats when stats analysis is selected
  useEffect(() => {
    if (!selectedTeam || selectedAnalysis !== 'stats') {
      setTeamStats(null);
      return;
    }

    let cancelled = false;
    async function loadTeamStats() {
      setTeamStatsLoading(true);
      setTeamStatsError(null);
      try {
        console.log(`Fetching stats for team: ${selectedTeam}`);
        
        // Calculate current and previous seasons dynamically
        const getCurrentSeason = () => {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth() + 1; // JavaScript months are 0-indexed
          
          // NHL season typically starts in October and ends in June
          // If it's July-September, we're in the off-season, so the last completed season ended in the spring
          // If it's October-June, we're in the current season
          if (month >= 7 && month <= 9) {
            // Off-season: last completed season
            return `${year - 1}${year}`;
          } else if (month >= 10) {
            // Current season started this year
            return `${year}${year + 1}`;
          } else {
            // Current season started last year
            return `${year - 1}${year}`;
          }
        };
        
        const getPreviousSeason = (currentSeason: string) => {
          const startYear = parseInt(currentSeason.substring(0, 4));
          return `${startYear - 1}${startYear}`;
        };
        
        const currentSeasonYear = getCurrentSeason();
        const previousSeasonYear = getPreviousSeason(currentSeasonYear);
        
        console.log(`Fetching stats for current season: ${currentSeasonYear}, previous season: ${previousSeasonYear}`);
        
        // Test all the available APIs to see what data we get
        const [currentStats, seasonOverview, currentSeason, scoreboard, lastSeason] = await Promise.allSettled([
          fetch(`https://api-web.nhle.com/v1/club-stats/${selectedTeam}/now`),
          fetch(`https://api-web.nhle.com/v1/club-stats-season/${selectedTeam}`),
          fetch(`https://api-web.nhle.com/v1/club-stats/${selectedTeam}/${currentSeasonYear}/2`), // Current season regular season
          fetch(`https://api-web.nhle.com/v1/scoreboard/${selectedTeam}/now`),
          fetch(`https://api-web.nhle.com/v1/club-stats/${selectedTeam}/${previousSeasonYear}/2`) // Last season for comparison
        ]);

        const results: any = {
          currentSeasonYear,
          previousSeasonYear
        };

        // Process current stats
        if (currentStats.status === 'fulfilled' && currentStats.value.ok) {
          const data = await currentStats.value.json();
          results.currentStats = data;
          console.log('Current Stats:', JSON.stringify(data, null, 2));
        }

        // Process season overview
        if (seasonOverview.status === 'fulfilled' && seasonOverview.value.ok) {
          const data = await seasonOverview.value.json();
          results.seasonOverview = data;
          console.log('Season Overview:', JSON.stringify(data, null, 2));
        }

        // Process current season stats
        if (currentSeason.status === 'fulfilled' && currentSeason.value.ok) {
          const data = await currentSeason.value.json();
          results.currentSeasonStats = data;
          console.log('Current Season Stats:', JSON.stringify(data, null, 2));
        }

        // Process scoreboard
        if (scoreboard.status === 'fulfilled' && scoreboard.value.ok) {
          const data = await scoreboard.value.json();
          results.scoreboard = data;
          console.log('Scoreboard:', JSON.stringify(data, null, 2));
        }

        // Process last season stats for comparison
        if (lastSeason.status === 'fulfilled' && lastSeason.value.ok) {
          const data = await lastSeason.value.json();
          results.lastSeasonStats = data;
          console.log('Last Season Stats:', JSON.stringify(data, null, 2));
        }

        if (!cancelled) setTeamStats(results);
      } catch (e: any) {
        console.error('Team stats error:', e);
        if (!cancelled) setTeamStatsError(e?.message ?? 'Failed to load team stats');
      } finally {
        if (!cancelled) setTeamStatsLoading(false);
      }
    }
    loadTeamStats();
    return () => { cancelled = true; };
  }, [selectedTeam, selectedAnalysis]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ alignSelf: 'stretch', width: '100%' }}
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Deep Dive</Text>
        </View>

        {/* Info Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showInfoModal}
          onRequestClose={() => setShowInfoModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>
                Team Analysis
              </Text>
              <Text style={styles.modalText}>
                Get deep down into the stats for a team you want to analyze. Try selecting a team you want to explore!
              </Text>
              <Pressable
                onPress={() => setShowInfoModal(false)}
                style={styles.modalButton}
              >
                <Text style={styles.modalButtonText}>
                  Got it
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={styles.subsection}>
              Team Analysis
          </Text>
          <Pressable 
            onPress={() => setShowInfoModal(true)}
            style={styles.infoIconButton}
          >
            <IconSymbol 
              name="info.circle" 
              size={20} 
              color="#9CA3AF" 
            />
          </Pressable>
        </View>

        {/* Team Selection Card */}
        <View style={[styles.card, { alignSelf: 'stretch', width: '100%' }]}>
          {/* Team Dropdown */}
          <View style={{ alignSelf: 'center' }}>
            {teamsError ? (
              <Text style={{ color: 'red', paddingBottom: 6 }}>{teamsError}</Text>
            ) : null}
            <Dropdown
              placeholder="Select a team"
              options={(teams ?? []).map((t) => ({ label: `${t.name} (${t.abbrev})`, value: t.abbrev }))}
              value={selectedTeam}
              onChange={handleTeamChange}
              disabled={!teams || teams.length === 0}
              loading={loadingTeams}
            />
          </View>
        </View>

        {/* Selected Team Info Card */}
        {selectedTeam && (
          <View style={[styles.card, { alignSelf: 'stretch', width: '100%', marginTop: 16 }]}>
            <Text style={styles.greeting}>
              Selected Team: <Text style={styles.nameAccent}>{selectedTeam}</Text>
            </Text>

            {/* Team Conference and Division Info */}
            <View style={styles.factboxrow}>
              <View style={styles.factboxTwo}>
                <Text style={styles.boxtitle}>
                  Conference
                </Text>
                <Text style={styles.boxvalue}>
                  {basicTeamLoading ? <ActivityIndicator size="small" color="#fff" /> : basicTeamInfo.conference || 'N/A'}
                </Text>
              </View>

              <View style={styles.factboxTwo}>
                <Text style={styles.boxtitle}>
                  Division
                </Text>
                <Text style={styles.boxvalue}>
                  {basicTeamLoading ? <ActivityIndicator size="small" color="#fff" /> : basicTeamInfo.division || 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Analysis Selection Card */}
        {selectedTeam && (
          <View style={[styles.card, { alignSelf: 'stretch', width: '100%', marginTop: 16 }]}>
            <Text style={[styles.greeting, { marginBottom: 12, textAlign: 'center', width: '100%' }]}>
              Choose Analysis Type
            </Text>
            <View style={{ alignSelf: 'center' }}>
              <Dropdown
                placeholder="Select analysis"
                options={analysisOptions}
                value={selectedAnalysis}
                onChange={(val) => setSelectedAnalysis(val)}
                disabled={false}
                loading={false}
                selectedTextStyle={{ fontWeight: '900', fontSize: 18, letterSpacing: 0.5 }}
              />
            </View>
          </View>
        )}

        {/* Analysis Content */}
        {selectedTeam && selectedAnalysis && (
          <View style={[styles.card, { marginTop: 16 }]}>
            {/* Render specific analysis based on selection */}
            {selectedAnalysis === 'standings' && (
              <StandingsAnalysis 
                currentRanks={currentRanks}
                avgRanks={avgRanks}
                currentTotals={currentTotals}
                historicalData={historicalData}
                standingsLoading={standingsLoading}
                styles={styles}
              />
            )}

            {selectedAnalysis === 'players' && (
              <PlayersAnalysis 
                selectedTeam={selectedTeam}
                styles={styles}
              />
            )}

            {selectedAnalysis === 'stats' && (
              <StatsAnalysis 
                selectedTeam={selectedTeam}
                teamStats={teamStats}
                teamStatsLoading={teamStatsLoading}
                teamStatsError={teamStatsError}
                styles={styles}
              />
            )}

          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Component functions for different analysis types
function StandingsAnalysis({ currentRanks, avgRanks, currentTotals, historicalData, standingsLoading, styles }: {
  currentRanks: RankSet;
  avgRanks: RankSet;
  currentTotals: TotalSet;
  historicalData: YearlyData[];
  standingsLoading: boolean;
  styles: any;
}) {
  // Calculate performance analytics
  const calculatePerformanceMetrics = () => {
    if (!currentRanks.league || !avgRanks.league) return null;
    
    const leagueImprovement = avgRanks.league - currentRanks.league;
    const confImprovement = (avgRanks.conf || 0) - (currentRanks.conf || 0);
    const divImprovement = (avgRanks.div || 0) - (currentRanks.div || 0);
    
    const leaguePercentile = parseFloat(((currentTotals.league - currentRanks.league + 1) / currentTotals.league * 100).toFixed(1));
    const confPercentile = parseFloat(((currentTotals.conf - (currentRanks.conf || 0) + 1) / currentTotals.conf * 100).toFixed(1));
    const divPercentile = parseFloat(((currentTotals.div - (currentRanks.div || 0) + 1) / currentTotals.div * 100).toFixed(1));
    
    const isPlayoffPosition = (currentRanks.conf || 0) <= 8;
    const playoffCushion = isPlayoffPosition ? 8 - (currentRanks.conf || 0) : (currentRanks.conf || 0) - 8;
    
    return {
      leagueImprovement,
      confImprovement,
      divImprovement,
      leaguePercentile,
      confPercentile,
      divPercentile,
      isPlayoffPosition,
      playoffCushion
    };
  };

  // Analyze trends from historical data
  const analyzeTrends = () => {
    if (historicalData.length < 3) return null;
    
    const recentYears = historicalData.slice(-3);
    const olderYears = historicalData.slice(0, historicalData.length - 3);
    
    const recentAvgLeague = recentYears.reduce((sum, year) => sum + (year.league || 32), 0) / recentYears.length;
    const olderAvgLeague = olderYears.reduce((sum, year) => sum + (year.league || 32), 0) / olderYears.length;
    
    const trendDirection = recentAvgLeague < olderAvgLeague ? 'improving' : recentAvgLeague > olderAvgLeague ? 'declining' : 'stable';
    const trendStrength = parseFloat(Math.abs(recentAvgLeague - olderAvgLeague).toFixed(2));
    
    // Calculate playoff appearances in last 5 years
    const playoffAppearances = historicalData.slice(-5).filter(year => (year.conf || 16) <= 8).length;
    const playoffPercentage = parseFloat((playoffAppearances / Math.min(5, historicalData.length) * 100).toFixed(0));
    
    // Find best and worst years
    const bestYear = historicalData.reduce((best, year) => 
      (year.league || 32) < (best.league || 32) ? year : best, historicalData[0]);
    const worstYear = historicalData.reduce((worst, year) => 
      (year.league || 0) > (worst.league || 0) ? year : worst, historicalData[0]);
    
    return {
      trendDirection,
      trendStrength,
      playoffAppearances,
      playoffPercentage,
      bestYear,
      worstYear,
      recentAvgLeague: parseFloat(recentAvgLeague.toFixed(2)),
      olderAvgLeague: parseFloat(olderAvgLeague.toFixed(2))
    };
  };

  // Generate predictions and insights
  const generateInsights = () => {
    const metrics = calculatePerformanceMetrics();
    const trends = analyzeTrends();
    
    if (!metrics || !trends) return null;
    
    const insights = [];
    
    // Historical Performance Context
    if (metrics.leagueImprovement > 8) {
      insights.push(`Exceptional season - performing ${metrics.leagueImprovement.toFixed(1)} positions better than their 5-year average. This represents a significant organizational improvement.`);
    } else if (metrics.leagueImprovement > 5) {
      insights.push(`Strong performance above expectations - outpacing their 5-year average by ${metrics.leagueImprovement.toFixed(1)} positions. This suggests effective roster moves or player development paying dividends.`);
    } else if (metrics.leagueImprovement > 2) {
      insights.push(`Modest improvement over recent history - ${metrics.leagueImprovement.toFixed(1)} positions better than their 5-year average. The team is trending in the right direction but may need additional moves to reach elite status.`);
    } else if (metrics.leagueImprovement < -8) {
      insights.push(`Concerning underperformance - sitting ${Math.abs(metrics.leagueImprovement).toFixed(1)} positions below their 5-year average. This significant decline may indicate roster issues, injuries, or systemic problems requiring immediate attention.`);
    } else if (metrics.leagueImprovement < -5) {
      insights.push(`Notable step back from recent form - performing ${Math.abs(metrics.leagueImprovement).toFixed(1)} positions worse than their 5-year average. Management may need to evaluate coaching decisions and roster construction.`);
    } else if (metrics.leagueImprovement < -2) {
      insights.push(`Slight regression from recent standards - ${Math.abs(metrics.leagueImprovement).toFixed(1)} positions below their 5-year average. While concerning, this could be within normal variance or due to temporary factors.`);
    } else {
      insights.push(`Consistent with recent performance - operating within 2 positions of their 5-year average. This indicates organizational stability and predictable competitive level.`);
    }
    
    // Conference Positioning and Playoff Analysis
    const confRank = currentRanks.conf || 16;
    const playoffSpots = 8;
    const wildCardSpots = 2;
    
    if (confRank <= 3) {
      insights.push(`Elite conference positioning at #${confRank} - virtually guaranteed playoff spot and likely home-ice advantage. Teams in this position historically make playoffs 98% of the time and often advance deep into postseason.`);
    } else if (confRank <= 6) {
      insights.push(`Strong playoff position at #${confRank} in conference - comfortably in playoff territory with ${playoffSpots - confRank + 1} spots of cushion. Teams in this range make playoffs 95% of the time.`);
    } else if (confRank <= 8) {
      const spotsFromWildCard = confRank - 6;
      insights.push(`On playoff bubble at #${confRank} - holding final wild-card spots but vulnerable. Only ${playoffSpots - confRank + 1} spots separate them from missing playoffs. Teams in this position have 75% playoff odds.`);
    } else if (confRank <= 10) {
      insights.push(`Outside playoffs but within striking distance - ${confRank - playoffSpots} spots back from wild-card. Teams this close at this point in season historically have 35% chance of making playoffs with strong finish.`);
    } else if (confRank <= 12) {
      insights.push(`Significant playoff deficit at #${confRank} - would need major turnaround and help from other teams. Teams in this position have less than 15% historical playoff probability.`);
    } else {
      insights.push(`Likely out of playoff contention at #${confRank} - focus should shift to development and draft positioning. Teams this low rarely recover to make playoffs.`);
    }
    
    // Trend Analysis and Trajectory
    if (trends.trendDirection === 'improving' && trends.trendStrength > 5) {
      insights.push(`Remarkable organizational transformation - improved by ${trends.trendStrength.toFixed(1)} positions over recent years. This trajectory suggests smart management decisions and strong player development. If maintained, expect continued playoff contention.`);
    } else if (trends.trendDirection === 'improving' && trends.trendStrength > 3) {
      insights.push(`Positive organizational momentum - steady ${trends.trendStrength.toFixed(1)} position improvement indicates good front office decisions. Team appears to be building sustainable success.`);
    } else if (trends.trendDirection === 'declining' && trends.trendStrength > 5) {
      insights.push(`Alarming organizational decline - dropped ${trends.trendStrength.toFixed(1)} positions in recent years. This suggests core players aging out, poor roster management, or systematic issues requiring major changes.`);
    } else if (trends.trendDirection === 'declining' && trends.trendStrength > 3) {
      insights.push(`Concerning downward trajectory - declined ${trends.trendStrength.toFixed(1)} positions recently. Management needs to address whether this is temporary regression or sign of deeper problems.`);
    } else if (trends.trendDirection === 'stable') {
      insights.push(`Organizational consistency - minimal variance in recent performance suggests stable management and roster. However, may indicate lack of ambition to reach next competitive level.`);
    }
    
    // Playoff Consistency and Reliability
    if (trends.playoffPercentage >= 80) {
      insights.push(`Championship-caliber consistency - making playoffs ${trends.playoffPercentage}% of recent seasons (${trends.playoffAppearances}/${Math.min(5, historicalData.length)}). This level of sustained excellence typically indicates elite management, coaching, and player development systems.`);
    } else if (trends.playoffPercentage >= 60) {
      insights.push(`Reliable playoff contender - ${trends.playoffPercentage}% playoff rate shows consistent competitiveness but suggests room for improvement to reach elite tier. May need key additions or development of young players.`);
    } else if (trends.playoffPercentage >= 40) {
      insights.push(`Inconsistent competitiveness - ${trends.playoffPercentage}% playoff rate indicates boom-or-bust cycles. Team may lack depth or have volatile performance year-to-year, suggesting need for roster stability.`);
    } else if (trends.playoffPercentage >= 20) {
      insights.push(`Struggling organization - only ${trends.playoffPercentage}% playoff rate suggests systemic issues with roster construction, development, or management. Significant changes likely needed for sustained improvement.`);
    } else {
      insights.push(`Major organizational concerns - ${trends.playoffPercentage}% playoff rate indicates fundamental problems. Complete roster overhaul and management evaluation may be necessary for competitive turnaround.`);
    }
    
    return insights;
  };

  const metrics = calculatePerformanceMetrics();
  const trends = analyzeTrends();
  const insights = generateInsights();

  const getTrendIcon = (improvement: number) => {
    if (improvement > 3) return { icon: '↗', color: '#10b981' };
    if (improvement < -3) return { icon: '↘', color: '#ef4444' };
    return { icon: '→', color: '#9CA3AF' };
  };

  const getPerformanceRating = (percentile: number) => {
    if (percentile >= 80) return { rating: 'Elite', color: '#10b981' };
    if (percentile >= 60) return { rating: 'Strong', color: '#3b82f6' };
    if (percentile >= 40) return { rating: 'Average', color: '#f59e0b' };
    return { rating: 'Poor', color: '#ef4444' };
  };

  // Format insights with simple styling for readability
  const renderFormattedInsight = (insight: string) => {
    // Simple regex patterns to identify and style content
    const styledText = insight
      // Bold numbers and percentages
      .replace(/(\d+\.?\d*%|\d+\.?\d* positions?|\d+\.?\d* spots?)/g, '**$1**')
      // Bold rankings
      .replace(/(#\d+)/g, '**$1**')
      // Mark positive words for green styling
      .replace(/(exceptional|elite|excellent|strong|championship|playoff position|significantly outperforming|remarkable|positive momentum)/gi, '++$1++')
      // Mark negative words for red styling
      .replace(/(concerning|poor|alarming|declined|underperforming|deficit|struggling|problems)/gi, '--$1--');
    
    // Split by markers and render with appropriate styles
    const parts = styledText.split(/(\*\*[^*]+\*\*|\+\+[^+]+\+\+|--[^-]+--)/);
    
    return (
      <Text
        style={[
          styles.subtextLarge,
          {
            color: styles.greeting.color,
            lineHeight: 22,
            textAlign: 'left',
          },
        ]}
        allowFontScaling={false}
      >
        {parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            // Bold numbers/rankings
            const text = part.slice(2, -2);
            return (
              <Text key={index} style={{ fontWeight: '700', color: '#60a5fa', lineHeight: 22 }} allowFontScaling={false}>
                {text}
              </Text>
            );
          } else if (part.startsWith('++') && part.endsWith('++')) {
            // Positive words - green and bold
            const text = part.slice(2, -2);
            return (
              <Text key={index} style={{ fontWeight: '700', color: '#10b981', lineHeight: 22 }} allowFontScaling={false}>
                {text}
              </Text>
            );
          } else if (part.startsWith('--') && part.endsWith('--')) {
            // Negative words - red and bold
            const text = part.slice(2, -2);
            return (
              <Text key={index} style={{ fontWeight: '700', color: '#ef4444', lineHeight: 22 }} allowFontScaling={false}>
                {text}
              </Text>
            );
          } else {
            // Regular text
            return (
              <Text key={index} style={{ color: styles.greeting.color, lineHeight: 22 }} allowFontScaling={false}>
                {part}
              </Text>
            );
          }
        })}
      </Text>
    );
  };

  return (
    <>
      {/* Current Standings */}
      <View>
        <Text style={styles.greeting}>Current Standings</Text>
      </View>

      <View style={styles.factboxrow}>
        <View style={styles.factboxThree}>
          <Text style={styles.boxtitle}>League</Text>
          <Text style={styles.boxvalue}>
            {standingsLoading ? <ActivityIndicator size="small" color="#fff" /> : currentRanks.league ? `${currentRanks.league} / ${currentTotals.league}` : 'N/A'}
          </Text>
          {metrics && (
            <Text style={[styles.subtextSmall, { color: getTrendIcon(metrics.leagueImprovement).color }]}>
              {getTrendIcon(metrics.leagueImprovement).icon} {Math.abs(metrics.leagueImprovement).toFixed(2)} vs avg
            </Text>
          )}
        </View>

        <View style={styles.factboxThree}>
          <Text style={styles.boxtitle}>Conference</Text>
          <Text style={styles.boxvalue}>
            {standingsLoading ? <ActivityIndicator size="small" color="#fff" /> : currentRanks.conf ? `${currentRanks.conf} / ${currentTotals.conf}` : 'N/A'}
          </Text>
          {metrics && (
            <Text style={[styles.subtextSmall, { color: getTrendIcon(metrics.confImprovement).color }]}>
              {getTrendIcon(metrics.confImprovement).icon} {Math.abs(metrics.confImprovement).toFixed(2)} vs avg
            </Text>
          )}
        </View>

        <View style={styles.factboxThree}>
          <Text style={styles.boxtitle}>Division</Text>
          <Text style={styles.boxvalue}>
            {standingsLoading ? <ActivityIndicator size="small" color="#fff" /> : currentRanks.div ? `${currentRanks.div} / ${currentTotals.div}` : 'N/A'}
          </Text>
          {metrics && (
            <Text style={[styles.subtextSmall, { color: getTrendIcon(metrics.divImprovement).color }]}>
              {getTrendIcon(metrics.divImprovement).icon} {Math.abs(metrics.divImprovement).toFixed(2)} vs avg
            </Text>
          )}
        </View>
      </View>

      {/* Performance Metrics */}
      {metrics && (
        <>
          <View style={{margin: 10}}>
            <Text style={styles.greeting}>Performance Metrics</Text>
          </View>
          
          <View style={styles.factboxrow}>
            <View style={styles.factboxThree}>
              <Text style={[styles.boxtitle, { textAlign: 'center' }]}>League Percentile</Text>
              <Text style={[styles.boxvalue, { color: getPerformanceRating(metrics.leaguePercentile).color, textAlign: 'center' }]}>
                {metrics.leaguePercentile}%
              </Text>
              <Text style={[styles.subtextSmall, { textAlign: 'center' }]}>
                {getPerformanceRating(metrics.leaguePercentile).rating}
              </Text>
            </View>

            <View style={styles.factboxThree}>
              <Text style={[styles.boxtitle, { textAlign: 'center' }]}>Playoff Status</Text>
              <Text style={[styles.boxvalue, { color: metrics.isPlayoffPosition ? '#10b981' : '#ef4444', textAlign: 'center' }]}>
                {metrics.isPlayoffPosition ? 'IN' : 'OUT'}
              </Text>
              <Text style={[styles.subtextSmall, { textAlign: 'center' }]}>
                {metrics.isPlayoffPosition ? `+${metrics.playoffCushion} cushion` : `-${metrics.playoffCushion} to playoff`}
              </Text>
            </View>

            <View style={styles.factboxThree}>
              <Text style={[styles.boxtitle, { textAlign: 'center' }]}>Conf Percentile</Text>
              <Text style={[styles.boxvalue, { color: getPerformanceRating(metrics.confPercentile).color, textAlign: 'center' }]}>
                {metrics.confPercentile}%
              </Text>
              <Text style={[styles.subtextSmall, { textAlign: 'center' }]}>
                {getPerformanceRating(metrics.confPercentile).rating}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Historical Context */}
      {trends && (
        <>
          <View style={{margin: 10}}>
            <Text style={styles.greeting}>Historical Context</Text>
          </View>
          
          <View style={styles.factboxrow}>
            <View style={styles.factboxTwo}>
              <Text style={styles.boxtitle}>Playoff History (5yr)</Text>
              <Text style={[styles.boxvalue, { 
                color: trends.playoffPercentage >= 60 ? '#10b981' : 
                       trends.playoffPercentage >= 40 ? '#f59e0b' : '#ef4444' 
              }]}>
                {trends.playoffPercentage}%
              </Text>
              <Text style={styles.subtextSmall}>
                {trends.playoffAppearances}/{Math.min(5, historicalData.length)} appearances
              </Text>
            </View>

            <View style={styles.factboxTwo}>
              <Text style={styles.boxtitle}>Recent Trend</Text>
              <Text style={[styles.boxvalue, { 
                color: trends.trendDirection === 'improving' ? '#10b981' : 
                       trends.trendDirection === 'declining' ? '#ef4444' : '#9CA3AF' 
              }]}>
                {trends.trendDirection === 'improving' ? '↗' : trends.trendDirection === 'declining' ? '↘' : '→'}
              </Text>
              <Text style={styles.subtextSmall}>
                {trends.trendDirection === 'stable' ? 'Consistent' : 
                 `${trends.trendStrength.toFixed(1)} spots ${trends.trendDirection.replace('ing', 'ed')}`}
              </Text>
            </View>
          </View>

          {trends.bestYear && trends.worstYear && (
            <View style={styles.factboxrow}>
              <View style={styles.factboxTwo}>
                <Text style={styles.boxtitle}>Best Season</Text>
                <Text style={[styles.boxvalue, { color: '#10b981' }]}>
                  {trends.bestYear.year}
                </Text>
                <Text style={styles.subtextSmall}>
                  #{trends.bestYear.league} overall
                </Text>
              </View>

              <View style={styles.factboxTwo}>
                <Text style={styles.boxtitle}>Worst Season</Text>
                <Text style={[styles.boxvalue, { color: '#ef4444' }]}>
                  {trends.worstYear.year}
                </Text>
                <Text style={styles.subtextSmall}>
                  #{trends.worstYear.league} overall
                </Text>
              </View>
            </View>
          )}
        </>
      )}

      {/* Historical Trends Chart */}
      {historicalData.length > 0 && (
        <View>
          <View style={{margin: 10}}>
            <Text style={styles.greeting}>10-Year Standings Trends</Text>
          </View>

          <View style={{ marginTop: 16, alignItems: 'center', width: '100%' }}>
            <LineChart
              data={{
                labels: historicalData.map(d => `${String(d.year).slice(-2)}'`),
                datasets: [
                  {
                    data: historicalData.map(d => d.league || 32),
                    color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`,
                    strokeWidth: 2,
                  },
                  {
                    data: historicalData.map(d => d.conf || 16),
                    color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`,
                    strokeWidth: 2,
                  },
                  {
                    data: historicalData.map(d => d.div || 8),
                    color: (opacity = 1) => `rgba(75, 192, 192, ${opacity})`,
                    strokeWidth: 2,
                  },
                  {
                    data: historicalData.map(() => 8),
                    color: () => 'rgba(54, 162, 235, 0.8)',
                    strokeWidth: 3,
                    strokeDashArray: [5, 5],
                    withDots: false,
                  },
                  {
                    data: [1, 32],
                    color: () => 'transparent',
                    strokeWidth: 0,
                    withDots: false,
                  },
                ],
              }}
              width={Dimensions.get('window').width - 40}
              height={220}
              yAxisInterval={4}
              segments={8}
              fromZero={false}
              yAxisLabel=""
              yAxisSuffix=""
              yLabelsOffset={10}
              chartConfig={{
                backgroundColor: 'rgba(0,0,0,0)',
                backgroundGradientFrom: 'rgba(0,0,0,0)',
                backgroundGradientTo: 'rgba(0,0,0,0)',
                backgroundGradientFromOpacity: 0,
                backgroundGradientToOpacity: 0,
                fillShadowGradient: 'rgba(0,0,0,0)',
                fillShadowGradientOpacity: 0,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(230, 238, 248, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(230, 238, 248, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: { r: '4', strokeWidth: '2' },
              }}
              withShadow={false}
              bezier
              style={{
                marginVertical: 8,
                borderRadius: 16,
                marginLeft: -35,
              }}
            />
            
            {/* Chart Legend */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 4 }}>
                <View style={{ width: 12, height: 12, backgroundColor: 'rgba(255, 99, 132, 1)', marginRight: 4, borderRadius: 2 }}></View>
                <Text style={[styles.boxtitle, { fontSize: 12 }]}>League</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 4 }}>
                <View style={{ width: 12, height: 12, backgroundColor: 'rgba(54, 162, 235, 1)', marginRight: 4, borderRadius: 2 }}></View>
                <Text style={[styles.boxtitle, { fontSize: 12 }]}>Conference</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 4 }}>
                <View style={{ width: 12, height: 12, backgroundColor: 'rgba(75, 192, 192, 1)', marginRight: 4, borderRadius: 2 }}></View>
                <Text style={[styles.boxtitle, { fontSize: 12 }]}>Division</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <View style={{ width: 12, height: 2, backgroundColor: 'rgba(54, 162, 235, 1)', marginRight: 4, borderRadius: 1 }}></View>
                <Text style={[styles.boxtitle, { fontSize: 12 }]}>Playoff Cut</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      <View style={styles.spacer}>
      </View>


      {/* Insights and Predictions */}
      {insights && insights.length > 0 && (
        <>
          <View style={{marginTop: 10}}>
            <Text style={styles.greeting}>Key Insights & Predictions</Text>
          </View>
          
          {insights.map((insight, index) => (
            <View key={index} style={styles.factboxOne}>
              {renderFormattedInsight(insight)}
            </View>
          ))}
        </>
      )}
    </>
  );
}

function PlayersAnalysis({ selectedTeam, styles }: { selectedTeam: string; styles: any }) {
  return (
    <View>
      <Text style={styles.greeting}>Player Performance Analysis</Text>
      <Text style={styles.subtext}>Coming soon - Top scorers, goalie stats, player trends for {selectedTeam}</Text>
    </View>
  );
}

function StatsAnalysis({ selectedTeam, teamStats, teamStatsLoading, teamStatsError, styles }: { 
  selectedTeam: string; 
  teamStats: any; 
  teamStatsLoading: boolean; 
  teamStatsError: string | null; 
  styles: any; 
}) {
  if (teamStatsLoading) {
    return (
      <View style={{ alignItems: 'center', padding: 20 }}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.subtext}>Loading team statistics...</Text>
      </View>
    );
  }

  if (teamStatsError) {
    return (
      <View>
        <Text style={styles.greeting}>Team Statistics</Text>
        <Text style={[styles.subtext, { color: 'red' }]}>Error: {teamStatsError}</Text>
      </View>
    );
  }

  if (!teamStats?.currentStats) {
    return (
      <View>
        <Text style={styles.greeting}>Team Statistics</Text>
        <Text style={styles.subtext}>No statistics available for {selectedTeam}</Text>
      </View>
    );
  }

  const { skaters, goalies } = teamStats.currentStats;
  const lastSeasonData = teamStats.lastSeasonStats;
  const currentSeasonYear = teamStats.currentSeasonYear;
  const previousSeasonYear = teamStats.previousSeasonYear;
  
  // Calculate team totals
  const teamTotals = skaters.reduce((acc: any, player: any) => ({
    goals: acc.goals + player.goals,
    assists: acc.assists + player.assists,
    points: acc.points + player.points,
    shots: acc.shots + player.shots,
    penaltyMinutes: acc.penaltyMinutes + player.penaltyMinutes,
    powerPlayGoals: acc.powerPlayGoals + player.powerPlayGoals,
    shorthandedGoals: acc.shorthandedGoals + player.shorthandedGoals,
    gamesPlayed: Math.max(acc.gamesPlayed, player.gamesPlayed)
  }), { goals: 0, assists: 0, points: 0, shots: 0, penaltyMinutes: 0, powerPlayGoals: 0, shorthandedGoals: 0, gamesPlayed: 0 });

  // Calculate goalie totals
  const goalieTotals = goalies.reduce((acc: any, goalie: any) => ({
    wins: acc.wins + goalie.wins,
    losses: acc.losses + goalie.losses,
    overtimeLosses: acc.overtimeLosses + goalie.overtimeLosses,
    saves: acc.saves + goalie.saves,
    goalsAgainst: acc.goalsAgainst + goalie.goalsAgainst,
    shotsAgainst: acc.shotsAgainst + goalie.shotsAgainst,
    shutouts: acc.shutouts + goalie.shutouts,
  }), { wins: 0, losses: 0, overtimeLosses: 0, saves: 0, goalsAgainst: 0, shotsAgainst: 0, shutouts: 0 });

  const totalGames = goalieTotals.wins + goalieTotals.losses + goalieTotals.overtimeLosses;
  const savePercentage = goalieTotals.shotsAgainst > 0 ? (goalieTotals.saves / goalieTotals.shotsAgainst * 100).toFixed(1) : '0.0';
  const shootingPercentage = teamTotals.shots > 0 ? (teamTotals.goals / teamTotals.shots * 100).toFixed(1) : '0.0';

  // Calculate last season totals for comparison
  let lastSeasonTotals = null;
  let lastSeasonGoalieTotals = null;
  if (lastSeasonData?.skaters && lastSeasonData?.goalies) {
    lastSeasonTotals = lastSeasonData.skaters.reduce((acc: any, player: any) => ({
      goals: acc.goals + player.goals,
      assists: acc.assists + player.assists,
      points: acc.points + player.points,
      shots: acc.shots + player.shots,
      gamesPlayed: Math.max(acc.gamesPlayed, player.gamesPlayed)
    }), { goals: 0, assists: 0, points: 0, shots: 0, gamesPlayed: 0 });

    lastSeasonGoalieTotals = lastSeasonData.goalies.reduce((acc: any, goalie: any) => ({
      wins: acc.wins + goalie.wins,
      losses: acc.losses + goalie.losses,
      overtimeLosses: acc.overtimeLosses + goalie.overtimeLosses,
      saves: acc.saves + goalie.saves,
      goalsAgainst: acc.goalsAgainst + goalie.goalsAgainst,
      shotsAgainst: acc.shotsAgainst + goalie.shotsAgainst,
    }), { wins: 0, losses: 0, overtimeLosses: 0, saves: 0, goalsAgainst: 0, shotsAgainst: 0 });
  }

  // Performance Analysis Functions
  const calculateWinPercentage = (wins: number, losses: number, otl: number) => {
    const totalGames = wins + losses + otl;
    return totalGames > 0 ? ((wins + otl * 0.5) / totalGames * 100).toFixed(1) : '0.0';
  };

  const getPerformanceTrend = (current: number, previous: number) => {
    if (!previous) return 'neutral';
    const change = ((current - previous) / previous) * 100;
    if (change > 5) return 'improving';
    if (change < -5) return 'declining';
    return 'stable';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '↗';
      case 'declining': return '↘';
      default: return '→';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return '#4ade80';
      case 'declining': return '#f87171';
      default: return '#9CA3AF';
    }
  };

  // Performance metrics
  const currentWinPct = parseFloat(calculateWinPercentage(goalieTotals.wins, goalieTotals.losses, goalieTotals.overtimeLosses));
  const lastSeasonWinPct = lastSeasonGoalieTotals ? parseFloat(calculateWinPercentage(lastSeasonGoalieTotals.wins, lastSeasonGoalieTotals.losses, lastSeasonGoalieTotals.overtimeLosses)) : null;
  
  const goalsPerGame = teamTotals.gamesPlayed > 0 ? (teamTotals.goals / teamTotals.gamesPlayed).toFixed(2) : '0.00';
  const goalsAgainstPerGame = totalGames > 0 ? (goalieTotals.goalsAgainst / totalGames).toFixed(2) : '0.00';
  
  const lastSeasonGoalsPerGame = lastSeasonTotals?.gamesPlayed > 0 ? (lastSeasonTotals.goals / lastSeasonTotals.gamesPlayed).toFixed(2) : null;
  const lastSeasonGoalsAgainstPerGame = lastSeasonGoalieTotals && (lastSeasonGoalieTotals.wins + lastSeasonGoalieTotals.losses + lastSeasonGoalieTotals.overtimeLosses) > 0 ? 
    (lastSeasonGoalieTotals.goalsAgainst / (lastSeasonGoalieTotals.wins + lastSeasonGoalieTotals.losses + lastSeasonGoalieTotals.overtimeLosses)).toFixed(2) : null;

  // Trend analysis
  const winPctTrend = lastSeasonWinPct ? getPerformanceTrend(currentWinPct, lastSeasonWinPct) : 'neutral';
  const offenseTrend = lastSeasonGoalsPerGame ? getPerformanceTrend(parseFloat(goalsPerGame), parseFloat(lastSeasonGoalsPerGame)) : 'neutral';
  const defenseTrend = lastSeasonGoalsAgainstPerGame ? getPerformanceTrend(parseFloat(lastSeasonGoalsAgainstPerGame), parseFloat(goalsAgainstPerGame)) : 'neutral'; // Note: inverted for defense

  // Predictions and insights
  const predictedWins = totalGames > 0 ? Math.round((goalieTotals.wins / totalGames) * 82) : 0;
  const predictedPoints = Math.round(predictedWins * 2 + (goalieTotals.overtimeLosses / totalGames) * 82);

  // Performance categories
  const getPerformanceRating = (winPct: number) => {
    if (winPct >= 65) return { rating: 'Elite', color: '#10b981' };
    if (winPct >= 55) return { rating: 'Strong', color: '#3b82f6' };
    if (winPct >= 45) return { rating: 'Average', color: '#f59e0b' };
    return { rating: 'Struggling', color: '#ef4444' };
  };

  const performanceRating = getPerformanceRating(currentWinPct);

  // Top performers
  const topScorer = skaters.reduce((top: any, player: any) => 
    player.points > top.points ? player : top, skaters[0] || {});
  const topGoalScorer = skaters.reduce((top: any, player: any) => 
    player.goals > top.goals ? player : top, skaters[0] || {});
  const topGoalie = goalies.reduce((top: any, goalie: any) => 
    goalie.wins > top.wins ? goalie : top, goalies[0] || {});

  return (
    <View>
      <Text style={styles.greeting}>Team Statistics - {selectedTeam}</Text>
      <Text style={[styles.subtext, { textAlign: 'center', marginBottom: 10, fontSize: 12 }]}>
        {currentSeasonYear ? `${currentSeasonYear.substring(0,4)}-${currentSeasonYear.substring(4)} Season` : 'Current Season'}
        {previousSeasonYear && ` vs ${previousSeasonYear.substring(0,4)}-${previousSeasonYear.substring(4)}`}
      </Text>
      
      {/* Performance Overview */}
      <View style={{margin: 10}}>
        <Text style={styles.greeting}>Performance Overview</Text>
      </View>
      
      <View style={styles.factboxrow}>
        <View style={[styles.factboxTwo, { borderLeftWidth: 4, borderLeftColor: performanceRating.color }]}>
          <Text style={styles.boxtitle}>Overall Rating</Text>
          <Text style={[styles.boxvalue, { color: performanceRating.color }]}>{performanceRating.rating}</Text>
          <Text style={[styles.subtext, { fontSize: 12, textAlign: 'center' }]}>
            {currentWinPct}% win rate
          </Text>
        </View>
        <View style={styles.factboxTwo}>
          <Text style={styles.boxtitle}>Predicted Record</Text>
          <Text style={styles.boxvalue}>{predictedWins}-{82-predictedWins}</Text>
          <Text style={[styles.subtext, { fontSize: 12, textAlign: 'center' }]}>
            {predictedPoints} points
          </Text>
        </View>
      </View>

      {/* Trend Analysis */}
      {lastSeasonTotals && (
        <>
          <View style={{margin: 10}}>
            <Text style={styles.greeting}>Year-over-Year Trends</Text>
          </View>
          
          <View style={styles.factboxrow}>
            <View style={styles.factboxThree}>
              <Text style={[styles.boxtitle, { fontSize: 24, textAlign: 'center', marginBottom: 5 }]}>{getTrendIcon(winPctTrend)}</Text>
              <Text style={styles.boxtitle}>Win Rate</Text>
              <Text style={[styles.boxvalue, { color: getTrendColor(winPctTrend) }]}>
                {currentWinPct}%
              </Text>
              <Text style={styles.subtextSmall}>
                vs {lastSeasonWinPct}% in {previousSeasonYear ? `${previousSeasonYear.substring(0,4)}-${previousSeasonYear.substring(4)}` : 'last season'}
              </Text>
            </View>
            <View style={styles.factboxThree}>
              <Text style={[styles.boxtitle, { fontSize: 24, textAlign: 'center', marginBottom: 5 }]}>{getTrendIcon(offenseTrend)}</Text>
              <Text style={styles.boxtitle}>Goals/Game</Text>
              <Text style={[styles.boxvalue, { color: getTrendColor(offenseTrend) }]}>
                {goalsPerGame}
              </Text>
              <Text style={styles.subtextSmall}>
                vs {lastSeasonGoalsPerGame} in {previousSeasonYear ? `${previousSeasonYear.substring(0,4)}-${previousSeasonYear.substring(4)}` : 'last season'}
              </Text>
            </View>
            <View style={styles.factboxThree}>
              <Text style={[styles.boxtitle, { fontSize: 24, textAlign: 'center', marginBottom: 5 }]}>{getTrendIcon(defenseTrend)}</Text>
              <Text style={styles.boxtitle}>GA/Game</Text>
              <Text style={[styles.boxvalue, { color: getTrendColor(defenseTrend) }]}>
                {goalsAgainstPerGame}
              </Text>
              <Text style={styles.subtextSmall}>
                vs {lastSeasonGoalsAgainstPerGame} in {previousSeasonYear ? `${previousSeasonYear.substring(0,4)}-${previousSeasonYear.substring(4)}` : 'last season'}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Team Record with Visual Progress */}
      <View style={{margin: 10}}>
        <Text style={styles.greeting}>Team Record</Text>
      </View>
      
      <View style={styles.factboxrow}>
        <View style={styles.factboxThree}>
          <Text style={styles.boxtitle}>Wins</Text>
          <Text style={styles.boxvalue}>{goalieTotals.wins}</Text>
        </View>
        <View style={styles.factboxThree}>
          <Text style={styles.boxtitle}>Losses</Text>
          <Text style={styles.boxvalue}>{goalieTotals.losses}</Text>
        </View>
        <View style={styles.factboxThree}>
          <Text style={styles.boxtitle}>OT Losses</Text>
          <Text style={styles.boxvalue}>{goalieTotals.overtimeLosses}</Text>
        </View>
      </View>

      {/* Offensive Stats with Efficiency Metrics */}
      <View style={{margin: 10}}>
        <Text style={styles.greeting}>Offensive Performance</Text>
      </View>
      
      <View style={styles.factboxrow}>
        <View style={styles.factboxThree}>
          <Text style={styles.boxtitle}>Goals/Game</Text>
          <Text style={styles.boxvalue}>{goalsPerGame}</Text>
        </View>
        <View style={styles.factboxThree}>
          <Text style={styles.boxtitle}>Shooting %</Text>
          <Text style={styles.boxvalue}>{shootingPercentage}%</Text>
        </View>
        <View style={styles.factboxThree}>
          <Text style={styles.boxtitle}>PP Goals</Text>
          <Text style={styles.boxvalue}>{teamTotals.powerPlayGoals}</Text>
        </View>
      </View>

      {/* Defensive Stats with Efficiency Metrics */}
      <View style={{margin: 10}}>
        <Text style={styles.greeting}>Defensive Performance</Text>
      </View>
      
      <View style={styles.factboxrow}>
        <View style={styles.factboxThree}>
          <Text style={styles.boxtitle}>GA/Game</Text>
          <Text style={styles.boxvalue}>{goalsAgainstPerGame}</Text>
        </View>
        <View style={styles.factboxThree}>
          <Text style={styles.boxtitle}>Save %</Text>
          <Text style={styles.boxvalue}>{savePercentage}%</Text>
        </View>
        <View style={styles.factboxThree}>
          <Text style={styles.boxtitle}>Shutouts</Text>
          <Text style={styles.boxvalue}>{goalieTotals.shutouts}</Text>
        </View>
      </View>

      {/* Key Insights */}
      <View style={{marginTop: 10}}>
        <Text style={styles.greeting}>Key Insights & Predictions</Text>
      </View>
      
      <View style={styles.factboxOne}>
        <Text style={[styles.subtextLarge, { color: styles.greeting.color }]}>
          <Text style={{ fontWeight: 'bold' }}>Performance Analysis:</Text> {selectedTeam} is currently performing at a{' '}
          <Text style={{ color: performanceRating.color, fontWeight: 'bold' }}>{performanceRating.rating.toLowerCase()}</Text> level with a{' '}
          {currentWinPct}% point percentage.
          {winPctTrend !== 'neutral' && (
            <Text> The team is <Text style={{ color: getTrendColor(winPctTrend), fontWeight: 'bold' }}>
              {winPctTrend === 'improving' ? 'improving' : 'declining'}
            </Text> compared to {previousSeasonYear ? `${previousSeasonYear.substring(0,4)}-${previousSeasonYear.substring(4)}` : 'last season'}.</Text>
          )}
        </Text>
      </View>

      <View style={styles.factboxOne}>
        <Text style={[styles.subtextLarge, { color: styles.greeting.color }]}>
          <Text style={{ fontWeight: 'bold' }}>Season Projection:</Text> Based on current performance, {selectedTeam} is on pace for{' '}
          <Text style={{ fontWeight: 'bold' }}>{predictedWins} wins and {predictedPoints} points</Text>.
          {predictedPoints >= 100 && <Text style={{ color: '#10b981' }}> This puts them in strong playoff contention.</Text>}
          {predictedPoints < 90 && <Text style={{ color: '#ef4444' }}> They may struggle to make the playoffs.</Text>}
        </Text>
      </View>

      {/* Top Performers */}
      <View style={{margin: 10}}>
        <Text style={styles.greeting}>Top Performers</Text>
      </View>

      {topScorer && (
        <View style={styles.factboxrow}>
          <View style={styles.factboxTwo}>
            <Text style={styles.boxtitle}>Leading Scorer</Text>
            <Text style={styles.boxvalue}>
              {topScorer.firstName?.default} {topScorer.lastName?.default}
            </Text>
            <Text style={styles.subtextCentered}>
              {topScorer.points} pts ({topScorer.goals}G, {topScorer.assists}A)
            </Text>
          </View>
          <View style={styles.factboxTwo}>
            <Text style={styles.boxtitle}>Top Goalie</Text>
            <Text style={styles.boxvalue}>
              {topGoalie.firstName?.default} {topGoalie.lastName?.default}
            </Text>
            <Text style={styles.subtextCentered}>
              {topGoalie.wins}-{topGoalie.losses}-{topGoalie.overtimeLosses}, {(topGoalie.savePercentage * 100).toFixed(1)}%
            </Text>
          </View>
        </View>
      )}

    </View>
  );
}

function ScheduleAnalysis({ selectedTeam, styles }: { selectedTeam: string; styles: any }) {
  return (
    <View>
      <Text style={styles.greeting}>Schedule Analysis</Text>
      <Text style={styles.subtext}>Coming soon - Upcoming games, strength of schedule, travel analysis for {selectedTeam}</Text>
    </View>
  );
}

function DraftAnalysis({ selectedTeam, styles }: { selectedTeam: string; styles: any }) {
  return (
    <View>
      <Text style={styles.greeting}>Draft History</Text>
      <Text style={styles.subtext}>Coming soon - Draft picks, prospect pipeline, draft success rate for {selectedTeam}</Text>
    </View>
  );
}
