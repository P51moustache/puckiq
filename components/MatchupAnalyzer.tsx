/**
 * MatchupAnalyzer
 *
 * Compare two fantasy rosters category-by-category.
 * Opponent players are added via search (same pattern as RosterBuilder).
 * Shows colored comparison bars per category with swap suggestions.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { analyzeMatchup, CategoryResult, MatchupResult } from '../services/matchupAnalysis';
import type { ScoringFormat } from '../types/fantasy';

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const EDGE_COLORS = {
  winning: '#10b981',
  losing: '#ef4444',
  close: '#fbbf24',
} as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MatchupAnalyzerProps {
  myPlayerIds: number[];
  scoringFormat: ScoringFormat;
  gameDate: string;
}

interface SearchResult {
  id: number;
  first_name: string;
  last_name: string;
  current_team_abbrev: string;
  position_code: string;
}

interface OppPlayer {
  playerId: number;
  playerName: string;
  teamAbbrev: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MatchupAnalyzer({
  myPlayerIds,
  scoringFormat,
  gameDate,
}: MatchupAnalyzerProps) {
  const [oppPlayers, setOppPlayers] = useState<OppPlayer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<MatchupResult | null>(null);

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

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

  const handleAddPlayer = useCallback((item: SearchResult) => {
    if (oppPlayers.some(p => p.playerId === item.id)) return;
    setOppPlayers(prev => [
      ...prev,
      {
        playerId: item.id,
        playerName: `${item.first_name} ${item.last_name}`,
        teamAbbrev: item.current_team_abbrev ?? '',
      },
    ]);
    setSearchQuery('');
    setSearchResults([]);
  }, [oppPlayers]);

  const handleRemovePlayer = useCallback((playerId: number) => {
    setOppPlayers(prev => prev.filter(p => p.playerId !== playerId));
    setResult(null); // clear stale results
  }, []);

  // -------------------------------------------------------------------------
  // Analyze
  // -------------------------------------------------------------------------

  const handleAnalyze = useCallback(async () => {
    if (oppPlayers.length === 0) return;
    setAnalyzing(true);
    try {
      const oppIds = oppPlayers.map(p => p.playerId);
      const matchupResult = await analyzeMatchup(myPlayerIds, oppIds, scoringFormat, gameDate);
      setResult(matchupResult);
    } catch (err) {
      console.warn('[MATCHUP_ANALYZER] Analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  }, [oppPlayers, myPlayerIds, scoringFormat, gameDate]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const renderCategoryBar = (cat: CategoryResult) => {
    const total = cat.myTotal + cat.oppTotal;
    const myPct = total > 0 ? (cat.myTotal / total) * 100 : 50;
    const color = EDGE_COLORS[cat.edge];

    return (
      <View key={cat.category} style={styles.categoryRow} testID={`category-${cat.category}`}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryLabel}>{cat.category}</Text>
          <View style={[styles.edgeBadge, { backgroundColor: color + '22' }]}>
            <Text style={[styles.edgeText, { color }]}>
              {cat.edge === 'winning' ? 'W' : cat.edge === 'losing' ? 'L' : 'Close'}
            </Text>
          </View>
        </View>

        <View style={styles.barContainer}>
          <View style={[styles.barMy, { width: `${myPct}%`, backgroundColor: color }]} />
        </View>

        <View style={styles.totalsRow}>
          <Text style={styles.totalText}>{cat.myTotal.toFixed(1)}</Text>
          <Text style={styles.totalTextOpp}>{cat.oppTotal.toFixed(1)}</Text>
        </View>

        {cat.swingPlayers && cat.swingPlayers.length > 0 && (
          <Text style={styles.swingText}>
            Swing: {cat.swingPlayers.join(', ')}
          </Text>
        )}
      </View>
    );
  };

  const renderSearchResult = useCallback(({ item }: { item: SearchResult }) => {
    const alreadyAdded = oppPlayers.some(p => p.playerId === item.id);
    return (
      <TouchableOpacity
        style={[styles.resultRow, alreadyAdded && styles.resultRowDisabled]}
        onPress={() => handleAddPlayer(item)}
        disabled={alreadyAdded}
        testID={`opp-search-result-${item.id}`}
      >
        <Text style={styles.resultName}>
          {item.first_name} {item.last_name}
        </Text>
        <Text style={styles.resultMeta}>
          {item.current_team_abbrev} {'\u2022'} {item.position_code}
        </Text>
        {alreadyAdded && (
          <Ionicons name="checkmark-circle" size={18} color="#10b981" />
        )}
      </TouchableOpacity>
    );
  }, [oppPlayers, handleAddPlayer]);

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <ScrollView style={styles.container} testID="matchup-analyzer">
      {/* Header */}
      <Text style={styles.title}>Matchup Analyzer</Text>
      <Text style={styles.subtitle}>
        Add your opponent's players to compare projected categories.
      </Text>

      {/* Opponent Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={theme.subtext} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search opponent players..."
          placeholderTextColor={theme.subtext}
          value={searchQuery}
          onChangeText={handleSearch}
          testID="matchup-search-input"
          autoCorrect={false}
        />
      </View>

      {/* Search Results */}
      {searching ? (
        <ActivityIndicator color={theme.accent} style={styles.loader} testID="search-loader" />
      ) : searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={item => String(item.id)}
          style={styles.resultsList}
          scrollEnabled={false}
          keyboardShouldPersistTaps="handled"
        />
      ) : null}

      {/* Opponent Chips */}
      {oppPlayers.length > 0 && (
        <View style={styles.chipsContainer} testID="opp-players-chips">
          {oppPlayers.map(player => (
            <TouchableOpacity
              key={player.playerId}
              style={styles.chip}
              onPress={() => handleRemovePlayer(player.playerId)}
              testID={`opp-chip-${player.playerId}`}
            >
              <Text style={styles.chipText}>{player.playerName}</Text>
              <Ionicons name="close-circle" size={14} color={theme.subtext} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Analyze Button */}
      <TouchableOpacity
        style={[styles.analyzeButton, oppPlayers.length === 0 && styles.analyzeButtonDisabled]}
        onPress={handleAnalyze}
        disabled={oppPlayers.length === 0 || analyzing}
        testID="analyze-button"
      >
        {analyzing ? (
          <ActivityIndicator color="#fff" size="small" testID="analyze-loader" />
        ) : (
          <Text style={styles.analyzeButtonText}>Analyze Matchup</Text>
        )}
      </TouchableOpacity>

      {/* Results */}
      {result && (
        <View style={styles.resultsContainer} testID="matchup-results">
          {/* Score Summary */}
          <View style={styles.scoreRow}>
            <View style={styles.scoreBox}>
              <Text style={[styles.scoreValue, { color: EDGE_COLORS.winning }]}>
                {result.myWins}
              </Text>
              <Text style={styles.scoreLabel}>Winning</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={[styles.scoreValue, { color: EDGE_COLORS.close }]}>
                {result.closeCategories}
              </Text>
              <Text style={styles.scoreLabel}>Close</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={[styles.scoreValue, { color: EDGE_COLORS.losing }]}>
                {result.oppWins}
              </Text>
              <Text style={styles.scoreLabel}>Losing</Text>
            </View>
          </View>

          {/* Category Bars */}
          {result.categories.map(renderCategoryBar)}

          {/* Recommendation */}
          <View style={styles.recommendationBox}>
            <Ionicons name="bulb-outline" size={18} color={theme.accent} />
            <Text style={styles.recommendationText}>{result.recommendation}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: theme.subtext,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: theme.text,
  },
  resultsList: {
    maxHeight: 200,
    marginBottom: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  resultRowDisabled: {
    opacity: 0.5,
  },
  resultName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: theme.text,
  },
  resultMeta: {
    fontSize: 13,
    color: theme.subtext,
    marginRight: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.factbox,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  chipText: {
    fontSize: 13,
    color: theme.text,
  },
  analyzeButton: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  analyzeButtonDisabled: {
    opacity: 0.4,
  },
  analyzeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  loader: {
    marginVertical: 12,
  },
  resultsContainer: {
    marginBottom: 32,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
  },
  scoreBox: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 12,
    color: theme.subtext,
    marginTop: 2,
  },
  categoryRow: {
    backgroundColor: theme.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  edgeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  edgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  barContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  barMy: {
    height: '100%',
    borderRadius: 4,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
  },
  totalTextOpp: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.subtext,
  },
  swingText: {
    fontSize: 11,
    color: '#fbbf24',
    marginTop: 4,
    fontStyle: 'italic',
  },
  recommendationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.factbox,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginTop: 8,
  },
  recommendationText: {
    flex: 1,
    fontSize: 13,
    color: theme.text,
    lineHeight: 19,
  },
});
