/**
 * Motion primitives for the F1 look: numerals that count to their new value, a pulsing
 * live dot, and a goal haptic. Everything respects the system Reduce Motion setting.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

/** Long enough to read as a count, short enough not to delay the number. */
export const COUNT_UP_MS = 650;
/** One live-dot breath, like the timing tower's "live" marker. */
const PULSE_MS = 900;

let reduceMotion = false;
// Optional chaining all the way down: test environments mock react-native partially.
AccessibilityInfo?.isReduceMotionEnabled?.()
  ?.then((value) => {
    reduceMotion = value;
  })
  .catch(() => undefined);
AccessibilityInfo?.addEventListener?.('reduceMotionChanged', (value: boolean) => {
  reduceMotion = value;
});

export function prefersReducedMotion(): boolean {
  return reduceMotion;
}

/** Ease-out cubic: fast start, gentle landing — how scoreboard digits settle. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}

/** The value shown `elapsed` ms into a count from `from` to `to`. */
export function countFrame(from: number, to: number, elapsed: number, duration = COUNT_UP_MS): number {
  if (duration <= 0) return to;
  return from + (to - from) * easeOutCubic(elapsed / duration);
}

/**
 * A number that counts from its previous value to the new one. The first render shows the
 * value as-is unless `animateOnMount`, so tests and screenshots see real numbers immediately.
 */
export function CountUp({
  value,
  format = (n: number) => String(Math.round(n)),
  style,
  animateOnMount = false,
  duration = COUNT_UP_MS,
  testID,
}: {
  value: number;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
  animateOnMount?: boolean;
  duration?: number;
  testID?: string;
}) {
  const [shown, setShown] = useState(animateOnMount ? 0 : value);
  const from = useRef(animateOnMount ? 0 : value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    const canAnimate = typeof requestAnimationFrame === 'function' && !reduceMotion && start !== value;
    if (!canAnimate) {
      setShown(value);
      return;
    }
    const began = Date.now();
    let frame = 0;
    const tick = () => {
      const elapsed = Date.now() - began;
      setShown(countFrame(start, value, elapsed, duration));
      if (elapsed < duration) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <Text style={style} testID={testID} accessibilityLabel={format(value)}>
      {format(shown)}
    </Text>
  );
}

/** A red dot that breathes while games are live. Static under Reduce Motion. */
export function LiveDot({ size = 8, color = '#E10600', style }: { size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion || !Easing?.inOut) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: PULSE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: PULSE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      accessible={false}
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity }, style]}
    />
  );
}

/** A short double thump for a goal by one of my players. Never throws. */
export function goalHaptic(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
