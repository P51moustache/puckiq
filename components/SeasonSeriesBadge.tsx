import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';
import { H2HRecord } from '../types/gameResults';

interface SeasonSeriesBadgeProps {
  h2hRecord: H2HRecord | null;
  teamA: string;
  teamB: string;
  compact?: boolean;
}

/**
 * Returns plain-text season series summary (for share text usage).
 */
export function getSeriesText(record: H2HRecord): string {
  const total = record.teamAWins + record.teamBWins;
  if (total === 0) return 'First meeting';
  if (record.teamAWins === record.teamBWins)
    return `Series tied ${record.teamAWins}-${record.teamBWins}`;
  if (record.teamAWins > record.teamBWins)
    return `${record.teamA} leads ${record.teamAWins}-${record.teamBWins}`;
  return `${record.teamB} leads ${record.teamBWins}-${record.teamAWins}`;
}

export function SeasonSeriesBadge({
  h2hRecord,
  teamA,
  teamB,
  compact = false,
}: SeasonSeriesBadgeProps) {
  if (!h2hRecord) return null;

  const total = h2hRecord.teamAWins + h2hRecord.teamBWins;

  if (total === 0) {
    return (
      <View style={styles.container} testID="season-series-badge">
        <Text style={[styles.text, compact && styles.textCompact]}>
          First meeting
        </Text>
      </View>
    );
  }

  const tied = h2hRecord.teamAWins === h2hRecord.teamBWins;
  const aLeads = h2hRecord.teamAWins > h2hRecord.teamBWins;

  if (tied) {
    return (
      <View style={styles.container} testID="season-series-badge">
        <Text style={[styles.text, compact && styles.textCompact]}>
          Series tied {h2hRecord.teamAWins}-{h2hRecord.teamBWins}
        </Text>
      </View>
    );
  }

  const leader = aLeads ? teamA : teamB;
  const leaderWins = aLeads ? h2hRecord.teamAWins : h2hRecord.teamBWins;
  const trailerWins = aLeads ? h2hRecord.teamBWins : h2hRecord.teamAWins;

  return (
    <View style={styles.container} testID="season-series-badge">
      <Text style={[styles.text, compact && styles.textCompact]}>
        <Text style={styles.leaderName}>{leader}</Text>
        {' leads '}
        {leaderWins}-{trailerWins}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    backgroundColor: 'rgba(7, 26, 54, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#334e8d44',
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
  },
  textCompact: {
    fontSize: 10,
  },
  leaderName: {
    color: theme.text,
  },
});
