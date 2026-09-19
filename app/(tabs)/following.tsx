import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useWatchlist } from '../../hooks/useWatchlist';
import PlayerDetailModal from '../../components/PlayerDetailModal';
import type { WatchedPlayer } from '../../services/watchlist';
import { getPlayerDetail } from '../../services/playerDetail';

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
  const watchlist = useWatchlist();
  const refreshWatchlist = watchlist.refresh;
  const addWatchedPlayer = watchlist.add;
  const removeWatchedPlayer = watchlist.remove;
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [removedPlayer, setRemovedPlayer] = useState<WatchedPlayer | null>(null);
  const [watchActionError, setWatchActionError] = useState<string | null>(null);
  const [removingPlayerId, setRemovingPlayerId] = useState<number | null>(null);
  const [failedRemove, setFailedRemove] = useState<WatchedPlayer | null>(null);
  const removingRef = useRef(false);

  const removePlayer = useCallback(async (player: WatchedPlayer) => {
    if (removingRef.current) return;
    removingRef.current = true;
    setRemovingPlayerId(player.playerId);
    setWatchActionError(null);
    setFailedRemove(null);
    try {
      const removed = await removeWatchedPlayer(player.playerId);
      if (removed) setRemovedPlayer(removed);
    } catch {
      setFailedRemove(player);
      setWatchActionError(`${player.fullName} could not be removed.`);
    } finally { removingRef.current = false; setRemovingPlayerId(null); }
  }, [removeWatchedPlayer]);

  useFocusEffect(useCallback(() => {
    void refreshWatchlist().then(() => undefined);
    return undefined;
  }, [refreshWatchlist]));

  useEffect(() => {
    const legacy = watchlist.players.filter(player => player.fullName === `Player #${player.playerId}`);
    if (!legacy.length) return;
    let active = true;
    void Promise.all(legacy.map(async player => {
      const detail = await getPlayerDetail(player.playerId);
      if (active && detail) await addWatchedPlayer({ playerId: detail.bio.playerId, fullName: detail.bio.fullName, teamAbbrev: detail.bio.teamAbbrev, position: detail.bio.position, headshotUrl: detail.bio.headshotUrl });
    })).catch(() => undefined);
    return () => { active = false; };
  }, [watchlist.players, addWatchedPlayer]);

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
          accessibilityLabel="Open My Team fantasy roster"
          onPress={() => router.push('/(tabs)/myteam')}
          style={({ pressed }) => [styles.watchCard, { backgroundColor: p.paper, borderColor: p.edge, opacity: pressed ? 0.78 : 1 }]}
        >
          <View style={[styles.watchIcon, { backgroundColor: p.soft }]}><Ionicons name="people-outline" size={22} color={p.link} /></View>
          <View style={styles.watchCopy}><Text style={[styles.cardTitle, { color: p.ink }]}>My Team</Text><Text style={[styles.cardMeta, { color: p.muted }]}>Fantasy roster, starts and projections</Text></View>
          <Ionicons name="chevron-forward" size={20} color={p.link} />
        </Pressable>

        <View style={styles.sectionHeading}>
          <View><Text style={[styles.sectionTitle, { color: p.ink }]}>WATCHED PLAYERS</Text><Text accessibilityLabel={`Watched players, ${watchlist.players.length} saved on this device`} style={[styles.sectionMeta, { color: p.muted }]}>{watchlist.players.length} saved on this device</Text></View>
          <View style={[styles.headingRule, { backgroundColor: p.action }]} />
        </View>
        {watchlist.loading ? <ActivityIndicator color={p.action} /> : watchlist.error ? (
          <View style={[styles.inlineState, { backgroundColor: p.paper, borderColor: p.edge }]}><Text style={[styles.cardMeta, { color: p.ink }]}>{watchlist.error}</Text><ArenaButton label="Retry" onPress={() => void watchlist.refresh()} /></View>
        ) : watchlist.players.length ? (
          <View style={styles.playerList}>{watchlist.players.map(player => (
            <Pressable key={player.playerId} accessibilityRole="button" accessibilityLabel={`Open ${player.fullName} player detail`} onPress={() => setSelectedPlayerId(player.playerId)} style={({ pressed }) => [styles.playerRow, { backgroundColor: p.paper, borderColor: p.edge, opacity: pressed ? 0.78 : 1 }]}>
              <Image source={{ uri: player.headshotUrl }} style={[styles.playerHeadshot, { backgroundColor: p.soft }]} contentFit="cover" accessibilityLabel={`${player.fullName} headshot`} />
              <View style={styles.watchCopy}><Text style={[styles.cardTitle, { color: p.ink }]}>{player.fullName}</Text><Text style={[styles.cardMeta, { color: p.muted }]}>{[player.teamAbbrev, player.position].filter(Boolean).join(' / ') || 'Details available when opened'}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel={`${failedRemove?.playerId === player.playerId ? 'Retry unwatching' : 'Unwatch'} ${player.fullName}`} accessibilityState={{ busy: removingPlayerId === player.playerId, disabled: removingPlayerId !== null }} disabled={removingPlayerId !== null} onPress={event => { event.stopPropagation(); void removePlayer(player); }} style={styles.removeButton}><Ionicons name="close" size={20} color={p.link} /></Pressable>
            </Pressable>
          ))}</View>
        ) : (
          <Pressable
          accessibilityRole="button"
          accessibilityLabel="Browse players"
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
            <Text style={[styles.cardMeta, { color: p.muted }]}>Search any player and add them here.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={p.link} />
        </Pressable>
        )}
        {removedPlayer ? <View style={[styles.undoRow, { backgroundColor: p.soft }]}><Text style={[styles.cardMeta, { color: p.ink }]}>{removedPlayer.fullName} removed</Text><Pressable accessibilityRole="button" accessibilityLabel={`Undo removing ${removedPlayer.fullName}`} onPress={async () => { try { await watchlist.add(removedPlayer); setRemovedPlayer(null); setWatchActionError(null); } catch { setWatchActionError('Player could not be restored. Retry Undo.'); } }} style={styles.undoButton}><Text style={[styles.cardTitle, { color: p.link }]}>Undo</Text></Pressable></View> : null}
        {watchActionError ? <View style={[styles.undoRow, { backgroundColor: p.soft }]}><Text accessibilityRole="alert" style={[styles.cardMeta, { color: p.ink }]}>{watchActionError}</Text>{failedRemove ? <Pressable accessibilityRole="button" accessibilityLabel={`Retry unwatching ${failedRemove.fullName}`} onPress={() => void removePlayer(failedRemove)} style={styles.undoButton}><Text style={[styles.cardTitle, { color: p.link }]}>Retry</Text></Pressable> : null}</View> : null}

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
                  <Pressable accessibilityRole="button" accessibilityLabel={`Open ${team.name} team detail`} onPress={() => router.push({ pathname: '/(tabs)/teams', params: { team: team.abbrev, from: 'following' } })}><Text style={[styles.teamName, { color: p.ink }]} numberOfLines={1}>{team.name}</Text></Pressable>
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
      <PlayerDetailModal visible={selectedPlayerId !== null} playerId={selectedPlayerId} onClose={() => setSelectedPlayerId(null)} />
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
  playerList: { gap: 8, marginBottom: 8 },
  playerRow: { minHeight: 72, borderWidth: 1.5, borderRadius: 14, padding: 10, flexDirection: 'row', alignItems: 'center' },
  playerHeadshot: { width: 48, height: 48, borderRadius: 24 },
  removeButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  inlineState: { borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 10, marginBottom: 8 },
  undoRow: { minHeight: 48, borderRadius: 10, paddingLeft: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  undoButton: { minWidth: 60, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
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
