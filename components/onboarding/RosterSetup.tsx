import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { theme } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

interface PlayerResult {
  id: number;
  name: string;
  teamAbbrev: string;
  position: string;
}

interface RosterSetupProps {
  onContinue: (players: PlayerResult[]) => void;
  onSkip: () => void;
}

export function RosterSetup({ onContinue, onSkip }: RosterSetupProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addedPlayers, setAddedPlayers] = useState<PlayerResult[]>([]);

  const searchPlayers = useCallback(async (text: string) => {
    setQuery(text);
    if (text.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('skater_season_stats')
        .select('player_id, player_name, team_abbrev, position')
        .ilike('player_name', `%${text}%`)
        .limit(10);

      if (!error && data) {
        const mapped = data.map((p: any) => ({
          id: p.player_id,
          name: p.player_name,
          teamAbbrev: p.team_abbrev,
          position: p.position,
        }));
        // Filter out already-added players
        const filtered = mapped.filter(
          (p: PlayerResult) => !addedPlayers.some((a) => a.id === p.id)
        );
        setResults(filtered);
      }
    } catch (err) {
      console.warn('[ONBOARDING] Player search failed:', err);
    } finally {
      setSearching(false);
    }
  }, [addedPlayers]);

  const addPlayer = useCallback((player: PlayerResult) => {
    setAddedPlayers((prev) => [...prev, player]);
    setResults((prev) => prev.filter((p) => p.id !== player.id));
    setQuery('');
  }, []);

  const removePlayer = useCallback((playerId: number) => {
    setAddedPlayers((prev) => prev.filter((p) => p.id !== playerId));
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Add a few key players</Text>
        <Text style={styles.subtitle}>
          We'll give you personalized start/sit recommendations
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search player names..."
          placeholderTextColor={theme.subtext}
          value={query}
          onChangeText={searchPlayers}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {searching && <ActivityIndicator style={styles.spinner} color={theme.accent} />}
      </View>

      {addedPlayers.length > 0 && (
        <View style={styles.chips}>
          {addedPlayers.map((player) => (
            <TouchableOpacity
              key={player.id}
              style={styles.chip}
              onPress={() => removePlayer(player.id)}
              accessibilityLabel={`Remove ${player.name}`}
            >
              <Text style={styles.chipText}>{player.name}</Text>
              <Text style={styles.chipClose}>x</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.resultRow}
            onPress={() => addPlayer(item)}
            accessibilityLabel={`Add ${item.name}`}
          >
            <View style={styles.resultInfo}>
              <Text style={styles.resultName}>{item.name}</Text>
              <Text style={styles.resultDetail}>
                {item.position} - {item.teamAbbrev}
              </Text>
            </View>
            <Text style={styles.addIcon}>+</Text>
          </TouchableOpacity>
        )}
        style={styles.resultsList}
        keyboardShouldPersistTaps="handled"
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            addedPlayers.length === 0 && styles.continueButtonDisabled,
          ]}
          onPress={() => onContinue(addedPlayers)}
          disabled={addedPlayers.length === 0}
        >
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onSkip} style={styles.skipLink}>
          <Text style={styles.skipText}>Skip — I'll do this later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
    lineHeight: 36,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.subtext,
    lineHeight: 22,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.subtle,
  },
  spinner: {
    position: 'absolute',
    right: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.factbox,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  chipText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '500',
  },
  chipClose: {
    color: theme.subtext,
    fontSize: 16,
    fontWeight: '700',
  },
  resultsList: {
    flex: 1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.subtle,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  resultDetail: {
    color: theme.subtext,
    fontSize: 13,
    marginTop: 2,
  },
  addIcon: {
    color: theme.accent,
    fontSize: 24,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  footer: {
    paddingVertical: 24,
    gap: 12,
  },
  continueButton: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    color: theme.subtext,
    fontSize: 15,
  },
});
