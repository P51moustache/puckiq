import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../constants/theme';

interface SpeedGaugeProps {
  value: number;
  unit?: string;
  label: string;
  percentile?: number;
  leagueAvg?: number;
}

export default function SpeedGauge({
  value,
  unit = 'mph',
  label,
  percentile,
  leagueAvg,
}: SpeedGaugeProps) {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [value]);

  // Display static value (animated count-up is visual only in native)
  const displayValue = value.toFixed(1);

  return (
    <View testID="speed-gauge" style={styles.container}>
      <Text testID="speed-gauge-value" style={styles.value}>
        {displayValue}
      </Text>
      <Text style={styles.unit}>{unit}</Text>
      <Text style={styles.label}>{label}</Text>

      {percentile != null && (
        <View style={styles.percentileContainer}>
          <View style={styles.percentileBarBg}>
            <View
              testID="speed-gauge-percentile-bar"
              style={[
                styles.percentileBarFill,
                { width: `${Math.min(100, Math.max(0, percentile))}%` },
              ]}
            />
          </View>
          <Text style={styles.percentileText}>{percentile}th</Text>
        </View>
      )}

      {leagueAvg != null && (
        <Text testID="speed-gauge-league-avg" style={styles.leagueAvg}>
          League avg: {leagueAvg.toFixed(1)} {unit}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 12,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.text,
  },
  unit: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.accent,
    marginTop: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  percentileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
    width: '100%',
  },
  percentileBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  percentileBarFill: {
    height: 4,
    backgroundColor: theme.accent,
    borderRadius: 2,
  },
  percentileText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.subtext,
    minWidth: 28,
  },
  leagueAvg: {
    fontSize: 10,
    color: theme.subtext,
    marginTop: 4,
  },
});
