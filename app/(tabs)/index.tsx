import React, { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Platform, StyleSheet, useColorScheme, Pressable, ScrollView, ActivityIndicator, Modal, Animated } from 'react-native';
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
  const scheme = useColorScheme() || 'light';
  const styles = makeStyles(scheme);

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

  // Upcoming schedule for the selected team (current + next month if needed)
  const [monthSchedule, setMonthSchedule] = useState<any[] | null>(null);
  const [loadingMonthSchedule, setLoadingMonthSchedule] = useState(false);
  const [monthScheduleError, setMonthScheduleError] = useState<string | null>(null);

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
          {fmtCountdown && (
            <View style={[styles.countdownBox, { marginTop: 10 }]}> 
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
            accessibilityLabel="User avatar"
          />
        </View>

        <Text style={styles.subsection}>
          Games
        </Text>

        {/* Team Filter Card */}
        <View style={[styles.card, { width: '100%', alignSelf: 'stretch' }]}>
          <View style={{ alignSelf: 'flex-start' }}>
            {teamsError ? (
              <Text style={{ color: 'red', paddingBottom: 6 }}>{teamsError}</Text>
            ) : null}
            <Text style={[styles.greeting, { alignSelf: 'flex-start' }]}>Team</Text>
            <Dropdown
              placeholder="Filter by team (optional)"
              options={[
                { label: 'Choose a Team', value: null },
                ...((teams ?? []).map((t) => ({ label: `${t.name} (${t.abbrev})`, value: t.abbrev })))
              ]}
              value={selectedTeam}
              onChange={handleTeamChange}
              disabled={!teams || teams.length === 0}
              loading={loadingTeams}
              scheme={scheme as 'light' | 'dark'}
            />
          </View>
        </View>

        {/* Today's Schedule Card */}
        <View style={[styles.card, { width: '100%', alignSelf: 'stretch' }]}>
          <Text style={[styles.greeting, { alignSelf: 'flex-start', marginBottom: 4 }]}>Schedule for Today</Text>

          {/* API data section */}
          <View style={{ marginTop: 0, width: '100%' }}>
            {loading && <ActivityIndicator size="small" color={scheme === 'dark' ? '#fff' : '#000'} />}
            {error && <Text style={{ color: 'red', marginTop: 8 }}>{error}</Text>}
            {!loading && !error && schedule && schedule.length === 0 && (
              <Text style={{ color: styles.lead.color, marginTop: 8 }}>No games scheduled for today.</Text>
            )}
            {!loading && schedule && (schedule
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
              const localTime = g.start ? new Date(g.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              return (
                <View
                  key={g.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    width: '100%',
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: scheme === 'dark' ? '#081726' : '#f1f5f9',
                  }}
                >
                  <View>
                    <Text style={{ color: styles.greeting.color }}>{g.away} @ {g.home}</Text>
                    {g.venue ? <Text style={{ color: styles.lead.color, fontSize: 12 }}>{g.venue}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: styles.nameAccent.color }}>{localTime}</Text>
                    <Text style={{ color: styles.subtitle.color, fontSize: 12 }}>{g.status}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Upcoming Games Card */}
        <View style={[styles.card, { width: '100%', alignSelf: 'stretch' }]}>
          <Text style={[styles.greeting, { alignSelf: 'flex-start', marginBottom: 6 }]}>Upcoming Games</Text>
          <View style={{ marginTop: 4, width: '100%' }}>
            {monthScheduleError ? <Text style={{ color: 'red' }}>{monthScheduleError}</Text> : null}
            {loadingMonthSchedule && <ActivityIndicator size="small" color={scheme === 'dark' ? '#fff' : '#000'} />}
            {!selectedTeam && <Text style={{ color: styles.lead.color }}>Select a team to view upcoming games.</Text>}
            {selectedTeam && !loadingMonthSchedule && monthSchedule && monthSchedule.length === 0 && (
              <Text style={{ color: styles.lead.color }}>No upcoming games found.</Text>
            )}
            {selectedTeam && monthSchedule && monthSchedule.length > 0 && (
              <View style={{ width: '100%' }}>
                {monthSchedule.map((g: any) => {
                  const dateStr = g.date ? new Date(g.date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : (g.start ? new Date(g.start).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'TBD');
                  const timeStr = g.start ? new Date(g.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                  const sel = (selectedTeam ?? '').toUpperCase();
                  const homeAbbrev = (g.homeAbbrev ?? '').toUpperCase();
                  // Determine if the selected team is home; fall back to name comparison if abbrev missing
                  const isHome = homeAbbrev ? homeAbbrev === sel : (g.home ?? '').toUpperCase().includes(sel);
                  const opponentName = isHome ? (g.away ?? '') : (g.home ?? '');
                  const opponentAbbrev = isHome ? (g.awayAbbrev ?? '') : (g.homeAbbrev ?? '');
                  const opponentDisplay = opponentAbbrev ? opponentAbbrev : opponentName || 'TBD';
                  return (
                    <View key={g.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: scheme === 'dark' ? '#081726' : '#f1f5f9' }}>
                      <View>
                        <Text style={{ color: styles.greeting.color }}>{dateStr} • {isHome ? 'vs' : '@'} {opponentDisplay}</Text>
                        <Text style={{ color: styles.lead.color, fontSize: 12 }}>{g.status}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: styles.nameAccent.color }}>{timeStr}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

