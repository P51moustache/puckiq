import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { theme } from '../constants/theme';

interface LiveNowBarProps {
  games: any[];
  onGamePress: (game: any) => void;
}

function formatLiveScore(game: any): string {
  const away = game.awayTeam?.abbrev ?? '???';
  const home = game.homeTeam?.abbrev ?? '???';
  const awayScore = game.awayTeam?.score ?? 0;
  const homeScore = game.homeTeam?.score ?? 0;
  const period = game.period ?? '';
  const clock = game.clock?.timeRemaining ?? '';

  let periodLabel = '';
  if (period) {
    periodLabel = period <= 3 ? `P${period}` : 'OT';
  }

  const clockStr = clock && periodLabel ? `${periodLabel} ${clock}` : periodLabel;
  return `${away} ${awayScore} - ${home} ${homeScore}  ${clockStr}`.trim();
}

function PulsingDot() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 750 }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.dot, animatedStyle]} />
  );
}

function LiveScoreChip({ game, onPress }: { game: any; onPress: () => void }) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      testID={`live-game-${game.id}`}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.93, { damping: 15, stiffness: 150 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 150 }); }}
    >
      <Animated.View style={[styles.scoreChip, pressStyle]}>
        <Text style={styles.scoreText}>{formatLiveScore(game)}</Text>
      </Animated.View>
    </Pressable>
  );
}

function LiveNowBarComponent({ games, onGamePress }: LiveNowBarProps) {
  const liveGames = games.filter(
    (g: any) => g.gameState === 'LIVE' || g.gameState === 'CRIT',
  );

  if (liveGames.length === 0) return null;

  return (
    <Animated.View
      testID="live-now-bar"
      entering={FadeIn.duration(200)}
      style={styles.container}
    >
      <View style={styles.labelRow}>
        <PulsingDot />
        <Text style={styles.liveLabel}>LIVE NOW</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {liveGames.map((game: any) => (
          <LiveScoreChip
            key={String(game.id)}
            game={game}
            onPress={() => onGamePress(game)}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

export default LiveNowBarComponent;

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    marginRight: 6,
  },
  liveLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ef4444',
    letterSpacing: 1.2,
  },
  scrollContent: {
    gap: 12,
    alignItems: 'center',
  },
  scoreChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.text,
    fontFamily: theme.fonts.mono,
    fontVariant: ['tabular-nums'],
  },
});
