import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, useColorScheme, Modal, Pressable, Dimensions } from 'react-native';
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
  const scheme = useColorScheme() || 'light';
  const styles = makeStyles(scheme as 'light' | 'dark');
  
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Teams state
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null); // abbrev

  // Standings state
  const [currentRanks, setCurrentRanks] = useState<RankSet>({ league: null, conf: null, div: null });
  const [avgRanks, setAvgRanks] = useState<RankSet>({ league: null, conf: null, div: null });
  const [currentTotals, setCurrentTotals] = useState<TotalSet>({ league: 32, conf: 16, div: 8 });
  const [teamInfo, setTeamInfo] = useState<TeamInfo>({ conference: null, division: null });
  const [historicalData, setHistoricalData] = useState<YearlyData[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [standingsError, setStandingsError] = useState<string | null>(null);

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

  // Fetch standings for now and historical averages
  useEffect(() => {
    if (!selectedTeam) {
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
  }, [selectedTeam]);

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
              color={scheme === 'dark' ? '#9CA3AF' : '#6B7280'} 
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
              scheme={scheme as 'dark'}
            />
          </View>
        </View>

        {/* Team Information and Analytics */}
        {selectedTeam && (
          <View style={[styles.card, { marginTop: 16 }]}>
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
                  {standingsLoading ? '...' : teamInfo.conference || 'N/A'}
                </Text>
              </View>

              <View style={styles.factboxTwo}>
                <Text style={styles.boxtitle}>
                  Division
                </Text>
                <Text style={styles.boxvalue}>
                  {standingsLoading ? '...' : teamInfo.division || 'N/A'}
                </Text>
              </View>
            </View>

            <View>
                <Text style={styles.greeting}>
                    Current Standings
                </Text>
            </View>

            {/* Factboxes Row - Current Standings */}
            <View style={styles.factboxrow}>
              
              {/* First factbox */}
              <View style={styles.factboxThree}>
                <Text style={styles.boxtitle}>
                    League
                </Text>
                <Text style={styles.boxvalue}>
                  {standingsLoading ? '...' : currentRanks.league ? `${currentRanks.league} / ${currentTotals.league}` : 'N/A'}
                </Text>
              </View>

              {/* Second factbox */}
              <View style={styles.factboxThree}>
                <Text style={styles.boxtitle}>
                    Conference
                </Text>
                <Text style={styles.boxvalue}>
                  {standingsLoading ? '...' : currentRanks.conf ? `${currentRanks.conf} / ${currentTotals.conf}` : 'N/A'}
                </Text>
              </View>

              {/* Third factbox */}
              <View style={styles.factboxThree}>
                <Text style={styles.boxtitle}>
                    Division
                </Text>
                <Text style={styles.boxvalue}>
                  {standingsLoading ? '...' : currentRanks.div ? `${currentRanks.div} / ${currentTotals.div}` : 'N/A'}
                </Text>
              </View>

            </View>

            {/* Small Spacer */}
            <View style={{margin: 5}}>
            </View>

            <View>
                <Text style={styles.greeting}>
                    Average Standings (Last 5 Years)
                </Text>
            </View>

            {/* Factboxes Row - Averages */}
            <View style={styles.factboxrow}>
              
              {/* First factbox */}
              <View style={styles.factboxThree}>
                <Text style={styles.boxtitle}>
                    League
                </Text>
                <Text style={styles.boxvalue}>
                  {standingsLoading ? '...' : avgRanks.league ? `${avgRanks.league} / ${currentTotals.league}` : 'N/A'}
                </Text>
              </View>

              {/* Second factbox */}
              <View style={styles.factboxThree}>
                <Text style={styles.boxtitle}>
                    Conference
                </Text>
                <Text style={styles.boxvalue}>
                  {standingsLoading ? '...' : avgRanks.conf ? `${avgRanks.conf} / ${currentTotals.conf}` : 'N/A'}
                </Text>
              </View>

              {/* Third factbox */}
              <View style={styles.factboxThree}>
                <Text style={styles.boxtitle}>
                    Division
                </Text>
                <Text style={styles.boxvalue}>
                  {standingsLoading ? '...' : avgRanks.div ? `${avgRanks.div} / ${currentTotals.div}` : 'N/A'}
                </Text>
              </View>

            </View>

            {/* Historical Trends Chart */}
            {historicalData.length > 0 && (
              <View>
                <View style={{margin: 10}}>
                </View>
                
                <View>
                  <Text style={styles.greeting}>
                    10-Year Standings Trends
                  </Text>
                </View>

                <View style={{ marginTop: 16, alignItems: 'center', width: '100%' }}>
                  <LineChart
                    data={{
                      labels: historicalData.map(d => `${String(d.year).slice(-2)}'`),
                      datasets: [
                        {
                          data: historicalData.map(d => d.league || 32),
                          color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`, // Red for league
                          strokeWidth: 2,
                        },
                        {
                          data: historicalData.map(d => d.conf || 16),
                          color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`, // Blue for conference
                          strokeWidth: 2,
                        },
                        {
                          data: historicalData.map(d => d.div || 8),
                          color: (opacity = 1) => `rgba(75, 192, 192, ${opacity})`, // Green for division
                          strokeWidth: 2,
                        },
                        {
                          data: historicalData.map(() => 8), // Playoff cutoff line at conference rank 8
                          color: () => 'rgba(54, 162, 235, 0.8)', // Blue conference color
                          strokeWidth: 3,
                          strokeDashArray: [5, 5], // Dotted line
                          withDots: false, // No dots on this line
                        },
                      ],
                    }}
                    width={Dimensions.get('window').width - 40}
                    height={220}
                    yAxisInterval={1}
                    chartConfig={{
                      backgroundColor: 'rgba(0,0,0,0)',
                      backgroundGradientFrom: 'rgba(0,0,0,0)',
                      backgroundGradientTo: 'rgba(0,0,0,0)',
                      backgroundGradientFromOpacity: 0,
                      backgroundGradientToOpacity: 0,
                      fillShadowGradient: 'rgba(0,0,0,0)',
                      fillShadowGradientOpacity: 0,
                      decimalPlaces: 0,
                      color: (opacity = 1) => (scheme === 'dark' ? `rgba(230, 238, 248, ${opacity})` : `rgba(15, 23, 42, ${opacity})`),
                      labelColor: (opacity = 1) => (scheme === 'dark' ? `rgba(230, 238, 248, ${opacity})` : `rgba(15, 23, 42, ${opacity})`),
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

          </View>
        )}
      </ScrollView>
    </View>
  );
}
