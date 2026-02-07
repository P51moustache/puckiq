import { View } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';

interface FormSparklineProps {
  /** Game results, most recent first. */
  results: ('W' | 'L' | 'OTL')[];
  width?: number;
  height?: number;
}

export default function FormSparkline({
  results,
  width = 48,
  height = 16,
}: FormSparklineProps) {
  if (!results || results.length < 2) return null;

  // Map results to y-values: W = top, OTL = middle, L = bottom
  const yMap = { W: 2, OTL: height / 2, L: height - 2 };
  const step = width / (results.length - 1);

  // Reverse so sparkline reads left-to-right chronologically (oldest → newest)
  const chronological = [...results].reverse();

  const points = chronological
    .map((r, i) => `${i * step},${yMap[r]}`)
    .join(' ');

  // Most recent result determines dot color
  const lastResult = results[0];
  const dotColor =
    lastResult === 'W'
      ? '#10b981'
      : lastResult === 'L'
        ? '#ef4444'
        : '#fbbf24';

  // Dot is at the rightmost point (most recent)
  const dotX = (chronological.length - 1) * step;
  const dotY = yMap[chronological[chronological.length - 1]];

  return (
    <View testID="form-sparkline" style={{ width, height }}>
      <Svg width={width} height={height}>
        <Polyline
          points={points}
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={dotX} cy={dotY} r={3} fill={dotColor} />
      </Svg>
    </View>
  );
}
