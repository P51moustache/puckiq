import { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';

/**
 * Custom hook for pick button animation
 * Returns animated style and trigger function
 */
export function usePickAnimation() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const triggerAnimation = () => {
    // Quick scale up and down with opacity pulse
    scale.value = withSequence(
      withTiming(1.05, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );
    opacity.value = withSequence(
      withTiming(0.8, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );
  };

  return { animatedStyle, triggerAnimation };
}
