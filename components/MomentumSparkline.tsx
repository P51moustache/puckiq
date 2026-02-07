import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import type { MomentumTrend } from '../types/edgeStats';

interface MomentumSparklineProps {
  data: number[];
  trend: MomentumTrend;
  teamAbbrev: string;
  compact?: boolean;
}

export default function MomentumSparkline({
  data,
  trend,
  teamAbbrev,
  compact = false,
}: MomentumSparklineProps) {
  if (!data || data.length === 0) return null;

  const teamColor = getTeamColors(teamAbbrev).primary;
  const width = compact ? 80 : 100;
  const height = compact ? 24 : 40;

  // Normalize data to fit within SVG height
  const maxVal = Math.max(...data.map(Math.abs), 1);
  const midY = height / 2;
  const scaleY = (height / 2 - 4) / maxVal; // 4px padding

  const points = data
    .map((val, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * (width - 4) + 2;
      const y = midY - val * scaleY;
      return `${x},${y}`;
    })
    .join(' ');

  const trendColor =
    trend === '↑' || trend === '↗' ? '#22c55e' :
    trend === '↓' || trend === '↘' ? '#ef4444' :
    theme.subtext;

  return (
    <View
      testID="momentum-sparkline"
      style={[styles.container, compact && styles.compactContainer]}
    >
      <Svg width={width} height={height}>
        <Polyline
          points={points}
          fill="none"
          stroke={teamColor}
          strokeWidth={compact ? 1.5 : 2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
      <Text
        testID="momentum-trend-arrow"
        style={[styles.trendArrow, { color: trendColor }, compact && styles.compactArrow]}
      >
        {trend}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactContainer: {
    gap: 2,
  },
  trendArrow: {
    fontSize: 16,
    fontWeight: '700',
  },
  compactArrow: {
    fontSize: 12,
  },
});
