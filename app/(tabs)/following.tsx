import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArenaButton,
  ArenaHeader,
  ArenaNote,
  arenaType,
} from '../../components/arena/ArenaPrimitives';
import { useArena } from '../../components/arena/ArenaProvider';
import { ARENA_TEAMS, type ArenaTeam } from '../../constants/arenaTheme';
import { getTeamLogoUrl } from '../../utils/teamLogo';

const WATCHLIST_KEY = 'puckiq_watchlist';

export default function FollowingScreen() {
  const {
    palette: p,
    homeTeam,
    followedTeams,
    loading,
    followTeam,
    unfollowTeam,
    chooseHomeTeam,
  } = useArena();
  const [busyTeam, setBusyTeam] = useState<string | null>(null);
  const [watchCount, setWatchCount] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    void AsyncStorage.getItem(WATCHLIST_KEY)
      .then((raw) => {
        if (!active) return;
        try {
          const parsed: unknown = raw ? JSON.parse(raw) : [];
          setWatchCount(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'number').length : 0);
        } catch {
          setWatchCount(0);
        }
      })
      .catch(() => {
        if (active) setWatchCount(0);
      });
    return () => { active = false; };
  }, []));

  const followed = useMemo(
    () => new Set(followedTeams.map((team) => team.triCode.toUpperCase())),
    [followedTeams],
  );

  const runTeamAction = async (team: ArenaTeam, action: 'follow' | 'unfollow' | 'home') => {
    setBusyTeam(team.abbrev);
    try {
      if (action === 'follow') await followTeam(team.abbrev);
      if (action === 'unfollow') await unfollowTeam(team.abbrev);
      if (action === 'home') await chooseHomeTeam(team.abbrev);
    } catch {
      Alert.alert('Team could not be saved', 'Please try again.');
    } finally {
      setBusyTeam(null);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: p.page }]} testID="following-tab">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ArenaHeader title="FOLLOWING" subtitle="Teams you care about, with one home-ice identity." />

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={p.action} />
          </View>
        ) : homeTeam ? (
          <View style={[styles.homeCard, { backgroundColor: p.hero, borderColor: p.frame, shadowColor: p.frame }]}>
            <View style={styles.homeCardCopy}>
              <Text style={[styles.kicker, { color: p.heroInk }]}>HOME ICE</Text>
              <Text style={[styles.homeName, { color: p.heroInk }]}>{homeTeam.name}</Text>
              <Text style={[styles.homeMeta, { color: p.heroInk }]}>This team sets your app colors.</Text>
            </View>
            <Image
              source={{ uri: getTeamLogoUrl(homeTeam.abbrev) }}
              style={styles.homeLogo}
              contentFit="contain"
              accessibilityLabel={`${homeTeam.name} logo`}
            />
          </View>
        ) : (
          <ArenaNote>Follow your first team to set your home-ice colors. You can change the home team later without changing who you follow.</ArenaNote>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Browse players, ${watchCount} watched`}
          onPress={() => router.push('/(tabs)/players')}
          style={({ pressed }) => [
            styles.watchCard,
            { backgroundColor: p.paper, borderColor: p.edge, opacity: pressed ? 0.78 : 1 },
          ]}
        >
          <View style={[styles.watchIcon, { backgroundColor: p.soft }]}>
            <Ionicons name="eye-outline" size={22} color={p.link} />
          </View>
          <View style={styles.watchCopy}>
            <Text style={[styles.cardTitle, { color: p.ink }]}>Browse players</Text>
            <Text style={[styles.cardMeta, { color: p.muted }]}>
              {watchCount === 0 ? 'Watched players: none yet' : `Watched players: ${watchCount} saved`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={p.link} />
        </Pressable>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={[styles.sectionTitle, { color: p.ink }]}>ALL 32 CLUBS</Text>
            <Text style={[styles.sectionMeta, { color: p.muted }]}>{followed.size} followed</Text>
          </View>
          <View style={[styles.headingRule, { backgroundColor: p.action }]} />
        </View>

        <View style={styles.teamList}>
          {ARENA_TEAMS.map((team) => {
            const isFollowed = followed.has(team.abbrev);
            const isHome = homeTeam?.abbrev === team.abbrev;
            const isBusy = busyTeam === team.abbrev;
            return (
              <View
                key={team.abbrev}
                style={[styles.teamRow, { backgroundColor: p.paper, borderColor: isHome ? p.frame : p.edge }]}
                testID={`following-team-${team.abbrev}`}
              >
                <View style={[styles.teamMark, { backgroundColor: team.tokens.hero, borderBottomColor: team.tokens.action }]}>
                  <Image
                    source={{ uri: getTeamLogoUrl(team.abbrev) }}
                    style={styles.teamLogo}
                    contentFit="contain"
                    accessibilityLabel={`${team.name} logo`}
                  />
                </View>
                <View style={styles.teamCopy}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Open ${team.name} team detail`} onPress={() => router.push({ pathname: '/(tabs)/teams', params: { team: team.abbrev } })}><Text style={[styles.teamName, { color: p.ink }]} numberOfLines={1}>{team.name}</Text></Pressable>
                  <Text style={[styles.teamState, { color: p.muted }]}>
                    {isHome ? 'Home team · Following' : isFollowed ? 'Following' : team.abbrev}
                  </Text>
                  {isFollowed && !isHome ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Make ${team.name} home team`}
                      disabled={!!busyTeam}
                      onPress={() => void runTeamAction(team, 'home')}
                      style={styles.homeAction}
                    >
                      <Ionicons name="home-outline" size={15} color={p.link} />
                      <Text style={[styles.homeActionText, { color: p.link }]}>Make home</Text>
                    </Pressable>
                  ) : null}
                </View>
                {isBusy ? (
                  <View style={styles.actionLoader}><ActivityIndicator color={p.link} /></View>
                ) : (
                  <ArenaButton
                    label={isFollowed ? 'Unfollow' : 'Follow'}
                    secondary={isFollowed}
                    disabled={!!busyTeam}
                    onPress={() => void runTeamAction(team, isFollowed ? 'unfollow' : 'follow')}
                    style={styles.followButton}
                  />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 110,
  },
  loading: { paddingVertical: 42, alignItems: 'center' },
  homeCard: {
    minHeight: 150,
    borderWidth: 2,
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  homeCardCopy: { flex: 1, justifyContent: 'center', zIndex: 1 },
  kicker: { fontFamily: arenaType.body, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, opacity: 0.78 },
  homeName: { fontFamily: arenaType.display, fontSize: 38, marginTop: 4 },
  homeMeta: { fontFamily: arenaType.body, fontSize: 12, marginTop: 6, opacity: 0.78 },
  homeLogo: { width: 104, height: 104, alignSelf: 'center' },
  watchCard: {
    minHeight: 76,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  watchIcon: { width: 46, height: 46, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  watchCopy: { flex: 1, marginHorizontal: 12 },
  cardTitle: { fontFamily: arenaType.body, fontSize: 15, fontWeight: '800' },
  cardMeta: { fontFamily: arenaType.body, fontSize: 12, marginTop: 3 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 20, marginBottom: 12 },
  sectionTitle: { fontFamily: arenaType.display, fontSize: 29 },
  sectionMeta: { fontFamily: arenaType.body, fontSize: 12, marginTop: 2 },
  headingRule: { width: 52, height: 5, borderRadius: 3, marginBottom: 6 },
  teamList: { gap: 9 },
  teamRow: { minHeight: 86, borderWidth: 1.5, borderRadius: 14, padding: 10, flexDirection: 'row', alignItems: 'center' },
  teamMark: { width: 58, height: 58, borderRadius: 11, borderBottomWidth: 7, alignItems: 'center', justifyContent: 'center' },
  teamLogo: { width: 45, height: 45 },
  teamCopy: { flex: 1, minWidth: 0, marginHorizontal: 11 },
  teamName: { fontFamily: arenaType.body, fontWeight: '800', fontSize: 14 },
  teamState: { fontFamily: arenaType.body, fontSize: 11, marginTop: 3 },
  homeAction: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5 },
  homeActionText: { fontFamily: arenaType.body, fontWeight: '800', fontSize: 12 },
  followButton: { minHeight: 44, width: 90, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 10 },
  actionLoader: { width: 90, alignItems: 'center' },
});
