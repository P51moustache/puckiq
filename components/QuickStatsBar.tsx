import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import type { EdgeQuickStats } from '../types/edgeStats';

interface QuickStatsBarProps {
  gameCount: number;
  closeMatchups: number;
  divisionBattles: number;
  edgeStats?: EdgeQuickStats | null;
}

interface StatPill {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}

function QuickStatsBarComponent({ gameCount, closeMatchups, divisionBattles, edgeStats }: QuickStatsBarProps) {
  if (gameCount === 0) return null;

  let pills: StatPill[];

  if (edgeStats?.topShotSpeed || edgeStats?.hottestMomentum || edgeStats?.biggestFatigueMismatch) {
    pills = [
      {
        icon: 'flash',
        value: edgeStats.topShotSpeed ? `${edgeStats.topShotSpeed.value.toFixed(0)}mph` : `${gameCount}`,
        label: edgeStats.topShotSpeed ? 'Top Shot' : 'Games',
      },
      {
        icon: 'flame',
        value: edgeStats.hottestMomentum ? `+${edgeStats.hottestMomentum.value}` : `${closeMatchups}`,
        label: edgeStats.hottestMomentum ? 'Momentum' : 'Close',
      },
      {
        icon: 'fitness',
        value: edgeStats.biggestFatigueMismatch ? `${edgeStats.biggestFatigueMismatch.value}%` : `${divisionBattles}`,
        label: edgeStats.biggestFatigueMismatch ? 'Rest Edge' : 'Division',
      },
    ];
  } else {
    pills = [
      { icon: 'ellipse', value: `${gameCount}`, label: 'Games' },
      { icon: 'flash', value: `${closeMatchups}`, label: 'Close' },
      { icon: 'flame', value: `${divisionBattles}`, label: 'Division' },
    ];
  }

  return (
    <Animated.View
      testID="quick-stats-bar"
      entering={FadeIn.duration(300)}
      style={styles.container}
    >
      {pills.map((pill) => (
        <View key={pill.label} testID={`quick-stat-${pill.label.toLowerCase()}`} style={styles.pill}>
          <Ionicons name={pill.icon} size={12} color={theme.accent} style={styles.icon} />
          <Text style={styles.value}>{pill.value}</Text>
          <Text style={styles.label}>{pill.label}</Text>
        </View>
      ))}
    </Animated.View>
  );
}

export default QuickStatsBarComponent;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 4,
  },
  icon: {
    marginRight: 2,
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  label: {
    fontSize: 11,
    color: theme.subtext,
  },
});
