import React, { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Platform, StyleSheet, Pressable, ScrollView, ActivityIndicator, Modal, Animated, Dimensions } from 'react-native';
import { View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedView } from '@/components/ThemedView'; 
import { LinearGradient } from 'expo-linear-gradient';
import { makeStyles } from '@/constants/theme';
import Dropdown, { type Option } from '@/components/Dropdown';

const name = 'Zach'
const now = new Date();

// Preload local top images (must use static requires for Metro bundler)
const TOP_IMAGES = [
  require('../../assets/images/topimages/image1.jpg'),
  require('../../assets/images/topimages/image2.jpg'),
  require('../../assets/images/topimages/image3.jpg'),
  require('../../assets/images/topimages/image4.jpg'),
  require('../../assets/images/topimages/image5.jpg'),
  require('../../assets/images/topimages/image6.jpg'),
  require('../../assets/images/topimages/image7.jpg'),
  require('../../assets/images/topimages/image8.jpg'),
] as const;

// Styles now come from the shared theme module

export default function HomeScreen() {
  const styles = makeStyles();

  // Pick a random top image on initial mount (app open)
  const topImage = React.useMemo(() => {
    const i = Math.floor(Math.random() * TOP_IMAGES.length);
    return TOP_IMAGES[i];
  }, []);

  

  // Countdown to Sep 20th 4:00 PM PT (Pacific Time). On Sep 20, PT is UTC-7.
  const targetDate = React.useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    // 16:00 PT = 23:00 UTC (UTC-7) on Sep 20
    const targetUtc = Date.UTC(year, 8, 20, 23, 0, 0, 0);
    return new Date(targetUtc);
  }, []);

  const [msLeft, setMsLeft] = React.useState<number | null>(null);

  // Subtle pulse animation to draw attention
  const pulse = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (msLeft == null) return; // stop anim when hidden
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [msLeft, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });

  useEffect(() => {
    const update = () => {
      const diff = targetDate.getTime() - Date.now();
      setMsLeft(diff > 0 ? diff : null);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const fmtCountdown = React.useMemo(() => {
    if (msLeft == null) return null;
    const totalSec = Math.floor(msLeft / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }, [msLeft]);

  // Types (shared with Explore)
  type Team = {
    id: string;
    name: string;
    abbrev: string;
  };

  type Game = {
    id: string;
    home: string;
    away: string;
  homeAbbrev?: string;
  awayAbbrev?: string;
    start: string;    // ISO timestamp from API
    status: string;
    venue?: string;
  };

  const [schedule, setSchedule] = useState<Game[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Teams state for dropdown
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null); // abbrev

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

  useEffect(() => {
    let mounted = true;

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD

    async function fetchSchedule() {
      try {
        const url = `https://api-web.nhle.com/v1/schedule/${dateStr}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        // NHL schedule shape: { dates: [ { date: 'YYYY-MM-DD', games: [ ... ] } ] }
        const gamesRaw = Array.isArray(json?.dates) && json.dates[0]?.games ? json.dates[0].games : [];

        const parsed: Game[] = gamesRaw.map((g: any) => ({
          id: String(g.gamePk ?? g.gamePk ?? Math.random()),
          home: g.teams?.home?.team?.name ?? g.teams?.home?.team?.shortName ?? 'Home',
          away: g.teams?.away?.team?.name ?? g.teams?.away?.team?.shortName ?? 'Away',
          homeAbbrev: g.teams?.home?.team?.abbrev ?? g.teams?.home?.team?.triCode ?? g.teams?.home?.team?.teamAbbrev,
          awayAbbrev: g.teams?.away?.team?.abbrev ?? g.teams?.away?.team?.triCode ?? g.teams?.away?.team?.teamAbbrev,
          start: g.gameDate ?? g.scheduleDate ?? '',
          status: g.status?.detailedState ?? g.status?.abstractGameState ?? '',
          venue: g.venue?.name ?? undefined,
        }));

        if (mounted) setSchedule(parsed);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'Failed to load schedule');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchSchedule();
    return () => { mounted = false; };
  }, []);

  // Load teams (same as Explore, with exclusions)
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
    return () => { mounted = false; };
  }, []);

  // Load NHL data from tested endpoints
  useEffect(() => {
    let mounted = true;
    async function loadNHLData() {
      setLoadingLeagueData(true);
      try {
        // Fetch multiple endpoints in parallel
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        const [gamesRes, standingsRes, skatersRes, goaliesRes, spotlightRes] = await Promise.allSettled([
          fetch(`https://api-web.nhle.com/v1/score/${todayStr}`), // Use actual today's date
          fetch('https://api-web.nhle.com/v1/standings/now'),
          fetch('https://api-web.nhle.com/v1/skater-stats-leaders/current?categories=points,goals,assists&limit=5'),
          fetch('https://api-web.nhle.com/v1/goalie-stats-leaders/current?categories=wins&limit=3'),
          fetch('https://api-web.nhle.com/v1/player-spotlight')
        ]);

        // Process today's games
        if (gamesRes.status === 'fulfilled' && gamesRes.value.ok) {
          const gamesData = await gamesRes.value.json();
          if (mounted) setTodaysGames(gamesData);
        }

        // Process current standings
        if (standingsRes.status === 'fulfilled' && standingsRes.value.ok) {
          const standingsData = await standingsRes.value.json();
          if (mounted) setCurrentStandings(standingsData);
        }

        // Process stat leaders
        if (skatersRes.status === 'fulfilled' && skatersRes.value.ok && goaliesRes.status === 'fulfilled' && goaliesRes.value.ok) {
          const skatersData = await skatersRes.value.json();
          const goaliesData = await goaliesRes.value.json();
          if (mounted) {
            setStatLeaders({
              skaters: skatersData,
              goalies: goaliesData
            });
          }
        }

        // Process player spotlight
        if (spotlightRes.status === 'fulfilled' && spotlightRes.value.ok) {
          const spotlightData = await spotlightRes.value.json();
          if (mounted) setPlayerSpotlight(spotlightData);
        }

      } catch (e) {
        console.warn('Failed to load NHL data:', e);
      } finally {
        if (mounted) setLoadingLeagueData(false);
      }
    }
    
    loadNHLData();
    return () => { mounted = false; };
  }, []);

  // Upcoming schedule for the selected team (current + next month if needed)
  const [monthSchedule, setMonthSchedule] = useState<any[] | null>(null);
  const [loadingMonthSchedule, setLoadingMonthSchedule] = useState(false);
  const [monthScheduleError, setMonthScheduleError] = useState<string | null>(null);

  // League overview data - using tested endpoints
  const [todaysGames, setTodaysGames] = useState<any>(null);
  const [statLeaders, setStatLeaders] = useState<any>(null);
  const [currentStandings, setCurrentStandings] = useState<any>(null);
  const [playerSpotlight, setPlayerSpotlight] = useState<any>(null);
  const [loadingLeagueData, setLoadingLeagueData] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!selectedTeam) {
      setMonthSchedule(null);
      setMonthScheduleError(null);
      setLoadingMonthSchedule(false);
      return () => { mounted = false; };
    }

    async function loadUpcomingGames() {
      setLoadingMonthSchedule(true);
      setMonthScheduleError(null);
      try {
        const now = new Date();
        const teamCode = (selectedTeam ?? '').toUpperCase();
        
        // Helper function to fetch and parse games for a given month
        async function fetchMonthGames(year: number, month: number) {
          const monthStr = `${year}-${String(month).padStart(2, '0')}`;
          const url = `https://api-web.nhle.com/v1/club-schedule/${teamCode}/month/${monthStr}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${monthStr}`);
          const json = await res.json();
          
          const gamesRaw: any[] = Array.isArray(json?.games) ? json.games : [];
          return gamesRaw.map((g: any) => {
            const id = String(g.id ?? Math.random());
            const date = g.gameDate ?? '';
            const start = g.startTimeUTC ?? g.gameDate ?? '';
            
            const homeTeam = g.homeTeam ?? {};
            const awayTeam = g.awayTeam ?? {};
            
            const home = `${homeTeam.placeName?.default ?? ''} ${homeTeam.commonName?.default ?? ''}`.trim() || 'Home';
            const away = `${awayTeam.placeName?.default ?? ''} ${awayTeam.commonName?.default ?? ''}`.trim() || 'Away';
            const homeAbbrev = (homeTeam.abbrev ?? '').toUpperCase();
            const awayAbbrev = (awayTeam.abbrev ?? '').toUpperCase();
            
            const status = g.gameState ?? g.gameScheduleState ?? '';
            
            return { id, date, start, home, away, homeAbbrev, awayAbbrev, status };
          });
        }

        let allUpcomingGames: any[] = [];
        let currentYear = now.getFullYear();
        let currentMonth = now.getMonth() + 1; // JS months are 0-indexed
        let monthsChecked = 0;
        const maxMonthsToCheck = 6; // Don't check more than 6 months ahead

        // Keep fetching months until we have 10 games or hit the limit
        while (allUpcomingGames.length < 10 && monthsChecked < maxMonthsToCheck) {
          try {
            const monthGames = await fetchMonthGames(currentYear, currentMonth);
            
            // Filter to upcoming games only for the current month
            const upcomingGames = monthsChecked === 0 
              ? monthGames.filter(g => {
                  if (!g.start) return false;
                  const gameDate = new Date(g.start);
                  return gameDate >= now;
                })
              : monthGames; // For future months, all games are upcoming
            
            // Sort games by date and add to our collection
            const sortedGames = upcomingGames.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
            allUpcomingGames = [...allUpcomingGames, ...sortedGames];
            
          } catch (e) {
            console.warn(`Failed to fetch ${currentYear}-${String(currentMonth).padStart(2,'0')}:`, e);
          }
          
          // Move to next month
          monthsChecked++;
          currentMonth++;
          if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
          }
        }

        // Take first 10 games and sort them chronologically
        const finalGames = allUpcomingGames
          .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
          .slice(0, 10);

        if (mounted) setMonthSchedule(finalGames);
      } catch (e: any) {
        if (mounted) setMonthScheduleError(e?.message ?? 'Failed to load upcoming games');
      } finally {
        if (mounted) setLoadingMonthSchedule(false);
      }
    }

    loadUpcomingGames();
    return () => { mounted = false; };
  }, [selectedTeam]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={{ alignSelf: 'stretch', width: '100%' }}
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>PuckIQ</Text>
          <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 8, fontSize: 16 }]}>
            Your Complete NHL Analytics Hub
          </Text>
          {fmtCountdown && (
            <View style={[styles.countdownBox, { marginTop: 16 }]}> 
              <LinearGradient
                colors={['#60a5fa', '#7c3aed', '#f43f5e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 16, paddingHorizontal: 16 }}
              >
                <Text style={styles.countdownLabel}>Countdown to Preseason</Text>
                <Text style={styles.countdownTimer}>{fmtCountdown}</Text>
              </LinearGradient>
            </View>
          )}
          <Image
            source={topImage}
            style={styles.mainpic}
            contentFit="cover"
            accessibilityLabel="NHL action shot"
          />
        </View>

        {/* League Overview */}
        <Text style={[styles.subsection, { alignSelf: 'stretch', textAlign: 'center', marginTop: 20, marginBottom: 8 }]}>League Overview</Text>
        
        {loadingLeagueData ? (
          <View style={[styles.card, { alignItems: 'center', padding: 30 }]}>
            <ActivityIndicator size="large" color="#60a5fa" />
            <Text style={[styles.subtext, { marginTop: 12 }]}>Loading league data...</Text>
          </View>
        ) : (
          <>
            {/* NHL Overview Stats */}
            <View style={styles.factboxrow}>
              <View style={styles.factboxThree}>
                <Text style={styles.boxtitle}>Teams</Text>
                <Text style={styles.boxvalue}>
                  {currentStandings?.standings?.length || 32}
                </Text>
                <Text style={styles.subtextSmall}>Active NHL Teams</Text>
              </View>

              <View style={styles.factboxThree}>
                <Text style={styles.boxtitle}>Today's Games</Text>
                <Text style={styles.boxvalue}>
                  {todaysGames?.games?.length || 0}
                </Text>
                <Text style={styles.subtextSmall}>
                  {(todaysGames?.games?.length || 0) === 0 ? 'Off-Season' : 'Scheduled'}
                </Text>
              </View>

              <View style={styles.factboxThree}>
                <Text style={styles.boxtitle}>Season</Text>
                <Text style={styles.boxvalue}>
                  2025-26
                </Text>
                <Text style={styles.subtextSmall}>Starts Oct 7</Text>
              </View>
            </View>

            {/* Stat Leaders */}
            {statLeaders && (
              <>
                <Text style={[styles.subsection, { alignSelf: 'stretch', textAlign: 'center', marginTop: 20, marginBottom: 8 }]}>2024-25 Season Leaders</Text>
                <View style={styles.factboxrow}>
                  <View style={styles.factboxTwo}>
                    <Text style={styles.boxtitle}>Points Leader</Text>
                    <Text style={styles.boxvalue}>
                      {statLeaders.skaters?.points?.[0]?.firstName?.default || statLeaders.skaters?.points?.[0]?.firstName} {statLeaders.skaters?.points?.[0]?.lastName?.default || statLeaders.skaters?.points?.[0]?.lastName}
                    </Text>
                    <Text style={styles.subtextSmall}>
                      {statLeaders.skaters?.points?.[0]?.value} Points (2024-25)
                    </Text>
                  </View>

                  <View style={styles.factboxTwo}>
                    <Text style={styles.boxtitle}>Goals Leader</Text>
                    <Text style={styles.boxvalue}>
                      {statLeaders.skaters?.goals?.[0]?.firstName?.default || statLeaders.skaters?.goals?.[0]?.firstName} {statLeaders.skaters?.goals?.[0]?.lastName?.default || statLeaders.skaters?.goals?.[0]?.lastName}
                    </Text>
                    <Text style={styles.subtextSmall}>
                      {statLeaders.skaters?.goals?.[0]?.value} Goals (2024-25)
                    </Text>
                  </View>
                </View>

                <View style={styles.factboxrow}>
                  <View style={styles.factboxTwo}>
                    <Text style={styles.boxtitle}>Assists Leader</Text>
                    <Text style={styles.boxvalue}>
                      {statLeaders.skaters?.assists?.[0]?.firstName?.default || statLeaders.skaters?.assists?.[0]?.firstName} {statLeaders.skaters?.assists?.[0]?.lastName?.default || statLeaders.skaters?.assists?.[0]?.lastName}
                    </Text>
                    <Text style={styles.subtextSmall}>{statLeaders.skaters?.assists?.[0]?.value} Assists (2024-25)</Text>
                  </View>

                  <View style={styles.factboxTwo}>
                    <Text style={styles.boxtitle}>Best Record</Text>
                    <Text style={styles.boxvalue}>
                      {currentStandings?.standings?.[0]?.teamAbbrev?.default || 'WPG'}
                    </Text>
                    <Text style={styles.subtextSmall}>{currentStandings?.standings?.[0]?.points || 116} Points</Text>
                  </View>
                </View>
              </>
            )}
          </>
        )}

        {/* Today's Games Section */}
        <View style={{ width: '100%', alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
          <Text style={[styles.greeting, { fontSize: 24, fontWeight: '700', marginBottom: 0 }]}>Today's Games</Text>
        </View>

        {/* Team Filter Card */}
        <View style={[styles.card, { width: '100%', alignSelf: 'stretch' }]}>
          <View style={{ alignSelf: 'flex-start' }}>
            {teamsError ? (
              <Text style={{ color: 'red', paddingBottom: 6 }}>{teamsError}</Text>
            ) : null}
            <Text style={[styles.greeting, { alignSelf: 'flex-start' }]}>Follow Your Team</Text>
            <Dropdown
              placeholder="Select a team to track"
              options={[
                { label: 'All Teams', value: null },
                ...((teams ?? []).map((t) => ({ label: `${t.name} (${t.abbrev})`, value: t.abbrev })))
              ]}
              value={selectedTeam}
              onChange={handleTeamChange}
              disabled={!teams || teams.length === 0}
              loading={loadingTeams}
              selectedTextStyle={{ fontWeight: '900', fontSize: 18, letterSpacing: 0.5 }}
            />
          </View>
        </View>

        {/* Today's Schedule Card - Enhanced */}
        <View style={[styles.card, { width: '100%', alignSelf: 'stretch' }]}>
          <Text style={[styles.greeting, { alignSelf: 'flex-start', marginBottom: 8 }]}>
            {selectedTeam ? `${selectedTeam} Schedule Today` : 'Today\'s Schedule'}
          </Text>

          {/* API data section */}
          <View style={{ marginTop: 0, width: '100%' }}>
            {loading && <ActivityIndicator size="small" color="#fff" />}
            {error && <Text style={{ color: 'red', marginTop: 8 }}>{error}</Text>}
            
            {!loading && !error && schedule && schedule.length === 0 && (
              <View style={{ width: '100%' }}>
                {/* Off-season message with context */}
                <View style={{ backgroundColor: styles.factbox.backgroundColor, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                  <Text style={[styles.boxtitle, { marginBottom: 8, textAlign: 'center' }]}>
                    🏒 NHL Off-Season
                  </Text>
                  <Text style={[styles.subtextSmall, { lineHeight: 16, textAlign: 'center' }]}>
                    No games scheduled today. The 2025-26 season begins October 7th with exciting matchups!
                  </Text>
                </View>
                
                {selectedTeam && (
                  <Text style={[styles.subtextSmall, { textAlign: 'center', fontStyle: 'italic', opacity: 0.8 }]}>
                    Check the upcoming games section below for {selectedTeam}'s season schedule.
                  </Text>
                )}
              </View>
            )}
            
            {!loading && schedule && schedule.length > 0 && (schedule
              .filter((g) => {
                if (!selectedTeam) return true;
                const matchAbbrev = (g.homeAbbrev && g.homeAbbrev.toUpperCase() === selectedTeam) || (g.awayAbbrev && g.awayAbbrev.toUpperCase() === selectedTeam);
                if (matchAbbrev) return true;
                // Fallback: compare names if abbrev missing
                const selName = teams?.find((t) => t.abbrev === selectedTeam)?.name?.toUpperCase();
                if (!selName) return true;
                return g.home.toUpperCase() === selName || g.away.toUpperCase() === selName;
              })
            ).map((g) => {
              const localTime = g.start ? new Date(g.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD';
              const gameDate = g.start ? new Date(g.start).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Today';
              
              // Convert game status to user-friendly text
              let statusText = 'Scheduled';
              if (g.status === 'FUT') statusText = 'Upcoming';
              else if (g.status === 'LIVE') statusText = 'Live Now';
              else if (g.status === 'FINAL') statusText = 'Final';
              else if (g.status === 'PPD') statusText = 'Postponed';
              else if (g.status === 'CRIT') statusText = 'Critical Moments';
              else if (g.status) statusText = g.status;
              
              return (
                <View
                  key={g.id}
                  style={{
                    backgroundColor: styles.factbox.backgroundColor,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    width: '100%'
                  }}
                >
                  <View style={{ alignItems: 'center', marginBottom: 8 }}>
                    <Text style={[styles.boxtitle, { textAlign: 'center' }]}>
                      {g.away} @ {g.home}
                    </Text>
                    <Text style={[styles.subtextSmall, { color: styles.nameAccent.color, marginTop: 4 }]}>{localTime}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    {g.venue ? (
                      <Text style={[styles.subtextSmall, { textAlign: 'center' }]}>{g.venue}</Text>
                    ) : (
                      <Text style={[styles.subtextSmall, { textAlign: 'center' }]}>{gameDate}</Text>
                    )}
                    <Text style={[styles.subtextSmall, { opacity: 0.8, marginTop: 2, textAlign: 'center' }]}>{statusText} • Regular Season</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Upcoming Games Card - Enhanced */}
        <View style={[styles.card, { width: '100%', alignSelf: 'stretch' }]}>
          <Text style={[styles.greeting, { alignSelf: 'flex-start', marginBottom: 8 }]}>
            {selectedTeam ? `Upcoming ${selectedTeam} Games` : 'Season Preview'}
          </Text>
          
          {/* Off-season context */}
          {!selectedTeam && (
            <Text style={[styles.subtext, { marginBottom: 12, lineHeight: 18 }]}>
              The 2025-26 NHL season begins October 7th with exciting matchups across the league.
            </Text>
          )}
          
          <View style={{ marginTop: 4, width: '100%' }}>
            {monthScheduleError ? <Text style={{ color: 'red' }}>{monthScheduleError}</Text> : null}
            {loadingMonthSchedule && <ActivityIndicator size="small" color="#fff" />}
            
            {/* Show upcoming season games if no team selected or if selected team has no games */}
            {!selectedTeam && !loadingMonthSchedule && (
              <View style={{ width: '100%' }}>
                <Text style={[styles.greeting, { fontSize: 16, marginBottom: 12, color: styles.nameAccent.color }]}>
                  Season Opener Games - October 7th
                </Text>
                
                {/* Season opener games preview - Enhanced */}
                <View style={styles.factboxOne}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={[styles.boxtitle, { fontSize: 16, fontWeight: '700' }]}>Chicago @ Florida</Text>
                    <Text style={[styles.subtextSmall, { color: styles.nameAccent.color, fontSize: 12, fontWeight: '600' }]}>5:00 PM ET</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.subtextSmall, { fontSize: 11 }]}>Amerant Bank Arena</Text>
                    <Text style={[styles.subtextSmall, { fontSize: 11, opacity: 0.8 }]}>ESPN • Oct 7</Text>
                  </View>
                </View>
                
                <View style={styles.factboxOne}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={[styles.boxtitle, { fontSize: 16, fontWeight: '700' }]}>Pittsburgh @ NY Rangers</Text>
                    <Text style={[styles.subtextSmall, { color: styles.nameAccent.color, fontSize: 12, fontWeight: '600' }]}>7:00 PM ET</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.subtextSmall, { fontSize: 11 }]}>Madison Square Garden</Text>
                    <Text style={[styles.subtextSmall, { fontSize: 11, opacity: 0.8 }]}>TNT • Oct 7</Text>
                  </View>
                </View>
                
                <View style={styles.factboxOne}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={[styles.boxtitle, { fontSize: 16, fontWeight: '700' }]}>Colorado @ Los Angeles</Text>
                    <Text style={[styles.subtextSmall, { color: styles.nameAccent.color, fontSize: 12, fontWeight: '600' }]}>10:30 PM ET</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.subtextSmall, { fontSize: 11 }]}>Crypto.com Arena</Text>
                    <Text style={[styles.subtextSmall, { fontSize: 11, opacity: 0.8 }]}>Local TV • Oct 7</Text>
                  </View>
                </View>
                
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.subtextSmall, { textAlign: 'center', fontStyle: 'italic', opacity: 0.8 }]}>
                    Select a team above to see their complete schedule
                  </Text>
                </View>
              </View>
            )}
            
            {/* Team-specific upcoming games */}
            {selectedTeam && !loadingMonthSchedule && monthSchedule && monthSchedule.length === 0 && (
              <View style={{ width: '100%' }}>
                <Text style={{ color: styles.lead.color, textAlign: 'center', marginBottom: 16 }}>
                  No upcoming games found for {selectedTeam} during the off-season.
                </Text>
                <Text style={[styles.subtextSmall, { textAlign: 'center', fontStyle: 'italic' }]}>
                  Check back when the 2025-26 season begins in October!
                </Text>
              </View>
            )}
            
            {selectedTeam && monthSchedule && monthSchedule.length > 0 && (
              <View style={{ width: '100%' }}>
                {monthSchedule.slice(0, 4).map((g: any) => {
                  const gameDate = g.date ? new Date(g.date) : (g.start ? new Date(g.start) : new Date());
                  const dateStr = gameDate.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });
                  const timeStr = g.start ? new Date(g.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD';
                  const sel = (selectedTeam ?? '').toUpperCase();
                  const homeAbbrev = (g.homeAbbrev ?? '').toUpperCase();
                  const isHome = homeAbbrev ? homeAbbrev === sel : (g.home ?? '').toUpperCase().includes(sel);
                  const opponentName = isHome ? (g.away ?? '') : (g.home ?? '');
                  const opponentAbbrev = isHome ? (g.awayAbbrev ?? '') : (g.homeAbbrev ?? '');
                  const opponentDisplay = opponentAbbrev ? opponentAbbrev : opponentName || 'TBD';
                  const venue = g.venue || (isHome ? `${selectedTeam} Home` : `${opponentDisplay} Home`);
                  
                  // Convert game status to user-friendly text
                  let statusText = 'Scheduled';
                  if (g.status === 'FUT') statusText = 'Upcoming';
                  else if (g.status === 'LIVE') statusText = 'Live';
                  else if (g.status === 'FINAL') statusText = 'Final';
                  else if (g.status === 'PPD') statusText = 'Postponed';
                  else if (g.status) statusText = g.status;
                  
                  return (
                    <View key={g.id} style={styles.factboxOne}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={[styles.boxtitle, { fontSize: 16, fontWeight: '700' }]}>
                          {isHome ? 'vs' : '@'} {opponentDisplay}
                        </Text>
                        <Text style={[styles.subtextSmall, { color: styles.nameAccent.color, fontSize: 12, fontWeight: '600' }]}>{timeStr}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={[styles.subtextSmall, { fontSize: 11 }]}>{venue}</Text>
                        <Text style={[styles.subtextSmall, { fontSize: 11, opacity: 0.8 }]}>{statusText} • {dateStr}</Text>
                      </View>
                    </View>
                  );
                })}
                {monthSchedule.length > 4 && (
                  <Text style={[styles.subtextSmall, { textAlign: 'center', marginTop: 8, fontStyle: 'italic', opacity: 0.8 }]}>
                    Showing next 4 games
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Call to Action - Enhanced */}
        <View style={[styles.card, { width: '100%', alignSelf: 'stretch', marginTop: 20 }]}>
          <Text style={[styles.greeting, { textAlign: 'center', marginBottom: 12 }]}>
            Ready to Explore?
          </Text>
          <Text style={[styles.subtextLarge, { textAlign: 'center', lineHeight: 20, marginBottom: 16 }]}>
            Head to the <Text style={styles.nameAccent}>Deep Dive</Text> tab to analyze your favorite team.
          </Text>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

