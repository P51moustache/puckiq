import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { theme } from '../constants/theme';
import { getTeamLogoUrl } from '../utils/teamLogo';
import type { StandingsData } from '../types/predictions';

interface StandingsWidgetProps {
  standings: StandingsData | null;
  selectedTeam: string | null;
}

interface DivisionTeam {
  abbrev: string;
  wins: number;
  losses: number;
  otLosses: number;
  points: number;
  divisionName: string;
  logoUrl: string;
}

const DEFAULT_DIVISION = 'Atlantic';

function getDivisionTeams(standings: StandingsData | null, selectedTeam: string | null): DivisionTeam[] {
  const entries = standings?.standings;
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const teams: DivisionTeam[] = entries.map((e) => ({
    abbrev: typeof e.teamAbbrev === 'string' ? e.teamAbbrev : e.teamAbbrev?.default ?? '???',
    wins: e.wins ?? 0,
    losses: e.losses ?? 0,
    otLosses: e.otLosses ?? 0,
    points: e.points ?? 0,
    divisionName: e.divisionName ?? 'Unknown',
    logoUrl: e.teamLogo ?? '',
  }));

  // Find user's division
  let targetDivision = DEFAULT_DIVISION;
  if (selectedTeam) {
    const userTeam = teams.find((t) => t.abbrev === selectedTeam);
    if (userTeam) {
      targetDivision = userTeam.divisionName;
    }
  }

  // Filter to division, sort by points desc (wins as tiebreaker)
  const divTeams = teams
    .filter((t) => t.divisionName === targetDivision)
    .sort((a, b) => b.points - a.points || b.wins - a.wins);

  return divTeams.slice(0, 5);
}

function StandingsWidgetComponent({ standings, selectedTeam }: StandingsWidgetProps) {
  const router = useRouter();

  const teams = useMemo(() => getDivisionTeams(standings, selectedTeam), [standings, selectedTeam]);

  if (!standings || teams.length === 0) return null;

  return (
    <Animated.View testID="standings-widget" entering={FadeInUp.duration(400)} style={styles.wrapper}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionHeader}>DIVISION STANDINGS</Text>
        <View style={styles.accentBar} />
      </View>

      <View style={styles.card}>
        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.colHash, styles.headerText]}>#</Text>
          <Text style={[styles.colTeam, styles.headerText]}>Team</Text>
          <Text style={[styles.colStat, styles.headerText]}>W</Text>
          <Text style={[styles.colStat, styles.headerText]}>L</Text>
          <Text style={[styles.colStat, styles.headerText]}>OTL</Text>
          <Text style={[styles.colPts, styles.headerText]}>PTS</Text>
        </View>

        {/* Team rows */}
        {teams.map((team, index) => {
          const isUserTeam = selectedTeam === team.abbrev;
          const isLast = index === teams.length - 1;

          return (
            <View key={team.abbrev}>
              <View style={[styles.teamRow, isUserTeam && styles.highlightRow]}>
                <Text style={[styles.colHash, styles.rankText]}>{index + 1}</Text>
                <View style={[styles.colTeam, styles.teamInfo]}>
                  <Image
                    source={{ uri: getTeamLogoUrl(team.abbrev) }}
                    style={styles.teamLogo}
                    contentFit="contain"
                  />
                  <Text style={styles.teamAbbrev}>{team.abbrev}</Text>
                </View>
                <Text style={[styles.colStat, styles.statText]}>{team.wins}</Text>
                <Text style={[styles.colStat, styles.statText]}>{team.losses}</Text>
                <Text style={[styles.colStat, styles.statText]}>{team.otLosses}</Text>
                <Text style={[styles.colPts, styles.ptsText]}>{team.points}</Text>
              </View>
              {!isLast && <View style={styles.separator} />}
            </View>
          );
        })}

        {/* Footer link */}
        <Pressable
          onPress={() => router.push('/stats')}
          style={({ pressed }) => [styles.footer, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.footerText}>Full Standings →</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default React.memo(StandingsWidgetComponent);

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
  },
  headerRow: {
    marginBottom: 10,
  },
  sectionHeader: {
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
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 2,
  },
  headerText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.subtext,
    letterSpacing: 0.5,
  },
  colHash: {
    width: 24,
    textAlign: 'center',
  },
  colTeam: {
    flex: 1,
  },
  colStat: {
    width: 34,
    textAlign: 'center',
  },
  colPts: {
    width: 36,
    textAlign: 'center',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 4,
  },
  highlightRow: {
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
    borderRadius: 8,
  },
  rankText: {
    fontSize: 12,
    color: theme.subtext,
    fontFamily: theme.fonts.mono,
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamLogo: {
    width: 16,
    height: 16,
  },
  teamAbbrev: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
  },
  statText: {
    fontSize: 12,
    fontFamily: theme.fonts.mono,
    color: theme.text,
  },
  ptsText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: theme.fonts.mono,
    color: theme.text,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginHorizontal: 4,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.accent,
  },
});
