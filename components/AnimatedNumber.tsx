/**
 * AnimatedNumber — counts up from 0 to a target value with a JS-thread tween.
 *
 * We tried the Reanimated TextInput trick first, but mutating
 * defaultValue every frame crashed the simulator. This version drives the
 * count from a JS rAF loop — slightly less efficient than worklets, but
 * stable and good enough for one-shot mount animations.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  delay?: number;
  style?: StyleProp<TextStyle>;
}

const defaultFormat = (n: number) => Math.round(n).toString();
// Easing: cubic-out, the same curve we use for the prob bar.
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export default function AnimatedNumber({
  value,
  format = defaultFormat,
  duration = 850,
  delay = 0,
  style,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const toRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = 0;
    toRef.current = value;
    startRef.current = null;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    let stopped = false;

    const start = () => {
      const tick = (ts: number) => {
        if (stopped) return;
        if (startRef.current == null) startRef.current = ts;
        const elapsed = ts - startRef.current;
        const t = Math.min(1, elapsed / duration);
        const eased = easeOutCubic(t);
        const current = fromRef.current + (toRef.current - fromRef.current) * eased;
        setDisplay(current);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const t = setTimeout(start, delay);
    return () => {
      stopped = true;
      clearTimeout(t);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, delay]);

  return <Text style={style}>{format(display)}</Text>;
}
