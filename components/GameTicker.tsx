import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { theme } from '../constants/theme';
import { getTeamColors, getAccessibleTextColor } from '../constants/teamColors';

interface GameTickerProps {
  games: any[];
  predictions: Map<string, { homeWinProb: number; awayWinProb: number }>;
  h2hMap: Map<string, any>;
  onGamePress: (game: any) => void;
}

function getConfidenceColor(score: number): string {
  if (score >= 85) return '#FFB81C';
  if (score >= 70) return '#22c55e';
  if (score >= 55) return '#60a5fa';
  return '#98a6bf';
}

function getCapsuleInsight(game: any, prediction: any, h2hMap: Map<string, any>): string {
  const h2hKey = `${game.awayTeam?.abbrev}-${game.homeTeam?.abbrev}`;
  const h2h = h2hMap.get(h2hKey);
  if (h2h) {
    return `Series: ${h2h.teamAWins ?? 0}-${h2h.teamBWins ?? 0}`;
  }
  if (game.streak) return game.streak;
  if (prediction) {
    const conf = Math.round(Math.max(prediction.homeWinProb, prediction.awayWinProb));
    return `${conf}% edge`;
  }
  return '50% edge';
}

export default function GameTicker({ games, predictions, h2hMap, onGamePress }: GameTickerProps) {
  if (!games || games.length === 0) return null;

  const renderCapsule = ({ item: game, index }: { item: any; index: number }) => {
    const pred = predictions.get(String(game.id)) ?? { homeWinProb: 50, awayWinProb: 50 };
    const homeProb = pred.homeWinProb;
    const awayProb = pred.awayWinProb;
    const confScore = Math.round(Math.max(homeProb, awayProb));
    const favoredIsHome = homeProb >= awayProb;
    const favoredAbbrev = favoredIsHome ? game.homeTeam?.abbrev : game.awayTeam?.abbrev;
    const fillColor = getTeamColors(favoredAbbrev ?? '').primary;
    const insight = getCapsuleInsight(game, pred, h2hMap);

    return (
      <Animated.View entering={FadeInRight.duration(300).delay(200 + index * 50)}>
        <Pressable
          onPress={() => onGamePress(game)}
          style={({ pressed }) => [styles.capsule, pressed && { transform: [{ scale: 0.96 }] }]}
        >
          <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor(confScore) }]} />
          <Text style={styles.teamNames}>
            <Text style={{ color: getAccessibleTextColor(game.awayTeam?.abbrev ?? '???') }}>{game.awayTeam?.abbrev ?? '???'}</Text>
            {' | '}
            <Text style={{ color: getAccessibleTextColor(game.homeTeam?.abbrev ?? '???') }}>{game.homeTeam?.abbrev ?? '???'}</Text>
          </Text>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${Math.round(homeProb)}%`, backgroundColor: fillColor }]} />
          </View>
          <Text style={styles.insight} numberOfLines={1}>{insight}</Text>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View>
      <Text style={styles.header}>TONIGHT'S GAMES</Text>
      <FlatList
        horizontal
        data={games}
        keyExtractor={(g) => String(g.id)}
        renderItem={renderCapsule}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.subtext,
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  capsule: {
    width: 140,
    height: 72,
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.1)',
    justifyContent: 'space-between',
  },
  teamNames: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
    textAlign: 'center',
  },
  barBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    width: '100%',
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  insight: {
    fontSize: 10,
    color: theme.subtext,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    top: 8,
    right: 8,
  },
});
