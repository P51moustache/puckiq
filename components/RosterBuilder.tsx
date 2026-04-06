/**
 * RosterBuilder
 * Modal for searching and adding players to a fantasy roster.
 * Includes scoring format selector, player search, and save functionality.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { saveRoster, updateRoster } from '../services/fantasyRoster';
import type { FantasyPlayer, FantasyRoster, ScoringFormat } from '../types/fantasy';

interface RosterBuilderProps {
  visible: boolean;
  onDismiss: () => void;
  onSaved: () => void;
  existingRoster?: FantasyRoster | null;
}

interface SearchResult {
  id: number;
  first_name: string;
  last_name: string;
  current_team_abbrev: string;
  position_code: string;
}

export default function RosterBuilder({
  visible,
  onDismiss,
  onSaved,
  existingRoster,
}: RosterBuilderProps) {
  const [scoringFormat, setScoringFormat] = useState<ScoringFormat>(
    existingRoster?.scoringFormat ?? 'yahoo'
  );
  const [addedPlayers, setAddedPlayers] = useState<FantasyPlayer[]>(
    existingRoster?.players ?? []
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, first_name, last_name, current_team_abbrev, position_code')
        .ilike('last_name', `%${query}%`)
        .limit(20);

      if (!error && data) {
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleAddPlayer = useCallback((result: SearchResult) => {
    const alreadyAdded = addedPlayers.some(p => p.playerId === result.id);
    if (alreadyAdded) return;

    const player: FantasyPlayer = {
      playerId: result.id,
      playerName: `${result.first_name} ${result.last_name}`,
      teamAbbrev: result.current_team_abbrev ?? '',
      position: result.position_code ?? '',
      rosterPosition: 'BN',
    };

    setAddedPlayers(prev => [...prev, player]);
    setSearchQuery('');
    setSearchResults([]);
  }, [addedPlayers]);

  const handleRemovePlayer = useCallback((playerId: number) => {
    setAddedPlayers(prev => prev.filter(p => p.playerId !== playerId));
  }, []);

  const handleSave = useCallback(async () => {
    if (addedPlayers.length === 0) return;
    setSaving(true);
    try {
      if (existingRoster) {
        await updateRoster({
          ...existingRoster,
          scoringFormat,
          players: addedPlayers,
        });
      } else {
        await saveRoster({
          name: 'My Team',
          scoringFormat,
          players: addedPlayers,
        });
      }
      onSaved();
    } catch (error) {
      console.warn('[ROSTER_BUILDER] Error saving roster:', error);
    } finally {
      setSaving(false);
    }
  }, [addedPlayers, scoringFormat, existingRoster, onSaved]);

  const renderSearchResult = useCallback(({ item }: { item: SearchResult }) => {
    const alreadyAdded = addedPlayers.some(p => p.playerId === item.id);
    return (
      <TouchableOpacity
        style={[styles.resultRow, alreadyAdded && styles.resultRowDisabled]}
        onPress={() => handleAddPlayer(item)}
        disabled={alreadyAdded}
        testID={`search-result-${item.id}`}
      >
        <Text style={styles.resultName}>
          {item.first_name} {item.last_name}
        </Text>
        <Text style={styles.resultMeta}>
          {item.current_team_abbrev} {'\u2022'} {item.position_code}
        </Text>
        {alreadyAdded && (
          <Ionicons name="checkmark-circle" size={18} color={rinkGlass.faceoffDot} />
        )}
      </TouchableOpacity>
    );
  }, [addedPlayers, handleAddPlayer]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
      testID="roster-builder-modal"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onDismiss} testID="roster-builder-cancel">
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {existingRoster ? 'Edit Roster' : 'Build Roster'}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={addedPlayers.length === 0 || saving}
            testID="roster-builder-save"
          >
            <Text
              style={[
                styles.saveText,
                (addedPlayers.length === 0 || saving) && styles.saveTextDisabled,
              ]}
            >
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Scoring Format Selector */}
        <View style={styles.formatRow}>
          <TouchableOpacity
            style={[styles.formatButton, scoringFormat === 'yahoo' && styles.formatActive]}
            onPress={() => setScoringFormat('yahoo')}
            testID="format-yahoo"
          >
            <Text
              style={[styles.formatText, scoringFormat === 'yahoo' && styles.formatTextActive]}
            >
              Yahoo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.formatButton, scoringFormat === 'espn' && styles.formatActive]}
            onPress={() => setScoringFormat('espn')}
            testID="format-espn"
          >
            <Text
              style={[styles.formatText, scoringFormat === 'espn' && styles.formatTextActive]}
            >
              ESPN
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={rinkGlass.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search players by name..."
            placeholderTextColor={rinkGlass.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
            testID="roster-search-input"
            autoCorrect={false}
          />
        </View>

        {/* Added Players Chips */}
        {addedPlayers.length > 0 && (
          <View style={styles.chipsContainer} testID="added-players-chips">
            {addedPlayers.map(player => (
              <TouchableOpacity
                key={player.playerId}
                style={styles.chip}
                onPress={() => handleRemovePlayer(player.playerId)}
                testID={`chip-${player.playerId}`}
              >
                <Text style={styles.chipText}>{player.playerName}</Text>
                <Ionicons name="close-circle" size={14} color={rinkGlass.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Search Results */}
        {searching ? (
          <ActivityIndicator color={rinkGlass.blueLight} style={styles.loader} />
        ) : (
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={item => String(item.id)}
            style={styles.resultsList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              searchQuery.length >= 2 ? (
                <Text style={styles.emptyText}>No players found</Text>
              ) : null
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: rinkGlass.ice,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: rinkGlass.glassBorder,
  },
  cancelText: {
    fontSize: 16,
    color: rinkGlass.textSecondary,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: rinkGlass.fonts.display,
    color: rinkGlass.textPrimary,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: rinkGlass.blueLight,
  },
  saveTextDisabled: {
    opacity: 0.4,
  },
  formatRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  formatButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: rinkGlass.glass,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  formatActive: {
    backgroundColor: rinkGlass.blueLight,
    borderColor: rinkGlass.blueLight,
  },
  formatText: {
    fontSize: 14,
    fontWeight: '600',
    color: rinkGlass.textSecondary,
  },
  formatTextActive: {
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: rinkGlass.boards,
    borderRadius: 10,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: rinkGlass.textPrimary,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: rinkGlass.zamboni,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  chipText: {
    fontSize: 13,
    color: rinkGlass.textPrimary,
  },
  resultsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: rinkGlass.glassBorder,
  },
  resultRowDisabled: {
    opacity: 0.5,
  },
  resultName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: rinkGlass.textPrimary,
  },
  resultMeta: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
    marginRight: 8,
  },
  loader: {
    marginTop: 24,
  },
  emptyText: {
    fontSize: 14,
    color: rinkGlass.textSecondary,
    textAlign: 'center',
    marginTop: 24,
  },
});
