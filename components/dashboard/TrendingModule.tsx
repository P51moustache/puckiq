import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { rinkGlass } from '../../constants/theme';
import { Sparkline } from '../Sparkline';

export interface TrendingPlayer {
  id: number;
  name: string;
  team: string;
  flameCount: number;
  recentPoints: number[];
  trend: 'up' | 'down' | 'stable';
}

interface TrendingModuleProps {
  players: TrendingPlayer[];
  onWatch?: (playerId: number) => void;
}

const TREND_SYMBOLS: Record<TrendingPlayer['trend'], string> = {
  up: '↑',
  down: '↓',
  stable: '→',
};

const TREND_COLORS: Record<TrendingPlayer['trend'], string> = {
  up: '#06d6a0',
  down: '#e63946',
  stable: rinkGlass.textSecondary,
};

function TrendingCard({
  player,
  onWatch,
}: {
  player: TrendingPlayer;
  onWatch?: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const flames = '🔥'.repeat(player.flameCount);

  return (
    <TouchableOpacity
      testID={`card-${player.id}`}
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => setExpanded((prev) => !prev)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.playerName} numberOfLines={1}>
          {player.name}
        </Text>
        <Text
          testID={`trend-${player.id}`}
          style={[styles.trendIndicator, { color: TREND_COLORS[player.trend] }]}
        >
          {TREND_SYMBOLS[player.trend]}
        </Text>
      </View>

      <Text style={styles.teamLabel}>{player.team}</Text>

      <Text testID={`flames-${player.id}`} style={styles.flames}>
        {flames}
      </Text>

      <View style={styles.sparklineRow}>
        <Sparkline
          data={player.recentPoints}
          width={80}
          height={20}
          color={rinkGlass.goalLight}
        />
      </View>

      {expanded && (
        <View testID={`expanded-${player.id}`} style={styles.expandedSection}>
          <Text style={styles.expandedLabel}>
            Last {player.recentPoints.length} games:{' '}
            {player.recentPoints.reduce((a, b) => a + b, 0)} pts
          </Text>
          <TouchableOpacity
            testID={`watch-${player.id}`}
            style={styles.watchButton}
            onPress={() => onWatch?.(player.id)}
          >
            <Text style={styles.watchButtonText}>Watch</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No trending players right now</Text>
    </View>
  );
}

export function TrendingModule({ players, onWatch }: TrendingModuleProps) {
  const renderItem = useCallback(
    ({ item }: { item: TrendingPlayer }) => (
      <TrendingCard player={item} onWatch={onWatch} />
    ),
    [onWatch]
  );

  const keyExtractor = useCallback(
    (item: TrendingPlayer) => String(item.id),
    []
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.accentStripe} />
        <Text style={styles.headerTitle}>Trending Now</Text>
      </View>

      <FlatList
        testID="trending-list"
        data={players}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={EmptyState}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  accentStripe: {
    width: 4,
    height: 20,
    backgroundColor: rinkGlass.goalLight,
    borderRadius: 2,
    marginRight: 8,
  },
  headerTitle: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 18,
    color: rinkGlass.textPrimary,
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 12,
  },
  card: {
    width: 160,
    backgroundColor: rinkGlass.glass,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerName: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 14,
    color: rinkGlass.textPrimary,
    flex: 1,
  },
  trendIndicator: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 4,
  },
  teamLabel: {
    fontSize: 11,
    color: rinkGlass.textSecondary,
    marginTop: 2,
  },
  flames: {
    fontSize: 12,
    marginTop: 6,
  },
  sparklineRow: {
    marginTop: 8,
  },
  expandedSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: rinkGlass.glassBorder,
  },
  expandedLabel: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
    marginBottom: 8,
  },
  watchButton: {
    backgroundColor: rinkGlass.goalLight,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
  },
  watchButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  emptyText: {
    color: rinkGlass.textSecondary,
    fontSize: 14,
  },
});
