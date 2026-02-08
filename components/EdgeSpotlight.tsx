import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
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

interface SpotlightProps {
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
  // Player-specific fields
  goals?: number;
  assists?: number;
  playerId?: number;
  headshotUrl?: string;
}

function getPlayerHeadshotUrl(playerId: number, teamAbbrev: string, headshotUrl?: string): string {
  if (headshotUrl) return headshotUrl;
  return `https://assets.nhle.com/mugs/nhl/20252026/${teamAbbrev}/${playerId}.png`;
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

  const playerCandidates: { name: string; teamAbbrev: string; points: number; goals: number; assists: number; isHot: boolean; playerId: number; headshotUrl?: string }[] = [];
  for (const [abbrev, stats] of playerStatsMap) {
    if (!todayTeams.has(abbrev) || !stats.skaters?.length) continue;
    const topSkaters = [...stats.skaters]
      .sort((a: PlayerStatLine, b: PlayerStatLine) => b.points - a.points)
      .slice(0, 2);
    for (const skater of topSkaters) {
      playerCandidates.push({
        name: `${skater.firstName.charAt(0)}. ${skater.lastName}`,
        teamAbbrev: abbrev,
        points: skater.points,
        goals: skater.goals,
        assists: skater.assists,
        isHot: skater.gamesPlayed > 0 && skater.goals / skater.gamesPlayed > 0.5,
        playerId: skater.playerId,
        headshotUrl: skater.headshotUrl,
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
      goals: p.goals,
      assists: p.assists,
      playerId: p.playerId,
      headshotUrl: p.headshotUrl,
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

  return interleaved.slice(0, 6);
}

export default function Spotlight({
  playerStatsMap,
  games,
  skaterLanding,
  teamLanding,
}: SpotlightProps) {
  const router = useRouter();
  const items = buildSpotlightItems(playerStatsMap, games, skaterLanding, teamLanding);

  if (items.length === 0) return null;

  const isPlayerCard = (item: SpotlightItem) => item.key.startsWith('player-');

  const renderCard = ({ item, index }: { item: SpotlightItem; index: number }) => {
    const colors = getTeamColors(item.teamAbbrev);
    const isPlayer = isPlayerCard(item);

    if (isPlayer) {
      const headshotUri = item.playerId
        ? getPlayerHeadshotUrl(item.playerId, item.teamAbbrev, item.headshotUrl)
        : undefined;

      return (
        <Animated.View entering={FadeInRight.duration(300).delay(index * 70)}>
          <View testID={`spotlight-card-${item.key}`} style={styles.playerCard}>
            <LinearGradient
              colors={[`${colors.primary}26`, 'transparent']}
              style={StyleSheet.absoluteFillObject}
            />
            {headshotUri && (
              <Image
                source={{ uri: headshotUri }}
                style={styles.headshotBg}
                contentFit="cover"
                contentPosition="top center"
                transition={300}
              />
            )}
            <View style={styles.playerStats}>
              <Text style={styles.category}>{item.category}</Text>
              <Text style={styles.playerName} numberOfLines={1}>{item.label}</Text>
              <Text style={styles.playerValue}>{item.value}</Text>
              <Text style={styles.statLine}>{item.goals}G {item.assists}A</Text>
            </View>
            <View style={styles.teamRow}>
              <Image source={{ uri: getTeamLogoUrl(item.teamAbbrev) }} style={styles.teamLogoSmall} contentFit="contain" />
              <Text style={[styles.teamLabel, { color: colors.primary }]}>{item.teamAbbrev}</Text>
            </View>
          </View>
        </Animated.View>
      );
    }

    // Edge stat card
    return (
      <Animated.View entering={FadeInRight.duration(300).delay(index * 70)}>
        <View testID={`spotlight-card-${item.key}`} style={styles.edgeCard}>
          <View style={[styles.topAccent, { backgroundColor: colors.primary }]} />
          <View style={styles.edgeContent}>
            <Text style={styles.category}>{item.category}</Text>
            <Text style={styles.edgeValue} numberOfLines={1}>{item.value}</Text>
            <Text style={styles.edgeLabel} numberOfLines={1}>{item.label}</Text>
            <View style={styles.teamRow}>
              <Image source={{ uri: getTeamLogoUrl(item.teamAbbrev) }} style={styles.teamLogoSmall} contentFit="contain" />
              <Text style={[styles.teamLabel, { color: colors.primary }]}>{item.teamAbbrev}</Text>
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
      <Text style={styles.seeAllText}>See All{'\n'}Players →</Text>
    </Pressable>
  );

  return (
    <View testID="edge-spotlight" style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Spotlight</Text>
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
  // Player card — taller with headshot background
  playerCard: {
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
  headshotBg: {
    position: 'absolute',
    right: -15,
    bottom: -10,
    width: 100,
    height: 110,
    opacity: 0.15,
  },
  playerStats: {
    gap: 0,
  },
  playerName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
  },
  playerValue: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.text,
    fontFamily: theme.fonts.mono,
  },
  statLine: {
    fontSize: 11,
    color: theme.subtext,
  },
  // Edge stat card — compact
  edgeCard: {
    width: 140,
    height: 160,
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
  edgeContent: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  edgeValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.text,
    letterSpacing: -0.5,
    fontFamily: theme.fonts.mono,
    fontVariant: ['tabular-nums'],
  },
  edgeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.text,
  },
  category: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.subtext,
    letterSpacing: 0.5,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teamLogoSmall: {
    width: 20,
    height: 20,
  },
  teamLabel: {
    fontSize: 10,
    fontWeight: '700',
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
