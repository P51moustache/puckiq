import { useEffect, useRef } from 'react';
import { TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';

interface AnimatedNumberProps {
  value: number;
  suffix?: string;
  style?: TextStyle;
  duration?: number;
  /** Enable green/red color flash when value changes. Default: false */
  colorFlash?: boolean;
}

export default function AnimatedNumber({ value, suffix = '', style, duration = 400, colorFlash = false }: AnimatedNumberProps) {
  const prevValue = useRef(value);
  const animatedValue = useSharedValue(value);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value]);

  // Flash/scale effect when value changes
  const flashOpacity = useSharedValue(0);
  // 1 = went up (green), -1 = went down (red), 0 = no change
  const direction = useSharedValue(0);

  useEffect(() => {
    if (colorFlash) {
      direction.value = value > prevValue.current ? 1 : value < prevValue.current ? -1 : 0;
    }
    prevValue.current = value;

    flashOpacity.value = withTiming(0.3, { duration: 150 }, () => {
      flashOpacity.value = withTiming(0, { duration: 450 });
    });
  }, [value]);

  const flashStyle = useAnimatedStyle(() => {
    const baseStyle: any = {
      opacity: 1 - flashOpacity.value * 0.5,
      transform: [{ scale: 1 + flashOpacity.value * 0.05 }],
    };

    if (colorFlash && direction.value !== 0) {
      baseStyle.color = interpolateColor(
        flashOpacity.value,
        [0, 0.3],
        direction.value > 0
          ? ['#ffffff', '#22c55e']  // green flash for increase
          : ['#ffffff', '#ef4444'], // red flash for decrease
      );
    }

    return baseStyle;
  });

  return (
    <Animated.Text style={[style, flashStyle]}>
      {Math.round(value)}{suffix}
    </Animated.Text>
  );
}
