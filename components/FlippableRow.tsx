/**
 * FlippableRow — a tappable row that rotates 180° in 3D on long-press.
 *
 * Front face = the normal slate row content (passed as `front`).
 * Back face = the model factors detail (passed as `back`).
 *
 * Tap = the front's onPress (navigate to detail screen).
 * Long-press = flip to back. Tap on back = flip to front.
 *
 * Uses Reanimated rotateY interpolation. backfaceVisibility hides whichever
 * face is rotated past 90°.
 */

import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface FlippableRowProps {
  front: React.ReactNode;
  back: React.ReactNode;
  onTap?: () => void;
  /** Reserved minimum height for the back face. Defaults to 0 so the
      container is sized by the front content; back is absolute and will
      stretch to match. */
  minHeight?: number;
}

export default function FlippableRow({ front, back, onTap, minHeight = 0 }: FlippableRowProps) {
  const rotation = useSharedValue(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const flip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const next = isFlipped ? 0 : 180;
    rotation.value = withTiming(next, { duration: 480, easing: Easing.inOut(Easing.cubic) });
    setIsFlipped(!isFlipped);
  };

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateY: `${rotation.value}deg` },
    ],
    backfaceVisibility: 'hidden' as const,
    opacity: interpolate(rotation.value, [0, 89, 90, 180], [1, 1, 0, 0]),
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateY: `${rotation.value - 180}deg` },
    ],
    backfaceVisibility: 'hidden' as const,
    opacity: interpolate(rotation.value, [0, 89, 90, 180], [0, 0, 1, 1]),
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  }));

  return (
    <View style={[styles.container, { minHeight }]}>
      <Pressable
        onPress={() => {
          if (isFlipped) {
            flip();
          } else {
            onTap?.();
          }
        }}
        onLongPress={flip}
        delayLongPress={250}
      >
        <Animated.View style={frontStyle}>{front}</Animated.View>
        <Animated.View style={backStyle}>{back}</Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
