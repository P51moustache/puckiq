/**
 * FloatingTodayBar — appears at the top of the screen once the user has
 * scrolled past the hero. Compact "PuckIQ · TONIGHT 4 · REFRESH" — keeps
 * the page identity visible while you read deeper sections.
 *
 * Driven by a SharedValue scrollY passed in from the parent ScrollView's
 * onScroll handler.
 */

import React from 'react';
import { Text, StyleSheet, Pressable, View, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { rinkGlass } from '../constants/theme';

interface FloatingTodayBarProps {
  scrollY: SharedValue<number>;
  /** Threshold (px) at which the bar fully appears. */
  threshold?: number;
  gameCount?: number;
  onRefresh?: () => void;
}

export default function FloatingTodayBar({
  scrollY,
  threshold = 280,
  gameCount,
  onRefresh,
}: FloatingTodayBarProps) {
  const containerStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollY.value,
      [threshold - 60, threshold],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: progress,
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [threshold - 60, threshold],
            [-20, 0],
            Extrapolation.CLAMP,
          ),
        },
      ],
      // pointerEvents handled below, but disable interaction visually below threshold
    };
  });

  return (
    <Animated.View style={[styles.bar, containerStyle]} pointerEvents="box-none">
      <View style={styles.barInner}>
        <View style={styles.left}>
          <Text style={styles.brand}>PuckIQ</Text>
          <Text style={styles.dot}> · </Text>
          <Text style={styles.context}>
            {gameCount && gameCount > 0 ? `TONIGHT ${gameCount}` : 'BRIEFING'}
          </Text>
        </View>
        {onRefresh && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onRefresh();
            }}
            hitSlop={10}
          >
            <Text style={styles.refresh}>REFRESH</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(10, 14, 26, 0.92)',
    borderBottomWidth: 1,
    borderBottomColor: rinkGlass.glassBorder,
    zIndex: 50,
  },
  barInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brand: {
    fontSize: 16,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    fontFamily: 'Display-Bold',
    letterSpacing: 0.5,
  },
  dot: {
    color: rinkGlass.textMuted,
    fontSize: 13,
  },
  context: {
    fontSize: 11,
    fontWeight: '700',
    color: rinkGlass.blueLight,
    letterSpacing: 1.5,
    fontFamily: rinkGlass.fonts.mono,
  },
  refresh: {
    fontSize: 10,
    fontWeight: '800',
    color: rinkGlass.blueLight,
    letterSpacing: 1.5,
  },
});
