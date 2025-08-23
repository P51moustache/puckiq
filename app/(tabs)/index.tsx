import React, { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Platform, StyleSheet, useColorScheme, Pressable, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { View, Text } from 'react-native';
import { ThemedView } from '@/components/ThemedView'; 

const name = 'Zach'
const now = new Date();

const themes = {
  light: {
    background: '#f6f8fb',
    card: '#ffffff',
    text: '#0f172a',
    subtext: '#64748b',
    accent: '#2563eb',
    subtle: '#e6eefb',
  },
  dark: {
    background: '#071023',
    card: '#0b1630',
    text: '#e6eef8',
    subtext: '#98a6bf',
    accent: '#60a5fa',
    subtle: '#071a36',
  },
};

export const makeStyles = (scheme: 'light' | 'dark' = 'light') => {
  const t = scheme === 'dark' ? themes.dark : themes.light;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
      paddingTop: Platform.OS === 'ios' ? 60 : 30,
      alignItems: 'center',
    },
    scrollContainer: {
      alignItems: 'center',
      paddingBottom: 40,
      paddingHorizontal: 16, // add horizontal padding (gutters)
      width: '100%',
    },
    header: {
      width: '100%',
      alignItems: 'center',
      marginBottom: 18,
    },
    mainpic: {
      width: '100%',           // fill available horizontal space (matches card width)
      aspectRatio: 16 / 9,    // keep natural proportion while filling width
      borderRadius: 14,
      borderWidth: 2,
      borderColor: t.subtle,
      marginBottom: 8,
      marginTop: 12,
      backgroundColor: t.subtle,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: t.text,
      fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    },
    subtitle: {
      fontSize: 13,
      color: t.subtext,
      marginTop: 4,
    },
    card: {
      alignSelf: 'stretch',
      backgroundColor: t.card,
      padding: 20,
      borderRadius: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 6,
      alignItems: 'center',
    },
    greeting: {
      fontSize: 18,
      color: t.text,
      marginBottom: 8,
      fontWeight: '600',
      alignSelf: 'center',
    },
    nameAccent: {
      color: t.accent,
      fontWeight: '800',
    },
    lead: {
      color: t.subtext,
      marginBottom: 12,
      fontSize: 13,
    },
    cta: {
      marginTop: 8,
      backgroundColor: t.accent,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
    },
    ctaText: {
      color: '#fff',
      fontWeight: '700',
    },
  });
}

export default function HomeScreen() {
  const scheme = useColorScheme() || 'light';
  const styles = makeStyles(scheme);

  // Types (shared with Explore)
  type Team = {
    id: string;
    name: string;
    abbrev: string;
  };

  type Option = { label: string; value: string | null };

  // Local dropdown (same UX as Explore)
  function Dropdown({
    label,
    placeholder,
    options,
    value,
    onChange,
    disabled,
    loading,
  }: {
    label?: string;
    placeholder: string;
    options: Option[];
    value: string | null;
    onChange: (val: string | null) => void;
    disabled?: boolean;
    loading?: boolean;
  }) {
    const [open, setOpen] = React.useState(false);
    const textColor = (scheme as 'light' | 'dark') === 'dark' ? '#e6eef8' : '#0f172a';
    const border = (scheme as 'light' | 'dark') === 'dark' ? '#081726' : '#e2e8f0';
    const bg = (scheme as 'light' | 'dark') === 'dark' ? '#0b1630' : '#fff';
    const backdrop = 'rgba(0,0,0,0.4)';
    const selectedLabel = options.find((o) => o.value === value)?.label;
    return (
      <View style={{ alignSelf: 'stretch' }}>
        {label ? <Text style={{ color: (scheme as 'light' | 'dark') === 'dark' ? '#98a6bf' : '#64748b', marginBottom: 6 }}>{label}</Text> : null}
        <Pressable
          disabled={disabled || loading}
          onPress={() => setOpen(true)}
          style={{
            backgroundColor: bg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: border,
            paddingVertical: 12,
            paddingHorizontal: 0,
            opacity: disabled || loading ? 0.6 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={(scheme as 'light' | 'dark') === 'dark' ? '#fff' : '#000'} />
          ) : (
            <Text style={{ color: textColor }}>
              {selectedLabel || placeholder}
            </Text>
          )}
        </Pressable>
        <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: backdrop, justifyContent: 'center', paddingHorizontal: 24 }} onPress={() => setOpen(false)}>
            <Pressable
              onPress={() => {}}
              style={{ backgroundColor: bg, borderRadius: 14, paddingVertical: 8, maxHeight: 420, borderWidth: 1, borderColor: border }}
            >
              <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: border }}>
                <Text style={{ color: textColor, fontWeight: '700' }}>{label || 'Select'}</Text>
              </View>
              <ScrollView>
                {options.map((opt) => (
                  <Pressable
                    key={`${opt.label}-${opt.value}`}
                    onPress={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => ({ paddingVertical: 12, paddingHorizontal: 14, backgroundColor: pressed ? ((scheme as 'light' | 'dark') === 'dark' ? '#0e223f' : '#f8fafc') : 'transparent' })}
                  >
                    <Text style={{ color: textColor }}>{opt.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable onPress={() => setOpen(false)} style={{ paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: border }}>
                <Text style={{ color: (scheme as 'light' | 'dark') === 'dark' ? '#98a6bf' : '#64748b' }}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

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

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={{ alignSelf: 'stretch', width: '100%' }}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Hockey Stats</Text>
          <Image
            source={{ uri: 'https://s3951.pcdn.co/wp-content/uploads/2015/09/Connor-McDavid-CP-1-575x388.jpg' }}
            style={styles.mainpic}
            contentFit="cover"
            accessibilityLabel="User avatar"
          />
        </View>

  <View style={[styles.card, { width: '100%', alignSelf: 'stretch' }]}>
          {/* Team filter dropdown */}
          <View style={{ alignSelf: 'stretch' }}>
            {teamsError ? (
              <Text style={{ color: 'red', paddingBottom: 6 }}>{teamsError}</Text>
            ) : null}
            <Dropdown
              label="Team"
              placeholder="Filter by team (optional)"
              options={(teams ?? []).map((t) => ({ label: `${t.name} (${t.abbrev})`, value: t.abbrev }))}
              value={selectedTeam}
              onChange={setSelectedTeam}
              disabled={!teams || teams.length === 0}
              loading={loadingTeams}
            />
          </View>

          <Text style={[styles.greeting, { marginTop: 12 }]}>
            Today's Schedule
          </Text>

          {/* API data section */}
          <View style={{ marginTop: 16, width: '100%', alignItems: 'center' }}>
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
      </ScrollView>
    </ThemedView>
  );
}

