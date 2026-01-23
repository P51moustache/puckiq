import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../constants/theme';
import { GameFactor } from '../types/factors';

interface BreakdownCardProps {
  awayTeam: string;
  homeTeam: string;
  gameTime: string;
  factors: GameFactor[];
  weeklyTheme?: string;
  onPickTeam: (team: string) => void;
  selectedTeam?: string;
}

export function BreakdownCard({
  awayTeam,
  homeTeam,
  gameTime,
  factors,
  weeklyTheme,
  onPickTeam,
  selectedTeam,
}: BreakdownCardProps) {
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.matchup}>{awayTeam} @ {homeTeam}</Text>
        <Text style={styles.gameTime}>{gameTime}{weeklyTheme ? ` · Theme: ${weeklyTheme}` : ''}</Text>
      </View>

      {/* Breakdown */}
      <View style={styles.breakdown}>
        <Text style={styles.breakdownTitle}>THE BREAKDOWN</Text>
        {factors.map((factor, index) => (
          <View key={index} style={styles.factorRow}>
            <View style={styles.factorHeader}>
              <Text style={styles.factorName}>{factor.description}</Text>
              <Text style={[
                styles.factorAdvantage,
                factor.advantage !== 'EVEN' && styles.factorAdvantageHighlight
              ]}>
                {factor.advantage === 'EVEN' ? 'Even' : `› ${factor.advantage}`}
              </Text>
            </View>
            <Text style={styles.factorDetail}>{factor.detail}</Text>
          </View>
        ))}
      </View>

      {/* Pick Buttons */}
      <View style={styles.pickSection}>
        <Text style={styles.pickPrompt}>Based on this, who wins?</Text>
        <View style={styles.pickButtons}>
          <TouchableOpacity
            style={[
              styles.pickButton,
              selectedTeam === awayTeam && styles.pickButtonSelected,
            ]}
            onPress={() => onPickTeam(awayTeam)}
          >
            <Text style={[
              styles.pickButtonText,
              selectedTeam === awayTeam && styles.pickButtonTextSelected,
            ]}>
              {awayTeam}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.pickButton,
              selectedTeam === homeTeam && styles.pickButtonSelected,
            ]}
            onPress={() => onPickTeam(homeTeam)}
          >
            <Text style={[
              styles.pickButtonText,
              selectedTeam === homeTeam && styles.pickButtonTextSelected,
            ]}>
              {homeTeam}
            </Text>
          </TouchableOpacity>
        </View>
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
    marginBottom: 16,
  },
  matchup: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  gameTime: {
    fontSize: 14,
    color: theme.subtext,
    marginTop: 4,
  },
  breakdown: {
    borderTopWidth: 1,
    borderTopColor: theme.modalBorder,
    paddingTop: 16,
  },
  breakdownTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.subtext,
    letterSpacing: 1,
    marginBottom: 12,
  },
  factorRow: {
    marginBottom: 12,
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factorName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  factorAdvantage: {
    fontSize: 14,
    color: theme.subtext,
  },
  factorAdvantageHighlight: {
    color: theme.accent,
    fontWeight: '600',
  },
  factorDetail: {
    fontSize: 13,
    color: theme.subtext,
    marginTop: 2,
  },
  pickSection: {
    borderTopWidth: 1,
    borderTopColor: theme.modalBorder,
    paddingTop: 16,
    marginTop: 8,
  },
  pickPrompt: {
    fontSize: 14,
    color: theme.subtext,
    marginBottom: 12,
  },
  pickButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  pickButton: {
    flex: 1,
    backgroundColor: theme.factbox,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pickButtonSelected: {
    borderColor: theme.accent,
    backgroundColor: theme.pressed,
  },
  pickButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  pickButtonTextSelected: {
    color: theme.accent,
  },
});
