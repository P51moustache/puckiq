import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import TeamHeadToHead from '../../components/TeamHeadToHead';
import { ArenaButton, ArenaHeader, ArenaNote, arenaType } from '../../components/arena/ArenaPrimitives';
import { useArena } from '../../components/arena/ArenaProvider';
import { getArenaTeam } from '../../constants/arenaTheme';
import { fetchArenaStandings } from '../../services/arenaData';
import type { ArenaStanding } from '../../types/arena';
import { getTeamLogoUrl } from '../../utils/teamLogo';

type LeagueView = 'standings' | 'compare';

function formatSnapshotDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(parsed);
}

function formatSeason(value: number): string {
  const raw = String(value);
  return raw.length === 8 ? `${raw.slice(0, 4)}–${raw.slice(6)}` : raw;
}

export default function LeagueScreen() {
  const { palette: p } = useArena();
  const [view, setView] = useState<LeagueView>('standings');
  const [standings, setStandings] = useState<ArenaStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStandings = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setStandings(await fetchArenaStandings());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Standings could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadStandings(); }, [loadStandings]);

  const ranked = useMemo(
    () => [...standings].sort((a, b) => {
      const aRank = a.league_sequence ?? Number.MAX_SAFE_INTEGER;
      const bRank = b.league_sequence ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank || b.points - a.points;
    }),
    [standings],
  );
  const snapshot = ranked[0]?.snapshot_date;
  const season = ranked[0]?.season;

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: p.page }]} testID="league-tab">
      <View style={styles.headerArea}>
        <ArenaHeader title="LEAGUE" subtitle="The current table and the tools behind your picks." />
        <View style={[styles.switcher, { backgroundColor: p.soft, borderColor: p.edge }]}>
          {(['standings', 'compare'] as const).map((item) => {
            const active = item === view;
            const label = item === 'standings' ? 'Standings' : 'Compare';
            return (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setView(item)}
                testID={`league-view-${item}`}
                style={[styles.switchButton, active && { backgroundColor: p.paper, borderColor: p.frame }]}
              >
                <Text style={[styles.switchText, { color: active ? p.ink : p.muted }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {view === 'compare' ? (
        <View style={styles.compareView}><TeamHeadToHead /></View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadStandings(true)} tintColor={p.action} />}
        >
          <View style={[styles.toolsCard, { backgroundColor: p.hero, borderColor: p.frame }]}>
            <View style={styles.toolsCopy}>
              <Text style={[styles.toolsTitle, { color: p.heroInk }]}>YOUR MODEL ROOM</Text>
              <Text style={[styles.toolsBody, { color: p.heroInk }]}>Review the model behind your forecasts and adjust your own weights.</Text>
            </View>
            <ArenaButton label="Models" icon="options-outline" secondary onPress={() => router.push('/(tabs)/models')} style={styles.modelsButton} />
          </View>

          <View style={styles.tableHeading}>
            <View>
              <Text style={[styles.tableTitle, { color: p.ink }]}>STANDINGS</Text>
              {snapshot ? (
                <Text style={[styles.freshness, { color: p.muted }]}>
                  Snapshot {formatSnapshotDate(snapshot)}{season ? ` · ${formatSeason(season)}` : ''}
                </Text>
              ) : null}
            </View>
            <Ionicons name="refresh-outline" size={20} color={p.link} />
          </View>

          {loading ? (
            <View style={styles.loading}><ActivityIndicator size="large" color={p.action} /></View>
          ) : error ? (
            <ArenaNote>{error}</ArenaNote>
          ) : ranked.length === 0 ? (
            <ArenaNote>No standings snapshot is available yet. Pull down to check again.</ArenaNote>
          ) : (
            <View style={[styles.table, { backgroundColor: p.paper, borderColor: p.edge }]}>
              <View style={[styles.columnHeader, { backgroundColor: p.soft, borderBottomColor: p.edge }]}>
                <Text style={[styles.rankHeader, { color: p.muted }]}>RK</Text>
                <Text style={[styles.clubHeader, { color: p.muted }]}>CLUB</Text>
                <Text style={[styles.recordHeader, { color: p.muted }]}>W-L-OT</Text>
                <Text style={[styles.pointsHeader, { color: p.muted }]}>PTS</Text>
              </View>
              {ranked.map((standing, index) => {
                const team = getArenaTeam(standing.team_abbrev);
                const rank = standing.league_sequence ?? index + 1;
                const goalDiff = standing.goals_for - standing.goals_against;
                return (
                  <View key={standing.team_abbrev} style={[styles.standingRow, { borderBottomColor: p.edge }]} testID={`standing-${standing.team_abbrev}`}>
                    <Text style={[styles.rank, { color: p.ink }]}>{rank}</Text>
                    <View style={[styles.accent, { backgroundColor: team?.tokens.hero ?? p.frame }]} />
                    <Image source={{ uri: getTeamLogoUrl(standing.team_abbrev) }} style={styles.logo} contentFit="contain" accessibilityLabel={`${team?.name ?? standing.team_abbrev} logo`} />
                    <View style={styles.clubCopy}>
                      <Text style={[styles.abbrev, { color: p.ink }]}>{standing.team_abbrev}</Text>
                      <Text style={[styles.clubMeta, { color: p.muted }]} numberOfLines={1}>
                        {standing.division ?? 'NHL'} · {goalDiff >= 0 ? '+' : ''}{goalDiff} GD
                      </Text>
                    </View>
                    <Text style={[styles.record, { color: p.muted }]}>{standing.wins}-{standing.losses}-{standing.ot_losses}</Text>
                    <Text style={[styles.points, { color: p.ink }]}>{standing.points}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerArea: { paddingHorizontal: 18 },
  switcher: { flexDirection: 'row', padding: 4, borderWidth: 1, borderRadius: 13, marginBottom: 12 },
  switchButton: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: 'transparent', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  switchText: { fontFamily: arenaType.body, fontWeight: '800', fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 110 },
  compareView: { flex: 1, paddingTop: 2 },
  toolsCard: { borderWidth: 2, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  toolsCopy: { flex: 1 },
  toolsTitle: { fontFamily: arenaType.display, fontSize: 24, lineHeight: 27 },
  toolsBody: { fontFamily: arenaType.body, fontSize: 12, lineHeight: 17, opacity: 0.8, marginTop: 2 },
  modelsButton: { minHeight: 44, width: 108, paddingHorizontal: 10, borderRadius: 10 },
  tableHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 25, marginBottom: 10 },
  tableTitle: { fontFamily: arenaType.display, fontSize: 31, lineHeight: 33 },
  freshness: { fontFamily: arenaType.body, fontSize: 12, marginTop: 2 },
  loading: { paddingVertical: 70, alignItems: 'center' },
  table: { borderWidth: 1.5, borderRadius: 14, overflow: 'hidden' },
  columnHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: 10 },
  rankHeader: { width: 31, fontFamily: arenaType.body, fontSize: 9, fontWeight: '800' },
  clubHeader: { flex: 1, fontFamily: arenaType.body, fontSize: 9, fontWeight: '800' },
  recordHeader: { width: 68, textAlign: 'right', fontFamily: arenaType.body, fontSize: 9, fontWeight: '800' },
  pointsHeader: { width: 44, textAlign: 'right', fontFamily: arenaType.body, fontSize: 9, fontWeight: '800' },
  standingRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10 },
  rank: { width: 31, fontFamily: arenaType.display, fontSize: 21, fontVariant: ['tabular-nums'] },
  accent: { width: 5, height: 38, borderRadius: 3, marginRight: 7 },
  logo: { width: 38, height: 38, marginRight: 8 },
  clubCopy: { flex: 1, minWidth: 0 },
  abbrev: { fontFamily: arenaType.body, fontSize: 14, fontWeight: '900' },
  clubMeta: { fontFamily: arenaType.body, fontSize: 10, marginTop: 2 },
  record: { width: 68, textAlign: 'right', fontFamily: arenaType.body, fontSize: 12, fontVariant: ['tabular-nums'] },
  points: { width: 44, textAlign: 'right', fontFamily: arenaType.display, fontSize: 24, fontVariant: ['tabular-nums'] },
});
