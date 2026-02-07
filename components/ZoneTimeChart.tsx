import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

interface ZoneTimeChartProps {
  offPctg: number;
  neutPctg: number;
  defPctg: number;
  leagueAvg?: { offPctg: number; neutPctg: number; defPctg: number };
}

export default function ZoneTimeChart({
  offPctg,
  neutPctg,
  defPctg,
  leagueAvg,
}: ZoneTimeChartProps) {
  // Normalize to ensure they sum to 100
  const total = offPctg + neutPctg + defPctg;
  const normOff = total > 0 ? (offPctg / total) * 100 : 33.3;
  const normNeut = total > 0 ? (neutPctg / total) * 100 : 33.4;
  const normDef = total > 0 ? (defPctg / total) * 100 : 33.3;

  return (
    <View testID="zone-time-chart" style={styles.container}>
      {/* Stacked bar */}
      <View style={styles.barContainer}>
        <View style={[styles.segment, styles.offSegment, { flex: normOff }]} />
        <View style={[styles.segment, styles.neutSegment, { flex: normNeut }]} />
        <View style={[styles.segment, styles.defSegment, { flex: normDef }]} />
      </View>

      {/* Labels */}
      <View style={styles.labelsRow}>
        <View style={styles.labelItem}>
          <View style={[styles.dot, { backgroundColor: '#22c55e' }]} />
          <Text style={styles.labelText}>OFF {offPctg.toFixed(1)}%</Text>
        </View>
        <View style={styles.labelItem}>
          <View style={[styles.dot, { backgroundColor: '#64748b' }]} />
          <Text style={styles.labelText}>NEU {neutPctg.toFixed(1)}%</Text>
        </View>
        <View style={styles.labelItem}>
          <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.labelText}>DEF {defPctg.toFixed(1)}%</Text>
        </View>
      </View>

      {/* League average comparison */}
      {leagueAvg && (
        <Text testID="zone-time-league-avg" style={styles.leagueAvgText}>
          League avg OFF: {leagueAvg.offPctg.toFixed(1)}%
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  barContainer: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  segment: {
    height: 12,
  },
  offSegment: {
    backgroundColor: '#22c55e',
  },
  neutSegment: {
    backgroundColor: '#64748b',
  },
  defSegment: {
    backgroundColor: '#ef4444',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  labelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  labelText: {
    fontSize: 9,
    fontWeight: '600',
    color: theme.subtext,
  },
  leagueAvgText: {
    fontSize: 9,
    color: theme.subtext,
    marginTop: 4,
    textAlign: 'center',
  },
});
