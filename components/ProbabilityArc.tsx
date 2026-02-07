import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useDerivedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface ProbabilityArcProps {
  homeProb: number;
  awayProb: number;
  homeColor: string;
  awayColor: string;
  homeAbbrev: string;
  awayAbbrev: string;
  size?: number;
}

export default function ProbabilityArc({
  homeProb,
  awayProb,
  homeColor,
  awayColor,
  homeAbbrev,
  awayAbbrev,
  size = 200,
}: ProbabilityArcProps) {
  const strokeWidth = 8;
  const R = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const totalLength = Math.PI * R;

  const homePath = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
  const awayPath = `M ${cx + R} ${cy} A ${R} ${R} 0 0 0 ${cx - R} ${cy}`;

  const progress = useSharedValue(0.5);

  useEffect(() => {
    progress.value = withTiming(homeProb / 100, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [homeProb]);

  const animatedHomeLength = useDerivedValue(() => progress.value * totalLength);
  const animatedAwayLength = useDerivedValue(() => (1 - progress.value) * totalLength);

  const homeAnimatedProps = useAnimatedProps(() => ({
    strokeDasharray: [animatedHomeLength.value, totalLength],
    strokeDashoffset: 0,
  }));

  const awayAnimatedProps = useAnimatedProps(() => ({
    strokeDasharray: [animatedAwayLength.value, totalLength],
    strokeDashoffset: 0,
  }));

  const favored = homeProb >= awayProb ? 'home' : 'away';
  const favoredPct = favored === 'home' ? homeProb : awayProb;
  const favoredAbbrev = favored === 'home' ? homeAbbrev : awayAbbrev;
  const favoredColor = favored === 'home' ? homeColor : awayColor;

  return (
    <View style={[styles.container, { width: size, height: size / 2 + 8 }]}>
      <Svg width={size} height={size / 2 + strokeWidth} viewBox={`0 ${cy - R - strokeWidth} ${size} ${R + strokeWidth * 2}`}>
        <Path
          d={homePath}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <AnimatedPath
          d={homePath}
          fill="none"
          stroke={homeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          animatedProps={homeAnimatedProps}
        />
        <AnimatedPath
          d={awayPath}
          fill="none"
          stroke={awayColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          animatedProps={awayAnimatedProps}
        />
      </Svg>
      <View style={[styles.label, { bottom: 0 }]}>
        <Text style={styles.pctText}>{favoredPct}%</Text>
        <Text style={[styles.abbrevText, { color: favoredColor }]}>{favoredAbbrev}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  label: {
    position: 'absolute',
    alignItems: 'center',
  },
  pctText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e6eef8',
  },
  abbrevText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#98a6bf',
    marginTop: -2,
  },
});
