import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import FantasyProjectionRow from './FantasyProjectionRow';
import { getWaiverWireRecommendations } from '../services/fantasyProjections';
import type { PlayerProjection, ScoringFormat } from '../types/fantasy';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POSITION_FILTERS = ['All', 'C', 'LW', 'RW', 'D', 'G'] as const;
type PositionFilter = typeof POSITION_FILTERS[number];

const WAIVER_LIMIT = 30;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WaiverWireScoutProps {
  /** Player IDs to exclude (user's roster) */
  excludePlayerIds?: number[];
  /** Scoring format */
  format?: ScoringFormat;
  /** Callback when a player is tapped */
  onPlayerPress?: (playerId: number) => void;
  /** Callback for back navigation */
  onBack?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WaiverWireScout({
  excludePlayerIds = [],
  format = 'yahoo',
  onPlayerPress,
  onBack,
}: WaiverWireScoutProps) {
  const [projections, setProjections] = useState<PlayerProjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('All');

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await getWaiverWireRecommendations(
        excludePlayerIds,
        format,
        today,
        WAIVER_LIMIT,
      );
      setProjections(data);
    } catch (err) {
      console.warn('[WaiverWireScout] Error loading projections:', err);
      setProjections([]);
    }
  }, [excludePlayerIds, format]);

  useEffect(() => {
    let mounted = true;
    async function init() {
      setLoading(true);
      await loadData();
      if (mounted) setLoading(false);
    }
    init();
    return () => { mounted = false; };
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------

  const filteredProjections = positionFilter === 'All'
    ? projections
    : projections.filter(p => p.position === positionFilter);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container} testID="waiver-wire-scout">
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton} testID="waiver-back">
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
        )}
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Waiver Wire Scout</Text>
          <Text style={styles.subtitle}>Top available pickups for today</Text>
        </View>
      </View>

      {/* Position filters */}
      <View style={styles.filterRow} testID="position-filters">
        {POSITION_FILTERS.map((pos) => (
          <TouchableOpacity
            key={pos}
            style={[
              styles.filterChip,
              positionFilter === pos && styles.filterChipActive,
            ]}
            onPress={() => setPositionFilter(pos)}
            testID={`filter-${pos}`}
          >
            <Text
              style={[
                styles.filterChipText,
                positionFilter === pos && styles.filterChipTextActive,
              ]}
            >
              {pos}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer} testID="waiver-loading">
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.loadingText}>Loading projections...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.accent}
            />
          }
          testID="waiver-scroll"
        >
          {filteredProjections.length > 0 ? (
            filteredProjections.map((proj) => (
              <FantasyProjectionRow
                key={proj.playerId}
                projection={proj}
                onPress={onPlayerPress}
              />
            ))
          ) : (
            <View style={styles.emptyContainer} testID="waiver-empty">
              <Ionicons name="search-outline" size={48} color={theme.subtext} />
              <Text style={styles.emptyTitle}>No Projections Available</Text>
              <Text style={styles.emptyText}>
                {positionFilter !== 'All'
                  ? `No ${positionFilter} projections available for today. Try a different position.`
                  : 'No projections available for today. Check back when games are scheduled.'}
              </Text>
            </View>
          )}

          {/* Bottom padding */}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.subtext,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterChipActive: {
    backgroundColor: theme.accent + '22',
    borderColor: theme.accent,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.subtext,
  },
  filterChipTextActive: {
    color: theme.accent,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: theme.subtext,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  emptyText: {
    fontSize: 14,
    color: theme.subtext,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
