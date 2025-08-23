import React, { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Platform, StyleSheet, useColorScheme, Pressable, ScrollView, ActivityIndicator } from 'react-native';
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

  type Game = {
    id: string;
    home: string;
    away: string;
    start: string;    // ISO timestamp from API
    status: string;
    venue?: string;
  };

  const [schedule, setSchedule] = useState<Game[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <Text style={styles.subtitle}>{now.toLocaleDateString()}</Text>
          <Image
            source={{ uri: 'https://media.d3.nhle.com/image/private/t_ratio16_9-size20/dpr_2.0/f_auto/prd/dtrscccamuekvlatxid5.jpg' }}
            style={styles.mainpic}
            contentFit="cover"
            accessibilityLabel="User avatar"
          />
        </View>

  <View style={[styles.card, { width: '100%', alignSelf: 'stretch' }]}>
          <Text style={styles.greeting}>
            Today's Schedule
          </Text>

          {/* API data section */}
          <View style={{ marginTop: 16, width: '100%', alignItems: 'center' }}>
            {loading && <ActivityIndicator size="small" color={scheme === 'dark' ? '#fff' : '#000'} />}
            {error && <Text style={{ color: 'red', marginTop: 8 }}>{error}</Text>}
            {!loading && !error && schedule && schedule.length === 0 && (
              <Text style={{ color: styles.lead.color, marginTop: 8 }}>No games scheduled for today.</Text>
            )}
            {!loading && schedule && schedule.map((g) => {
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

