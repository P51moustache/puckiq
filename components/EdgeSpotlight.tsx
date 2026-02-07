import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import { getTeamLogoUrl } from '../utils/teamLogo';
import type { TeamPlayerStats, PlayerStatLine } from '../types/gameResults';
import type {
  EdgeSkaterLanding,
  EdgeTeamLanding,
} from '../types/edgeStats';

interface EdgeSpotlightProps {
  playerStatsMap: Map<string, TeamPlayerStats>;
  games: any[];
  skaterLanding: EdgeSkaterLanding | null;
  teamLanding: EdgeTeamLanding | null;
}

interface SpotlightItem {
  key: string;
  category: string;
  label: string;
  value: string;
  teamAbbrev: string;
}

function buildSpotlightItems(
  playerStatsMap: Map<string, TeamPlayerStats>,
  games: any[],
  skaterLanding: EdgeSkaterLanding | null,
  teamLanding: EdgeTeamLanding | null,
): SpotlightItem[] {
  const items: SpotlightItem[] = [];

  // Hot Players (top 3)
  const todayTeams = new Set<string>();
  for (const game of games) {
    if (game.homeTeam?.abbrev) todayTeams.add(game.homeTeam.abbrev);
    if (game.awayTeam?.abbrev) todayTeams.add(game.awayTeam.abbrev);
  }

  const playerCandidates: { name: string; teamAbbrev: string; points: number; goals: number; assists: number; isHot: boolean }[] = [];
  for (const [abbrev, stats] of playerStatsMap) {
    if (!todayTeams.has(abbrev) || !stats.skaters?.length) continue;
    const topSkaters = stats.skaters
      .sort((a: PlayerStatLine, b: PlayerStatLine) => b.points - a.points)
      .slice(0, 2);
    for (const skater of topSkaters) {
      playerCandidates.push({
        name: `${skater.firstName.charAt(0)}.${skater.lastName}`,
        teamAbbrev: abbrev,
        points: skater.points,
        goals: skater.goals,
        assists: skater.assists,
        isHot: skater.gamesPlayed > 0 && skater.goals / skater.gamesPlayed > 0.5,
      });
    }
  }
  const topPlayers = playerCandidates.sort((a, b) => b.points - a.points).slice(0, 3);
  for (const p of topPlayers) {
    items.push({
      key: `player-${p.teamAbbrev}-${p.name}`,
      category: p.isHot ? 'HOT PLAYER' : 'TOP SCORER',
      label: p.name,
      value: `${p.points} pts`,
      teamAbbrev: p.teamAbbrev,
    });
  }

  // Edge Stats (up to 3)
  if (skaterLanding?.hardestShot) {
    const speed = skaterLanding.hardestShot.shotSpeed?.imperial?.speed;
    const name = skaterLanding.hardestShot.player?.lastName?.default;
    const team = skaterLanding.hardestShot.player?.team?.abbrev;
    if (speed && name && team) {
      items.push({
        key: 'edge-shot-speed',
        category: 'SHOT SPEED',
        label: name,
        value: `${speed.toFixed(0)} mph`,
        teamAbbrev: team,
      });
    }
  }

  if (skaterLanding?.maxSkatingSpeed) {
    const speed = skaterLanding.maxSkatingSpeed.skatingSpeed?.imperial?.speed;
    const name = skaterLanding.maxSkatingSpeed.player?.lastName?.default;
    const team = skaterLanding.maxSkatingSpeed.player?.team?.abbrev;
    if (speed && name && team) {
      items.push({
        key: 'edge-skating-speed',
        category: 'SKATING SPEED',
        label: name,
        value: `${speed.toFixed(1)} mph`,
        teamAbbrev: team,
      });
    }
  }

  if (teamLanding?.shotAttemptsOver90) {
    const team = teamLanding.shotAttemptsOver90.team?.abbrev;
    const value = teamLanding.shotAttemptsOver90.value;
    if (team && value) {
      items.push({
        key: 'edge-shots-90',
        category: 'SHOTS >90mph',
        label: `#1 League`,
        value: `${value}`,
        teamAbbrev: team,
      });
    }
  }

  // Interleave: player, edge, player, edge, player, edge
  const players = items.filter(i => i.key.startsWith('player-'));
  const edges = items.filter(i => i.key.startsWith('edge-'));
  const interleaved: SpotlightItem[] = [];
  const maxLen = Math.max(players.length, edges.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < players.length) interleaved.push(players[i]);
    if (i < edges.length) interleaved.push(edges[i]);
  }

  return interleaved.slice(0, 5);
}

export default function EdgeSpotlight({
  playerStatsMap,
  games,
  skaterLanding,
  teamLanding,
}: EdgeSpotlightProps) {
  const router = useRouter();
  const items = buildSpotlightItems(playerStatsMap, games, skaterLanding, teamLanding);

  if (items.length === 0) return null;

  const renderCard = ({ item, index }: { item: SpotlightItem; index: number }) => {
    const teamColor = getTeamColors(item.teamAbbrev).primary;

    return (
      <Animated.View entering={FadeInRight.duration(300).delay(index * 70)}>
        <View testID={`spotlight-card-${item.key}`} style={styles.card}>
          <View style={[styles.topAccent, { backgroundColor: teamColor }]} />
          <View style={styles.cardContent}>
            <Text style={styles.category}>{item.category}</Text>
            <Text style={styles.value} numberOfLines={1}>{item.value}</Text>
            <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
            <View style={styles.teamRow}>
              <Image source={{ uri: getTeamLogoUrl(item.teamAbbrev) }} style={styles.teamLogoSmall} contentFit="contain" />
              <Text style={[styles.teamLabel, { color: teamColor }]}>{item.teamAbbrev}</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderSeeAll = () => (
    <Pressable
      testID="spotlight-see-all"
      onPress={() => router.push('/stats')}
      style={({ pressed }) => [
        styles.seeAllCard,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={styles.seeAllText}>See All{'\n'}Edge Stats</Text>
      <Text style={styles.seeAllArrow}>→</Text>
    </Pressable>
  );

  return (
    <View testID="edge-spotlight" style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Edge Spotlight</Text>
        <View style={styles.headerAccent} />
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={renderCard}
        ListFooterComponent={renderSeeAll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    width: '100%',
  },
  headerRow: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  header: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerAccent: {
    width: 32,
    height: 2,
    backgroundColor: theme.accent,
    borderRadius: 1,
    marginTop: 4,
    opacity: 0.6,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  card: {
    width: 150,
    height: 130,
    backgroundColor: theme.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  topAccent: {
    height: 4,
    width: '100%',
  },
  cardContent: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  category: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.subtext,
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.text,
    letterSpacing: -0.5,
    fontFamily: theme.fonts.mono,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.text,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teamLogoSmall: {
    width: 16,
    height: 16,
  },
  teamLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  seeAllCard: {
    width: 100,
    height: 130,
    backgroundColor: theme.subtle,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.12)',
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.accent,
    textAlign: 'center',
    lineHeight: 18,
  },
  seeAllArrow: {
    fontSize: 18,
    color: theme.accent,
    marginTop: 4,
  },
});
