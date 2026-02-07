import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import { getTeamLogoUrl } from '../utils/teamLogo';

interface StandingsEntry {
  teamAbbrev: string | { default: string };
  teamName?: { default?: string };
  divisionName?: string;
  conferenceName?: string;
  points?: number;
  divisionSequence?: number;
  wins?: number;
  losses?: number;
  otLosses?: number;
}

interface EmptyNightCardProps {
  selectedTeam?: string | null;
  standings?: { standings?: StandingsEntry[] } | null;
  nextGame?: { opponent: string; date: string; time: string } | null;
}

function findTeamStanding(standings: StandingsEntry[] | undefined, teamAbbrev: string): StandingsEntry | null {
  if (!standings) return null;
  return standings.find(entry => {
    const abbrev = typeof entry.teamAbbrev === 'string' ? entry.teamAbbrev : entry.teamAbbrev?.default;
    return abbrev === teamAbbrev;
  }) ?? null;
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function pickFunStat(standings: StandingsEntry[] | undefined): string | null {
  if (!standings?.length) return null;
  const sorted = [...standings].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  const leader = sorted[0];
  const leaderAbbrev = typeof leader.teamAbbrev === 'string' ? leader.teamAbbrev : leader.teamAbbrev?.default;
  if (leaderAbbrev && leader.points) {
    return `${leaderAbbrev} leads the league with ${leader.points} pts`;
  }
  return null;
}

export default function EmptyNightCard({ selectedTeam, standings, nextGame }: EmptyNightCardProps) {
  const standingsEntries = standings?.standings;
  const teamStanding = selectedTeam ? findTeamStanding(standingsEntries, selectedTeam) : null;
  const teamColors = selectedTeam ? getTeamColors(selectedTeam) : null;
  const funStat = pickFunStat(standingsEntries);

  // Personalized version with favorite team
  if (selectedTeam && teamStanding) {
    const teamName = typeof teamStanding.teamName === 'object'
      ? teamStanding.teamName?.default ?? selectedTeam
      : selectedTeam;
    const divPos = teamStanding.divisionSequence ?? 0;
    const division = teamStanding.divisionName ?? '';
    const points = teamStanding.points ?? 0;
    const record = `${teamStanding.wins ?? 0}-${teamStanding.losses ?? 0}-${teamStanding.otLosses ?? 0}`;

    return (
      <Animated.View entering={FadeInUp.duration(400)} style={styles.card}>
        {/* Team header */}
        <View style={styles.teamHeader}>
          <Image
            source={{ uri: getTeamLogoUrl(selectedTeam) }}
            style={styles.logo}
            contentFit="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.teamName}>{teamName}</Text>
            <Text style={[styles.standingText, teamColors && { color: teamColors.primary }]}>
              {getOrdinal(divPos)} in {division} | {points} pts ({record})
            </Text>
          </View>
        </View>

        {/* Next game */}
        {nextGame && (
          <View style={styles.nextGameSection}>
            <Text style={styles.nextLabel}>NEXT GAME</Text>
            <Text style={styles.nextGameText}>
              vs {nextGame.opponent} | {nextGame.date} {nextGame.time}
            </Text>
          </View>
        )}

        {/* Fun stat */}
        {funStat && (
          <Text style={styles.funStat}>{funStat}</Text>
        )}

        <Text style={styles.noGamesNote}>No games tonight</Text>
      </Animated.View>
    );
  }

  // Generic version (no favorite team set)
  return (
    <Animated.View entering={FadeInUp.duration(400)} style={styles.card}>
      <Text style={styles.title}>No Games Tonight</Text>
      <Text style={styles.subtitle}>The next slate drops tomorrow.</Text>
      {funStat && (
        <Text style={styles.funStat}>{funStat}</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.08)',
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  logo: {
    width: 40,
    height: 40,
  },
  teamName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  standingText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  nextGameSection: {
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  nextLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.subtext,
    letterSpacing: 1,
    marginBottom: 4,
  },
  nextGameText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  funStat: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.subtext,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  noGamesNote: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.subtext,
    textAlign: 'center',
    marginTop: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.subtext,
    textAlign: 'center',
    lineHeight: 20,
  },
});
