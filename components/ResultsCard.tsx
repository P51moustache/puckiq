import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';
import { GameFactor } from '../types/factors';

interface ResultFactor extends GameFactor {
  mattered: boolean;
  resultNote: string;
}

interface ResultsCardProps {
  awayTeam: string;
  homeTeam: string;
  awayScore: number;
  homeScore: number;
  userPick: string;
  factors: ResultFactor[];
  insight: string;
}

export function ResultsCard({
  awayTeam,
  homeTeam,
  awayScore,
  homeScore,
  userPick,
  factors,
  insight,
}: ResultsCardProps) {
  const winner = homeScore > awayScore ? homeTeam : awayTeam;
  const userWon = userPick === winner;

  return (
    <View style={styles.card}>
      {/* Header with score */}
      <View style={styles.header}>
        <Text style={styles.score}>
          {homeTeam} {homeScore} - {awayTeam} {awayScore}
        </Text>
        <Text style={styles.final}>FINAL</Text>
      </View>

      <View style={styles.pickResult}>
        <Text style={[styles.pickResultText, userWon ? styles.pickWin : styles.pickLoss]}>
          {userWon ? '✓' : '✗'} You picked {userPick}
        </Text>
      </View>

      {/* What actually mattered */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>WHAT ACTUALLY MATTERED</Text>
        {factors.map((factor, index) => (
          <View key={index} style={styles.factorRow}>
            <View style={styles.factorHeader}>
              <Text style={[
                styles.factorIcon,
                factor.mattered ? styles.factorMattered : styles.factorNotMattered
              ]}>
                {factor.mattered ? '✓' : '✗'}
              </Text>
              <Text style={styles.factorName}>{factor.description}</Text>
            </View>
            <Text style={styles.factorDetail}>{factor.detail}</Text>
            <Text style={styles.factorNote}>{factor.resultNote}</Text>
          </View>
        ))}
      </View>

      {/* Insight */}
      <View style={styles.insightSection}>
        <Text style={styles.insightTitle}>YOUR INSIGHT</Text>
        <Text style={styles.insightText}>{insight}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  score: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  final: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.subtext,
    letterSpacing: 1,
  },
  pickResult: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.modalBorder,
    marginBottom: 16,
  },
  pickResultText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pickWin: {
    color: '#22c55e', // green
  },
  pickLoss: {
    color: '#ef4444', // red
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.subtext,
    letterSpacing: 1,
    marginBottom: 12,
  },
  factorRow: {
    marginBottom: 16,
  },
  factorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  factorIcon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  factorMattered: {
    color: '#22c55e', // green
  },
  factorNotMattered: {
    color: '#ef4444', // red
  },
  factorName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  factorDetail: {
    fontSize: 13,
    color: theme.text,
    marginTop: 4,
    marginLeft: 24,
  },
  factorNote: {
    fontSize: 13,
    color: theme.subtext,
    fontStyle: 'italic',
    marginTop: 2,
    marginLeft: 24,
  },
  insightSection: {
    backgroundColor: theme.factbox,
    borderRadius: 8,
    padding: 12,
  },
  insightTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.subtext,
    letterSpacing: 1,
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: theme.text,
    lineHeight: 20,
  },
});
