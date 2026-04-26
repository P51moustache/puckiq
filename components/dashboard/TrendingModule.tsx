import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
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
  const rotation = useSharedValue(0);
  const totalPoints = +player.recentPoints.reduce((a, b) => a + b, 0).toFixed(1);
  const last3Avg = player.recentPoints.length > 0
    ? +(totalPoints / player.recentPoints.length).toFixed(1)
    : 0;

  const handleFlip = () => {
    rotation.value = withTiming(rotation.value === 0 ? 180 : 0, {
      duration: 400,
    });
  };

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${rotation.value}deg` }],
    backfaceVisibility: 'hidden' as const,
    opacity: interpolate(rotation.value, [0, 90, 91, 180], [1, 1, 0, 0]),
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${rotation.value + 180}deg` }],
    backfaceVisibility: 'hidden' as const,
    opacity: interpolate(rotation.value, [0, 89, 90, 180], [0, 0, 1, 1]),
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  }));

  return (
    <TouchableOpacity
      testID={`card-${player.id}`}
      activeOpacity={1}
      onPress={handleFlip}
    >
      <View style={styles.cardWrapper}>
        <Animated.View style={[styles.card, frontStyle]}>
          <View style={styles.cardHeader}>
            <Text style={styles.playerName} numberOfLines={1}>
              {player.name}
            </Text>
            <Text
              testID={`trend-${player.id}`}
              style={[
                styles.trendIndicator,
                { color: TREND_COLORS[player.trend] },
              ]}
            >
              {TREND_SYMBOLS[player.trend]}
            </Text>
          </View>

          <Text style={styles.teamLabel}>{player.team}</Text>

          <View testID={`flames-${player.id}`} style={styles.heatRow}>
            <Text style={styles.heatValue}>{totalPoints}</Text>
            <Text style={styles.heatLabel}>L{player.recentPoints.length} PTS</Text>
          </View>

          <View style={styles.sparklineRow}>
            <Sparkline
              data={player.recentPoints}
              width={132}
              height={22}
              color={rinkGlass.blueLight}
            />
          </View>
        </Animated.View>

        <Animated.View
          testID={`back-${player.id}`}
          style={[styles.cardBack, backStyle]}
        >
          <Text style={styles.backPlayerName}>{player.name}</Text>
          <Text style={styles.teamLabel}>{player.team}</Text>

          <View testID={`back-stats-${player.id}`} style={styles.backStatBlock}>
            <Text style={styles.backStatValue}>{totalPoints}</Text>
            <Text style={styles.backStatLabel}>Total · L{player.recentPoints.length}</Text>
          </View>

          <View style={styles.backStatBlock}>
            <Text style={styles.backStatValue}>{last3Avg}</Text>
            <Text style={styles.backStatLabel}>Avg / GP</Text>
          </View>

          <TouchableOpacity
            testID={`watch-${player.id}`}
            style={styles.watchButton}
            onPress={() => onWatch?.(player.id)}
          >
            <Text style={styles.watchButtonText}>Watch</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
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
    backgroundColor: rinkGlass.blueLight,
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
  cardWrapper: {
    width: 160,
    height: 140,
    marginHorizontal: 4,
    position: 'relative',
  },
  card: {
    width: 160,
    height: 140,
    backgroundColor: rinkGlass.glass,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    borderRadius: 12,
    padding: 12,
  },
  cardBack: {
    width: 160,
    height: 140,
    backgroundColor: rinkGlass.boards,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    borderRadius: 12,
    padding: 12,
    justifyContent: 'space-between',
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
  heatRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 8,
  },
  heatValue: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 22,
    color: rinkGlass.textPrimary,
    letterSpacing: 0.5,
  },
  heatLabel: {
    fontSize: 10,
    color: rinkGlass.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sparklineRow: {
    marginTop: 4,
  },
  backPlayerName: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 14,
    color: rinkGlass.textPrimary,
  },
  backStatBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  backStatValue: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 18,
    color: rinkGlass.textPrimary,
  },
  backStatLabel: {
    fontSize: 10,
    color: rinkGlass.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  watchButton: {
    backgroundColor: rinkGlass.blueLight,
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
