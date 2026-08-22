import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { rinkGlass } from '../constants/theme';
import { loadRoster } from '../services/fantasyRoster';
import { searchNhlPlayers } from '../services/nhlPlayerSearch';
import {
  addOpponentPlayer,
  loadOpponentRoster,
  removeOpponentPlayer,
} from '../services/opponentRoster';
import type { FantasyPlayer, FantasyRoster, NhlSearchPlayer } from '../types/fantasy';
import PageHeader from './PageHeader';

export default function LeagueScreen() {
  const [mine, setMine] = useState<FantasyRoster | null>(null);
  const [opponent, setOpponent] = useState<FantasyPlayer[]>([]);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<NhlSearchPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const refresh = useCallback(async () => {
    const [roster, theirs] = await Promise.all([loadRoster(), loadOpponentRoster()]);
    setMine(roster);
    setOpponent(theirs);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setHits([]);
      return;
    }
    setSearching(true);
    try {
      setHits(await searchNhlPlayers(text, 8));
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleAdd = useCallback(async (hit: NhlSearchPlayer) => {
    try {
      const next = await addOpponentPlayer({
        playerId: hit.playerId,
        playerName: hit.name,
        teamAbbrev: hit.teamAbbrev,
        position: hit.position,
        rosterPosition: 'BN',
      });
      setOpponent(next);
      setQuery('');
      setHits([]);
    } catch (err) {
      Alert.alert('Opponent roster', err instanceof Error ? err.message : 'Could not add player');
    }
  }, []);

  const handleRemove = useCallback(async (playerId: number) => {
    setOpponent(await removeOpponentPlayer(playerId));
  }, []);

  if (loading) {
    return (
      <View style={styles.centered} testID="league-loading">
        <ActivityIndicator color={rinkGlass.blueLight} />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="league-screen">
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <PageHeader title="League" subtitle="Your team vs theirs · not a hosted league" />

        <Text style={styles.lede}>
          Friends already have a Yahoo or ESPN league. Attach it later. For now, put their names next to yours.
        </Text>

        <View style={styles.placeholders}>
          <TouchableOpacity
            style={styles.placeholder}
            onPress={() => Alert.alert(
              'Invite friend',
              'No SMS or social graph in this build. Add their roster by hand, or attach Yahoo later.',
            )}
            testID="league-invite"
          >
            <Text style={styles.placeholderText}>Invite friend</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.placeholder}
            onPress={() => Alert.alert(
              'Attach Yahoo league',
              'OAuth sync is stubbed. Manual opponent roster works today.',
            )}
            testID="league-attach-yahoo"
          >
            <Text style={styles.placeholderText}>Attach Yahoo</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>MY TEAM</Text>
        {(mine?.players ?? []).length === 0 ? (
          <Text style={styles.empty}>Add your roster on the Roster tab first.</Text>
        ) : (
          mine!.players.map((p) => (
            <Text key={p.playerId} style={styles.player} testID="league-mine-player">
              {`${p.playerName} · ${p.teamAbbrev}`}
            </Text>
          ))
        )}

        <Text style={styles.section}>THEIR TEAM</Text>
        {opponent.map((p) => (
          <TouchableOpacity
            key={p.playerId}
            onPress={() => handleRemove(p.playerId)}
            testID={`league-opp-${p.playerId}`}
          >
            <Text style={styles.player}>{`${p.playerName} · ${p.teamAbbrev}  (tap to remove)`}</Text>
          </TouchableOpacity>
        ))}

        <TextInput
          style={styles.search}
          placeholder="Search to add their player…"
          placeholderTextColor={rinkGlass.textMuted}
          value={query}
          onChangeText={handleSearch}
          testID="league-opp-search"
        />
        {searching ? <ActivityIndicator color={rinkGlass.blueLight} style={{ marginTop: 8 }} /> : null}
        {hits.map((hit) => (
          <TouchableOpacity
            key={hit.playerId}
            style={styles.hit}
            onPress={() => handleAdd(hit)}
            testID={`league-hit-${hit.playerId}`}
          >
            <Text style={styles.hitName}>{hit.name}</Text>
            <Text style={styles.hitMeta}>{`${hit.teamAbbrev} · ${hit.position}`}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: rinkGlass.ice,
  },
  centered: {
    flex: 1,
    backgroundColor: rinkGlass.ice,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
    paddingHorizontal: 16,
  },
  lede: {
    fontSize: 14,
    lineHeight: 20,
    color: rinkGlass.textSecondary,
    marginBottom: 14,
  },
  placeholders: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  placeholder: {
    flex: 1,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    backgroundColor: rinkGlass.boards,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  placeholderText: {
    color: rinkGlass.blueLight,
    fontWeight: '700',
    fontSize: 13,
  },
  section: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: rinkGlass.textMuted,
    marginBottom: 8,
    marginTop: 8,
  },
  empty: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
    marginBottom: 12,
  },
  player: {
    fontSize: 15,
    color: rinkGlass.textPrimary,
    paddingVertical: 6,
  },
  search: {
    marginTop: 8,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    backgroundColor: rinkGlass.boards,
    paddingHorizontal: 12,
    color: rinkGlass.textPrimary,
  },
  hit: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: rinkGlass.glassBorder,
  },
  hitName: {
    fontSize: 15,
    fontWeight: '600',
    color: rinkGlass.textPrimary,
  },
  hitMeta: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
    marginTop: 2,
  },
});
