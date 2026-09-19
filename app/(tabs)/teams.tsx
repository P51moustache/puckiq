import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArenaButton, ArenaHeader, ArenaNote, arenaType } from '../../components/arena/ArenaPrimitives';
import { useArena } from '../../components/arena/ArenaProvider';
import { fetchArenaStandings, sourceFreshness } from '../../services/arenaData';
import { getArenaTeam } from '../../constants/arenaTheme';
import { parseTeamParam } from '../../utils/entityRoutes';
import { teamOrigin, teamOriginRoute } from '../../utils/navigationOrigins';
import { formatSeasonLabel } from '../../utils/season';
import type { ArenaStanding } from '../../types/arena';

/** Stable legacy/deep-link destination backed by the same league snapshot. */
export default function TeamDetailScreen() {
  const params = useLocalSearchParams<{ team?: string | string[]; from?: string | string[] }>();
  const team = parseTeamParam(params.team);
  const origin = teamOrigin(params.from);
  const { palette: p } = useArena();
  const [standing, setStanding] = useState<ArenaStanding | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setStanding(null); setError(null); setLoading(false);
    if (!team) return;
    setLoading(true);
    void fetchArenaStandings().then(rows => {
      if (alive) setStanding(rows.find(row => row.team_abbrev === team) ?? null);
    }).catch(() => { if (alive) setError(`Team statistics could not be loaded. Try again${origin ? ` or return to ${origin === 'following' ? 'Following' : 'League'}` : ' or return to League'}.`); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [team, attempt]);
  const goBack = () => {
    if (origin) router.replace(teamOriginRoute(origin));
    else if (router.canGoBack?.()) router.back();
    else router.replace('/(tabs)/stats');
  };
  const textStyle = { color: p.ink, fontFamily: arenaType.body, fontSize: 16, marginVertical: 12 };
  return <SafeAreaView edges={['top']} style={{flex:1, backgroundColor:p.page}}><ScrollView contentContainerStyle={{padding:20}}>
    <ArenaHeader title={team ?? 'TEAM'} subtitle={team ? getArenaTeam(team)?.name : 'Team detail'} />
    {loading ? <ActivityIndicator color={p.action}/> : error ? <><ArenaNote>{error}</ArenaNote><ArenaButton label="Try loading team again" onPress={() => setAttempt(value => value + 1)} /></> : standing ? <>
      <Text style={textStyle}>{formatSeasonLabel(standing.season)} regular season · Snapshot {standing.snapshot_date}</Text>
      <ArenaNote>Stored standings source: {sourceFreshness(standing.snapshot_date).status}. Historical snapshots describe that season, not current team form.</ArenaNote>
      <Text style={textStyle}>{standing.wins}–{standing.losses}–{standing.ot_losses} · {standing.points} points · {standing.games_played} games</Text>
      <Text style={textStyle}>{standing.goals_for} goals for · {standing.goals_against} goals against</Text>
      <Text style={textStyle}>{standing.division ?? 'Division unavailable'} · {standing.conference ?? 'Conference unavailable'}</Text>
      <ArenaButton label="Compare this team" onPress={() => router.push({ pathname:'/(tabs)/stats', params:{teamA:team!} })}/>
    </> : <ArenaNote>{team ? 'This team has no data in the latest standings snapshot.' : 'Team unavailable. Choose a club from League to open its record.'}</ArenaNote>}
    <ArenaButton label={origin === 'following' ? 'Back to Following' : 'Back to League'} secondary onPress={goBack} style={{marginTop:16}}/>
  </ScrollView></SafeAreaView>;
}
