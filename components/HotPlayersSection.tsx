import { View, Text, FlatList, StyleSheet } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { rinkGlass } from '../constants/theme';
import { getTeamColors, getAccessibleTextColor } from '../constants/teamColors';
import type { TeamPlayerStats, PlayerStatLine } from '../types/gameResults';

interface EdgePlayerData {
  shotSpeed?: number;
  last5?: { goals: number; assists: number };
}

interface HotPlayersSectionProps {
  playerStatsMap: Map<string, TeamPlayerStats>;
  games: any[];
  edgePlayerData?: Map<string, EdgePlayerData>;
}

interface HotPlayer {
  key: string;
  name: string;
  teamAbbrev: string;
  points: number;
  goals: number;
  assists: number;
  gamesPlayed: number;
  isHot: boolean;
  shotSpeed?: number;
  last5?: { goals: number; assists: number };
}

function extractHotPlayers(
  playerStatsMap: Map<string, TeamPlayerStats>,
  games: any[],
  edgePlayerData?: Map<string, EdgePlayerData>,
): HotPlayer[] {
  const todayTeams = new Set<string>();
  for (const game of games) {
    if (game.homeTeam?.abbrev) todayTeams.add(game.homeTeam.abbrev);
    if (game.awayTeam?.abbrev) todayTeams.add(game.awayTeam.abbrev);
  }

  const candidates: HotPlayer[] = [];

  for (const [abbrev, stats] of playerStatsMap) {
    if (!todayTeams.has(abbrev)) continue;
    if (!stats.skaters?.length) continue;

    // Take top 2 scorers per team
    const topSkaters = stats.skaters
      .sort((a: PlayerStatLine, b: PlayerStatLine) => b.points - a.points)
      .slice(0, 2);

    for (const skater of topSkaters) {
      const isHot = skater.gamesPlayed > 0 && skater.goals / skater.gamesPlayed > 0.5;
      const edgeData = edgePlayerData?.get(`${skater.playerId}`);
      candidates.push({
        key: `${abbrev}-${skater.playerId}`,
        name: `${skater.firstName.charAt(0)}.${skater.lastName}`,
        teamAbbrev: abbrev,
        points: skater.points,
        goals: skater.goals,
        assists: skater.assists,
        gamesPlayed: skater.gamesPlayed,
        isHot,
        shotSpeed: edgeData?.shotSpeed,
        last5: edgeData?.last5,
      });
    }
  }

  return candidates.sort((a, b) => b.points - a.points).slice(0, 5);
}

function HotPlayersSectionComponent({ playerStatsMap, games, edgePlayerData }: HotPlayersSectionProps) {
  const hotPlayers = extractHotPlayers(playerStatsMap, games, edgePlayerData);

  if (hotPlayers.length === 0) return null;

  const renderCard = ({ item, index }: { item: HotPlayer; index: number }) => {
    const teamColor = getTeamColors(item.teamAbbrev).primary;

    return (
      <Animated.View entering={FadeInRight.duration(300).delay(index * 80)}>
        <View testID={`hot-player-card-${item.key}`} style={styles.card}>
          <View style={[styles.topAccent, { backgroundColor: teamColor }]} />
          <View style={styles.cardContent}>
            <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.teamAbbrev, { color: getAccessibleTextColor(item.teamAbbrev) }]}>{item.teamAbbrev}</Text>
            {item.last5 ? (
              <Text style={styles.pointsLarge}>Last 5: {item.last5.goals}G {item.last5.assists}A</Text>
            ) : (
              <Text style={styles.pointsLarge}>{item.points} pts</Text>
            )}
            <Text style={styles.statLine}>{item.goals}G {item.assists}A</Text>
            {item.shotSpeed && (
              <Text style={styles.shotSpeed}>{item.shotSpeed.toFixed(0)} mph shot</Text>
            )}
            {item.isHot && (
              <View style={styles.hotBadge}>
                <Text style={styles.hotText}>HOT</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View testID="hot-players-section">
      <Text style={styles.header}>HOT PLAYERS TONIGHT</Text>
      <FlatList
        horizontal
        data={hotPlayers}
        keyExtractor={(item) => item.key}
        renderItem={renderCard}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

export default HotPlayersSectionComponent;

const styles = StyleSheet.create({
  header: {
    fontSize: 13,
    fontWeight: '800',
    color: rinkGlass.textSecondary,
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    width: 160,
    height: 150,
    backgroundColor: rinkGlass.glass,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  topAccent: {
    height: 3,
    width: '100%',
  },
  cardContent: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  playerName: {
    fontSize: 14,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
  },
  teamAbbrev: {
    fontSize: 11,
    fontWeight: '600',
  },
  pointsLarge: {
    fontSize: 18,
    fontWeight: '800',
    color: rinkGlass.textPrimary,
    fontFamily: rinkGlass.fonts.mono,
  },
  statLine: {
    fontSize: 11,
    color: rinkGlass.textSecondary,
    fontWeight: '500',
    fontFamily: rinkGlass.fonts.mono,
  },
  hotBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: rinkGlass.goalLight + '33',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hotText: {
    fontSize: 9,
    fontWeight: '800',
    color: rinkGlass.goalLight,
    letterSpacing: 0.5,
  },
  shotSpeed: {
    fontSize: 10,
    fontWeight: '600',
    color: rinkGlass.blueLight,
    fontFamily: rinkGlass.fonts.mono,
  },
});
