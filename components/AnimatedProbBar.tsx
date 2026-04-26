/**
 * AnimatedProbBar — chunky filled probability bar that animates from 0 to %.
 *
 * Used in the hero card and slate rows. Spring-fills on mount.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { rinkGlass } from '../constants/theme';

interface AnimatedProbBarProps {
  /** Probability 0..1 */
  value: number;
  color?: string;
  height?: number;
  delay?: number;
  duration?: number;
}

export default function AnimatedProbBar({
  value,
  color = rinkGlass.blueLight,
  height = 8,
  delay = 100,
  duration = 850,
}: AnimatedProbBarProps) {
  const pct = useSharedValue(0);

  useEffect(() => {
    pct.value = 0;
    pct.value = withDelay(
      delay,
      withTiming(Math.max(0, Math.min(1, value)) * 100, {
        duration,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [value, delay, duration, pct]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${pct.value}%`,
  }));

  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: color, borderRadius: height / 2 },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: rinkGlass.glassBorder,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
