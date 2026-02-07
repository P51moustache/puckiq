import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { theme } from '../constants/theme';
import { getTeamLogoUrl } from '../utils/teamLogo';

interface LiveNowBarProps {
  games: any[];
  onGamePress: (game: any) => void;
}

function getLiveScoreData(game: any) {
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
  return { away, home, awayScore, homeScore, clockStr };
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
        {(() => {
          const d = getLiveScoreData(game);
          return (
            <View style={styles.chipContent}>
              <Image source={{ uri: getTeamLogoUrl(d.away) }} style={styles.chipLogo} contentFit="contain" />
              <Text style={styles.scoreText}>{d.away} {d.awayScore} - {d.home} {d.homeScore}</Text>
              <Image source={{ uri: getTeamLogoUrl(d.home) }} style={styles.chipLogo} contentFit="contain" />
              {d.clockStr ? <Text style={styles.clockText}>{d.clockStr}</Text> : null}
            </View>
          );
        })()}
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
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipLogo: {
    width: 16,
    height: 16,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.text,
    fontFamily: theme.fonts.mono,
    fontVariant: ['tabular-nums'],
  },
  clockText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.subtext,
    fontFamily: theme.fonts.mono,
    marginLeft: 2,
  },
});
