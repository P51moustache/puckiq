/**
 * Team Player Highlights Card - Displays top player stats for a selected team
 * Shows top scorer, goal leader, assist leader, best +/-, and starting goalie
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { makeStyles, theme } from '../constants/theme';
import { Skeleton } from './ui/SkeletonLoader';
import { EmptyState } from './ui/EmptyState';

interface TeamPlayerHighlightsCardProps {
  teamAbbrev: string | null;
}

interface SkaterStats {
  playerId: number;
  headshot: string;
  firstName: { default: string } | string;
  lastName: { default: string } | string;
  positionCode: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  penaltyMinutes: number;
  powerPlayGoals: number;
  shorthandedGoals: number;
  gameWinningGoals: number;
  overtimeGoals: number;
  shots: number;
  shootingPctg: number;
  avgTimeOnIcePerGame: string;
}

interface GoalieStats {
  playerId: number;
  headshot: string;
  firstName: { default: string } | string;
  lastName: { default: string } | string;
  gamesPlayed: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  overtimeLosses: number;
  goalsAgainstAverage: number;
  savePercentage: number;
  shutouts: number;
}

interface TeamStats {
  season: string;
  gameType: number;
  skaters: SkaterStats[];
  goalies: GoalieStats[];
}

interface PlayerHighlight {
  id: number;
  name: string;
  headshot: string;
  position: string;
  value: string | number;
  label: string;
}

function getPlayerName(player: SkaterStats | GoalieStats): string {
  const firstName = typeof player.firstName === 'string'
    ? player.firstName
    : player.firstName?.default || '';
  const lastName = typeof player.lastName === 'string'
    ? player.lastName
    : player.lastName?.default || '';
  return `${firstName} ${lastName}`.trim();
}

export default function TeamPlayerHighlightsCard({ teamAbbrev }: TeamPlayerHighlightsCardProps) {
  const styles = makeStyles();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);

  useEffect(() => {
    if (!teamAbbrev) {
      setTeamStats(null);
      return;
    }

    let mounted = true;

    async function fetchTeamStats() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `https://api-web.nhle.com/v1/club-stats/${teamAbbrev}/now`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (mounted) {
          setTeamStats(data);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || 'Failed to load player highlights');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchTeamStats();

    return () => {
      mounted = false;
    };
  }, [teamAbbrev]);

  // Calculate top players
  const getHighlights = (): {
    topScorer: PlayerHighlight | null;
    topGoals: PlayerHighlight | null;
    topAssists: PlayerHighlight | null;
    topPlusMinus: PlayerHighlight | null;
    startingGoalie: PlayerHighlight | null;
  } => {
    if (!teamStats || !teamStats.skaters || teamStats.skaters.length === 0) {
      return {
        topScorer: null,
        topGoals: null,
        topAssists: null,
        topPlusMinus: null,
        startingGoalie: null,
      };
    }

    const skaters = [...teamStats.skaters].filter(s => s.gamesPlayed > 0);

    // Top scorer by points
    const byPoints = [...skaters].sort((a, b) => b.points - a.points);
    const topScorer = byPoints[0] ? {
      id: byPoints[0].playerId,
      name: getPlayerName(byPoints[0]),
      headshot: byPoints[0].headshot,
      position: byPoints[0].positionCode,
      value: `${byPoints[0].points} PTS`,
      label: 'TOP SCORER',
    } : null;

    // Top goal scorer
    const byGoals = [...skaters].sort((a, b) => b.goals - a.goals);
    const topGoals = byGoals[0] ? {
      id: byGoals[0].playerId,
      name: getPlayerName(byGoals[0]),
      headshot: byGoals[0].headshot,
      position: byGoals[0].positionCode,
      value: `${byGoals[0].goals} G`,
      label: 'TOP GOALS',
    } : null;

    // Top assists
    const byAssists = [...skaters].sort((a, b) => b.assists - a.assists);
    const topAssists = byAssists[0] ? {
      id: byAssists[0].playerId,
      name: getPlayerName(byAssists[0]),
      headshot: byAssists[0].headshot,
      position: byAssists[0].positionCode,
      value: `${byAssists[0].assists} A`,
      label: 'TOP ASSISTS',
    } : null;

    // Best +/-
    const byPlusMinus = [...skaters].sort((a, b) => b.plusMinus - a.plusMinus);
    const topPlusMinus = byPlusMinus[0] ? {
      id: byPlusMinus[0].playerId,
      name: getPlayerName(byPlusMinus[0]),
      headshot: byPlusMinus[0].headshot,
      position: byPlusMinus[0].positionCode,
      value: byPlusMinus[0].plusMinus > 0 ? `+${byPlusMinus[0].plusMinus}` : `${byPlusMinus[0].plusMinus}`,
      label: 'BEST +/-',
    } : null;

    // Starting goalie (most games played)
    const goalies = teamStats.goalies || [];
    const sortedGoalies = [...goalies].sort((a, b) => b.gamesPlayed - a.gamesPlayed);
    const startingGoalie = sortedGoalies[0] ? {
      id: sortedGoalies[0].playerId,
      name: getPlayerName(sortedGoalies[0]),
      headshot: sortedGoalies[0].headshot,
      position: 'G',
      value: `${sortedGoalies[0].wins} W`,
      label: 'STARTING GOALIE',
    } : null;

    return { topScorer, topGoals, topAssists, topPlusMinus, startingGoalie };
  };

  // Empty state - no team selected
  if (!teamAbbrev) {
    return (
      <View style={styles.card}>
        <EmptyState
          icon="🏒"
          title="Select a Team"
          message="Choose a team above to see their top player stats"
        />
      </View>
    );
  }

  // Loading state
  if (loading) {
    return (
      <View style={styles.card} testID="highlights-skeleton">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          <Skeleton width={180} height={20} />
          <Skeleton width={50} height={50} borderRadius={25} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <Skeleton width="48%" height={80} borderRadius={12} />
          <Skeleton width="48%" height={80} borderRadius={12} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <Skeleton width="48%" height={80} borderRadius={12} />
          <Skeleton width="48%" height={80} borderRadius={12} />
        </View>
        <Skeleton width="100%" height={70} borderRadius={12} />
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.card}>
        <EmptyState
          icon="⚠️"
          title="Failed to load player highlights"
          message={error}
        />
      </View>
    );
  }

  // No data available
  const highlights = getHighlights();
  if (!highlights.topScorer && !highlights.startingGoalie) {
    return (
      <View style={styles.card}>
        <EmptyState
          icon="📊"
          title="No Stats Available"
          message="Player stats for this team are not yet available"
        />
      </View>
    );
  }

  const goalie = teamStats?.goalies?.[0];

  return (
    <View style={styles.card}>
      {/* Header */}
      <Text style={localStyles.title}>Team Player Highlights</Text>

      {/* Player highlights grid */}
      <View style={localStyles.highlightsGrid}>
        {/* Row 1: Top Scorer & Top Goals */}
        <View style={localStyles.highlightRow}>
          {highlights.topScorer && (
            <View style={localStyles.highlightItem} testID="top-scorer">
              <Text style={localStyles.highlightLabel}>{highlights.topScorer.label}</Text>
              <View style={localStyles.playerRow}>
                <Image
                  source={{ uri: highlights.topScorer.headshot }}
                  style={localStyles.playerImage}
                  contentFit="cover"
                />
                <View style={localStyles.playerInfo}>
                  <Text style={localStyles.playerName} numberOfLines={1}>
                    {highlights.topScorer.name}
                  </Text>
                  <Text style={localStyles.statValue}>{highlights.topScorer.value}</Text>
                </View>
              </View>
            </View>
          )}
          {highlights.topGoals && (
            <View style={localStyles.highlightItem} testID="top-goals">
              <Text style={localStyles.highlightLabel}>{highlights.topGoals.label}</Text>
              <View style={localStyles.playerRow}>
                <Image
                  source={{ uri: highlights.topGoals.headshot }}
                  style={localStyles.playerImage}
                  contentFit="cover"
                />
                <View style={localStyles.playerInfo}>
                  <Text style={localStyles.playerName} numberOfLines={1}>
                    {highlights.topGoals.name}
                  </Text>
                  <Text style={localStyles.statValue}>{highlights.topGoals.value}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Row 2: Top Assists & Best +/- */}
        <View style={localStyles.highlightRow}>
          {highlights.topAssists && (
            <View style={localStyles.highlightItem} testID="top-assists">
              <Text style={localStyles.highlightLabel}>{highlights.topAssists.label}</Text>
              <View style={localStyles.playerRow}>
                <Image
                  source={{ uri: highlights.topAssists.headshot }}
                  style={localStyles.playerImage}
                  contentFit="cover"
                />
                <View style={localStyles.playerInfo}>
                  <Text style={localStyles.playerName} numberOfLines={1}>
                    {highlights.topAssists.name}
                  </Text>
                  <Text style={localStyles.statValue}>{highlights.topAssists.value}</Text>
                </View>
              </View>
            </View>
          )}
          {highlights.topPlusMinus && (
            <View style={localStyles.highlightItem} testID="top-plusminus">
              <Text style={localStyles.highlightLabel}>{highlights.topPlusMinus.label}</Text>
              <View style={localStyles.playerRow}>
                <Image
                  source={{ uri: highlights.topPlusMinus.headshot }}
                  style={localStyles.playerImage}
                  contentFit="cover"
                />
                <View style={localStyles.playerInfo}>
                  <Text style={localStyles.playerName} numberOfLines={1}>
                    {highlights.topPlusMinus.name}
                  </Text>
                  <Text style={[
                    localStyles.statValue,
                    { color: Number(highlights.topPlusMinus.value.toString().replace('+', '')) > 0 ? '#22c55e' : '#ef4444' }
                  ]}>
                    {highlights.topPlusMinus.value}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Row 3: Starting Goalie (full width) */}
        {goalie && (
          <View style={localStyles.goalieRow}>
            <Text style={localStyles.highlightLabel}>STARTING GOALIE</Text>
            <View style={localStyles.goalieContent}>
              <Image
                source={{ uri: goalie.headshot }}
                style={localStyles.goalieImage}
                contentFit="cover"
              />
              <View style={localStyles.goalieInfo}>
                <Text style={localStyles.goalieName}>
                  {getPlayerName(goalie)}
                </Text>
                <View style={localStyles.goalieStats}>
                  <View style={localStyles.goalieStat}>
                    <Text style={localStyles.goalieStatLabel}>W</Text>
                    <Text style={localStyles.goalieStatValue}>{goalie.wins}</Text>
                  </View>
                  <View style={localStyles.goalieStat}>
                    <Text style={localStyles.goalieStatLabel}>GAA</Text>
                    <Text style={localStyles.goalieStatValue}>
                      {goalie.goalsAgainstAverage?.toFixed(2) || '-'}
                    </Text>
                  </View>
                  <View style={localStyles.goalieStat}>
                    <Text style={localStyles.goalieStatLabel}>SV%</Text>
                    <Text style={localStyles.goalieStatValue}>
                      {goalie.savePercentage ? `.${Math.round(goalie.savePercentage * 1000)}` : '-'}
                    </Text>
                  </View>
                  <View style={localStyles.goalieStat}>
                    <Text style={localStyles.goalieStatLabel}>SO</Text>
                    <Text style={localStyles.goalieStatValue}>{goalie.shutouts}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e6eef8',
    marginBottom: 16,
  },
  highlightsGrid: {
    gap: 10,
  },
  highlightRow: {
    flexDirection: 'row',
    gap: 10,
  },
  highlightItem: {
    flex: 1,
    backgroundColor: '#071a3699',
    borderRadius: 12,
    padding: 12,
  },
  highlightLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#98a6bf',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#071a36',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e6eef8',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#60a5fa',
  },
  goalieRow: {
    backgroundColor: '#192e5e66',
    borderRadius: 12,
    padding: 14,
  },
  goalieContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  goalieImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#071a36',
  },
  goalieInfo: {
    flex: 1,
  },
  goalieName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e6eef8',
    marginBottom: 8,
  },
  goalieStats: {
    flexDirection: 'row',
    gap: 16,
  },
  goalieStat: {
    alignItems: 'center',
  },
  goalieStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#98a6bf',
    marginBottom: 2,
  },
  goalieStatValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10b981',
  },
});
