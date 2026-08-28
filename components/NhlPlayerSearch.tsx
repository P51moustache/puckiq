import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { rinkGlass } from '../constants/theme';
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
          setError(next.length === 0 ? 'No NHL match' : null);
        }
      } catch {
        if (!cancelled) {
          setHits([]);
          setError('NHL search failed');
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
        placeholder="Search NHL — McDavid, Makar…"
        placeholderTextColor={rinkGlass.textMuted}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="words"
        testID="lines-first-add-name"
        accessibilityLabel="Search NHL players"
      />
      {searching ? <ActivityIndicator color={rinkGlass.blueLight} style={styles.spinner} /> : null}
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
              <Text style={styles.onRoster}>On roster</Text>
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
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: rinkGlass.boards,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    fontSize: 15,
    color: rinkGlass.textPrimary,
  },
  spinner: {
    marginVertical: 4,
  },
  error: {
    fontSize: 13,
    color: rinkGlass.textMuted,
  },
  hit: {
    backgroundColor: rinkGlass.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    padding: 12,
    gap: 8,
  },
  hitText: {
    gap: 2,
  },
  hitName: {
    fontSize: 16,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
  },
  hitMeta: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
  },
  onRoster: {
    fontSize: 12,
    color: rinkGlass.textMuted,
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: rinkGlass.boards,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    alignItems: 'center',
  },
  chipSuggested: {
    backgroundColor: rinkGlass.blueLight,
    borderColor: rinkGlass.blueLight,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: rinkGlass.textSecondary,
  },
  chipLabelSuggested: {
    color: '#0a0e1a',
  },
});
