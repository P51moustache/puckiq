import React, { useMemo } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import { getTeamLogoUrl } from '../utils/teamLogo';
import type { PlayerStatLine, TeamPlayerStats } from '../types/gameResults';
import type { NHLGameSummary } from '../types/predictions';

interface PlayerSpotlightCarouselProps {
  games: NHLGameSummary[];
  playerStatsMap: Map<string, TeamPlayerStats>;
}

interface SpotlightPlayer {
  key: string;
  name: string;
  points: number;
  goals: number;
  assists: number;
  teamAbbrev: string;
}

function buildSpotlightPlayers(
  games: NHLGameSummary[],
  playerStatsMap: Map<string, TeamPlayerStats>
): SpotlightPlayer[] {
  const candidates: SpotlightPlayer[] = [];

  for (const game of games) {
    const abbrevs = [game.awayTeam?.abbrev, game.homeTeam?.abbrev].filter(Boolean) as string[];
    for (const abbrev of abbrevs) {
      const teamStats = playerStatsMap.get(abbrev);
      if (!teamStats?.skaters) continue;

      const sorted = [...teamStats.skaters].sort((a, b) => b.points - a.points);
      const top2 = sorted.slice(0, 2);

      for (const p of top2) {
        const firstName = p.firstName ?? '';
        const lastName = p.lastName ?? '';
        const initial = firstName.charAt(0);
        const name = initial ? `${initial}. ${lastName}` : lastName;

        candidates.push({
          key: `${abbrev}-${p.playerId}`,
          name,
          points: p.points,
          goals: p.goals,
          assists: p.assists,
          teamAbbrev: abbrev,
        });
      }
    }
  }

  candidates.sort((a, b) => b.points - a.points);
  return candidates.slice(0, 5);
}

function PlayerSpotlightCarouselComponent({
  games,
  playerStatsMap,
}: PlayerSpotlightCarouselProps) {
  const router = useRouter();
  const players = useMemo(() => buildSpotlightPlayers(games, playerStatsMap), [games, playerStatsMap]);

  if (players.length === 0) return null;

  const renderPlayer = ({ item, index }: { item: SpotlightPlayer; index: number }) => {
    const colors = getTeamColors(item.teamAbbrev);

    return (
      <Animated.View entering={FadeInRight.duration(300).delay(index * 70)}>
        <View style={styles.card}>
          <LinearGradient
            colors={[`${colors.primary}26`, 'transparent']}
            style={styles.gradient}
          />
          <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.statNumber}>{item.points} pts</Text>
          <Text style={styles.statLine}>{item.goals}G {item.assists}A</Text>
          <View style={styles.teamRow}>
            <Image
              source={{ uri: getTeamLogoUrl(item.teamAbbrev) }}
              style={styles.teamLogo}
              contentFit="contain"
            />
            <Text style={styles.teamAbbrev}>{item.teamAbbrev}</Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderSeeAll = () => (
    <Animated.View entering={FadeInRight.duration(300).delay(players.length * 70)}>
      <Pressable
        onPress={() => router.push('/stats')}
        style={({ pressed }) => [styles.seeAllCard, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.seeAllText}>See All{'\n'}Players →</Text>
      </Pressable>
    </Animated.View>
  );

  return (
    <View testID="player-spotlight-carousel" style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>PLAYERS TO WATCH</Text>
        <View style={styles.accentBar} />
      </View>
      <FlatList
        horizontal
        data={players}
        keyExtractor={(p) => p.key}
        renderItem={renderPlayer}
        ListFooterComponent={renderSeeAll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      />
    </View>
  );
}

export default React.memo(PlayerSpotlightCarouselComponent);

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  headerRow: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  header: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  accentBar: {
    width: 32,
    height: 2,
    backgroundColor: theme.accent,
    opacity: 0.6,
    marginTop: 4,
  },
  card: {
    width: 140,
    height: 160,
    borderRadius: 16,
    padding: 12,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: theme.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  playerName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.text,
    fontFamily: theme.fonts.mono,
    textAlign: 'center',
  },
  statLine: {
    fontSize: 11,
    color: theme.subtext,
    textAlign: 'center',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teamLogo: {
    width: 24,
    height: 24,
  },
  teamAbbrev: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
  },
  seeAllCard: {
    width: 100,
    height: 160,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: theme.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accent,
    textAlign: 'center',
    lineHeight: 20,
  },
});
