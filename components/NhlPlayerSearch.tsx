import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { barn, barnLines } from '../constants/barn';
import { searchNhlPlayers, suggestedLineGroup } from '../services/nhlPlayerSearch';
import type { NhlSearchPlayer } from '../types/fantasy';
import type { LineGroup } from '../types/lines';

const CHIPS: { key: LineGroup; label: string }[] = [
  { key: 'F', label: 'F' },
  { key: 'D', label: 'D' },
  { key: 'G', label: 'G' },
  { key: 'bench', label: 'BN' },
];

interface NhlPlayerSearchProps {
  onAdd: (hit: NhlSearchPlayer, group: LineGroup) => void;
  alreadyOnRoster?: Set<number>;
}

export default function NhlPlayerSearch({ onAdd, alreadyOnRoster }: NhlPlayerSearchProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<NhlSearchPlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits((prev) => (prev.length === 0 ? prev : []));
      setError((prev) => (prev == null ? prev : null));
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const next = await searchNhlPlayers(trimmed, 8);
        if (!cancelled) {
          setHits(next);
          setError(next.length === 0 ? 'Nobody by that name' : null);
        }
      } catch {
        if (!cancelled) {
          setHits([]);
          setError(barnLines.error);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleAdd = useCallback(
    (hit: NhlSearchPlayer, group: LineGroup) => {
      onAdd(hit, group);
      setQuery('');
      setHits([]);
    },
    [onAdd],
  );

  return (
    <View style={styles.wrap} testID="lines-nhl-search">
      <TextInput
        style={styles.input}
        placeholder="Write a name"
        placeholderTextColor={barn.ghost}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="words"
        testID="lines-first-add-name"
        accessibilityLabel="Search NHL players"
      />
      {searching ? <ActivityIndicator color={barn.signal} style={styles.spinner} /> : null}
      {error ? <Text style={styles.error} testID="lines-search-empty">{error}</Text> : null}
      {hits.map((hit) => {
        const onRoster = alreadyOnRoster?.has(hit.playerId);
        const suggested = suggestedLineGroup(hit.position);
        return (
          <View key={hit.playerId} style={styles.hit} testID={`lines-search-hit-${hit.playerId}`}>
            <View style={styles.hitText}>
              <Text style={styles.hitName}>{hit.name}</Text>
              <Text style={styles.hitMeta}>
                {[hit.teamAbbrev, hit.position, hit.active ? 'active' : 'inactive']
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            {onRoster ? (
              <Text style={styles.onRoster}>On the board</Text>
            ) : (
              <View style={styles.chips}>
                {CHIPS.map((chip) => (
                  <TouchableOpacity
                    key={chip.key}
                    onPress={() => handleAdd(hit, chip.key)}
                    style={[styles.chip, chip.key === suggested && styles.chipSuggested]}
                    testID={`lines-first-add-${chip.key}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Put ${hit.name} on ${chip.label}`}
                  >
                    <Text style={[styles.chipLabel, chip.key === suggested && styles.chipLabelSuggested]}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: 8,
  },
  input: {
    height: 52,
    borderRadius: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderBottomWidth: 1,
    borderColor: barn.ink,
    fontSize: 20,
    color: barn.ink,
    fontFamily: barn.fonts.body,
    outlineWidth: 0,
  },
  spinner: {
    marginVertical: 4,
  },
  error: {
    fontSize: 13,
    color: barn.ghost,
    fontFamily: barn.fonts.body,
  },
  hit: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderColor: `${barn.ink}22`,
    paddingVertical: 10,
    gap: 8,
  },
  hitText: {
    gap: 2,
  },
  hitName: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: barn.ink,
    fontFamily: barn.fonts.display,
    textTransform: 'uppercase',
  },
  hitMeta: {
    fontSize: 12,
    color: barn.ghost,
    fontFamily: barn.fonts.mono,
  },
  onRoster: {
    fontSize: 12,
    color: barn.ghost,
    fontFamily: barn.fonts.body,
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: barn.ink,
    alignItems: 'center',
  },
  chipSuggested: {
    backgroundColor: barn.signal,
    borderColor: barn.signal,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: barn.ink,
    fontFamily: barn.fonts.mono,
  },
  chipLabelSuggested: {
    color: barn.ink,
  },
});
