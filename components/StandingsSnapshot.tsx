import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';

import type { MomentumData } from '../types/edgeStats';

interface StandingsSnapshotProps {
  standings: any;
  momentumMap?: Map<string, MomentumData>;
}

interface StandingsTeam {
  abbrev: string;
  wins: number;
  losses: number;
  otLosses: number;
  points: number;
  divisionName: string;
  conferenceName: string;
}

function parseStandings(standings: any): Map<string, StandingsTeam[]> {
  const entries: any[] = standings?.standings ?? [];
  if (!Array.isArray(entries) || entries.length === 0) return new Map();

  const teams: StandingsTeam[] = entries.map((e: any) => ({
    abbrev: typeof e.teamAbbrev === 'string' ? e.teamAbbrev : e.teamAbbrev?.default ?? '???',
    wins: e.wins ?? 0,
    losses: e.losses ?? 0,
    otLosses: e.otLosses ?? 0,
    points: e.points ?? 0,
    divisionName: e.divisionName ?? 'Unknown',
    conferenceName: e.conferenceName ?? 'Unknown',
  }));

  // Group by division, sorted by points desc
  const divMap = new Map<string, StandingsTeam[]>();
  for (const team of teams) {
    const key = `${team.conferenceName}|${team.divisionName}`;
    if (!divMap.has(key)) divMap.set(key, []);
    divMap.get(key)!.push(team);
  }

  // Sort each division by points
  for (const [, divTeams] of divMap) {
    divTeams.sort((a, b) => b.points - a.points);
  }

  return divMap;
}

const DIVISION_ORDER = [
  'Eastern|Atlantic',
  'Eastern|Metropolitan',
  'Western|Central',
  'Western|Pacific',
];

function getMomentumColor(score: number): string {
  if (score >= 3) return '#22c55e';
  if (score <= -3) return '#ef4444';
  return theme.subtext;
}

function StandingsSnapshotComponent({ standings, momentumMap }: StandingsSnapshotProps) {
  const [expanded, setExpanded] = useState(false);
  const divMap = parseStandings(standings);

  if (divMap.size === 0) return null;

  const teamsPerDivision = expanded ? 3 : 1;

  return (
    <Animated.View
      testID="standings-snapshot"
      entering={FadeInUp.duration(300)}
      style={styles.container}
    >
      <Text style={styles.sectionHeader}>STANDINGS</Text>
      <View style={styles.card}>
        {DIVISION_ORDER.map((key) => {
          const divTeams = divMap.get(key);
          if (!divTeams || divTeams.length === 0) return null;

          const divisionName = key.split('|')[1];
          const displayTeams = divTeams.slice(0, teamsPerDivision);

          return (
            <View key={key} style={styles.divisionBlock}>
              <View style={styles.divHeader}>
                <Text style={styles.divName}>{divisionName.toUpperCase()}</Text>
                <View style={styles.statHeaders}>
                  <Text style={styles.statHeader}>W</Text>
                  <Text style={styles.statHeader}>L</Text>
                  <Text style={styles.statHeader}>OTL</Text>
                  <Text style={[styles.statHeader, styles.ptsHeader]}>PTS</Text>
                  {momentumMap && <Text style={styles.statHeader}>MTM</Text>}
                </View>
              </View>
              {displayTeams.map((team) => {
                const teamColor = getTeamColors(team.abbrev).primary;
                return (
                  <View key={team.abbrev} testID={`standings-row-${team.abbrev}`} style={styles.teamRow}>
                    <View style={styles.teamInfo}>
                      <View style={[styles.teamDot, { backgroundColor: teamColor }]} />
                      <Text style={styles.teamAbbrev}>{team.abbrev}</Text>
                    </View>
                    <View style={styles.statValues}>
                      <Text style={styles.statValue}>{team.wins}</Text>
                      <Text style={styles.statValue}>{team.losses}</Text>
                      <Text style={styles.statValue}>{team.otLosses}</Text>
                      <Text style={[styles.statValue, styles.ptsValue]}>{team.points}</Text>
                      {momentumMap && (() => {
                        const m = momentumMap.get(team.abbrev);
                        return (
                          <Text style={[styles.statValue, { color: getMomentumColor(m?.score ?? 0) }]}>
                            {m?.trend ?? '→'}
                          </Text>
                        );
                      })()}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

        <Pressable
          testID="standings-toggle"
          onPress={() => setExpanded(!expanded)}
          style={({ pressed }) => [
            styles.toggleButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.toggleText}>
            {expanded ? 'Show Leaders Only' : 'Show Full Standings'}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default StandingsSnapshotComponent;

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.subtext,
    letterSpacing: 1,
    marginBottom: 10,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.08)',
  },
  divisionBlock: {
    marginBottom: 12,
  },
  divHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(96, 165, 250, 0.08)',
  },
  divName: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.subtext,
    letterSpacing: 0.5,
  },
  statHeaders: {
    flexDirection: 'row',
    gap: 0,
  },
  statHeader: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.subtext,
    width: 32,
    textAlign: 'center',
  },
  ptsHeader: {
    fontWeight: '700',
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 4,
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  teamAbbrev: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
  },
  statValues: {
    flexDirection: 'row',
    gap: 0,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.subtext,
    width: 32,
    textAlign: 'center',
  },
  ptsValue: {
    fontWeight: '700',
    color: theme.text,
  },
  toggleButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(96, 165, 250, 0.08)',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.accent,
  },
});
