import { View, Text, StyleSheet } from 'react-native';
import { theme, rinkGlass } from '../constants/theme';
import { FactorType } from '../types/factors';

interface FactorRanking {
  type: FactorType;
  name: string;
  accuracy: number; // 0-100
  gamesAnalyzed: number;
}

interface FactorLeaderboardProps {
  rankings?: FactorRanking[];
  season?: string;
}

export function FactorLeaderboard({
  rankings,
  season = '2025-26'
}: FactorLeaderboardProps) {
  if (!rankings || rankings.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Factor Leaderboard</Text>
          <Text style={styles.season}>{season}</Text>
        </View>
        <Text style={styles.subtitle}>
          Which factors actually predict winners?
        </Text>
        <Text style={{ fontSize: 13, color: theme.subtext, fontStyle: 'italic', textAlign: 'center', paddingVertical: 24 }}>
          Factor accuracy tracking coming soon. Make picks to build data!
        </Text>
      </View>
    );
  }
  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 60) return '#22c55e'; // green - strong predictor
    if (accuracy >= 55) return '#f59e0b'; // amber - moderate
    if (accuracy >= 50) return theme.subtext; // neutral
    return '#ef4444'; // red - below coin flip
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Factor Leaderboard</Text>
        <Text style={styles.season}>{season}</Text>
      </View>

      <Text style={styles.subtitle}>
        Which factors actually predict winners?
      </Text>

      <View style={styles.list}>
        {rankings.map((ranking, index) => (
          <View key={ranking.type} style={styles.row}>
            <View style={styles.rankContainer}>
              <Text style={[
                styles.rank,
                index < 3 && styles.topRank
              ]}>
                {index + 1}
              </Text>
            </View>
            <View style={styles.factorInfo}>
              <Text style={styles.factorName}>{ranking.name}</Text>
              <Text style={styles.gamesAnalyzed}>
                {ranking.gamesAnalyzed} games
              </Text>
            </View>
            <View style={styles.accuracyContainer}>
              <Text style={[
                styles.accuracy,
                { color: getAccuracyColor(ranking.accuracy) }
              ]}>
                {ranking.accuracy}%
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendText}>
          50% = coin flip · Higher = more predictive
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    fontFamily: 'Display-Bold',
  },
  season: {
    fontSize: 12,
    color: theme.subtext,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    color: theme.subtext,
    marginBottom: 16,
  },
  list: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.subtle,
  },
  rankContainer: {
    width: 28,
    alignItems: 'center',
  },
  rank: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.subtext,
  },
  topRank: {
    color: theme.accent,
    fontWeight: '700',
  },
  factorInfo: {
    flex: 1,
    marginLeft: 8,
  },
  factorName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  gamesAnalyzed: {
    fontSize: 11,
    color: theme.subtext,
    marginTop: 2,
  },
  accuracyContainer: {
    width: 50,
    alignItems: 'flex-end',
  },
  accuracy: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Display-Bold',
  },
  legend: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.subtle,
    alignItems: 'center',
  },
  legendText: {
    fontSize: 11,
    color: theme.subtext,
    fontStyle: 'italic',
  },
});
