import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { theme } from '../../constants/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

// Base skeleton element with shimmer animation
export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200 }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
  }));

  // Combine static and animated styles
  const staticStyle = {
    ...styles.skeleton,
    width: typeof width === 'number' ? width : undefined,
    height,
    borderRadius,
  };

  return (
    <Animated.View
      style={[
        staticStyle,
        typeof width === 'string' ? { width: width as any } : undefined,
        animatedStyle,
        style,
      ]}
    />
  );
}

// Skeleton for text lines
export function SkeletonText({ lines = 1, lastLineWidth = '60%' }: { lines?: number; lastLineWidth?: string }) {
  return (
    <View style={styles.textContainer}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          height={14}
          style={index < lines - 1 ? { marginBottom: 8 } : undefined}
        />
      ))}
    </View>
  );
}

// Skeleton for a card layout
export function SkeletonCard({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.card, style]}>
      <Skeleton width={80} height={20} borderRadius={10} style={{ marginBottom: 12 }} />
      <Skeleton width="70%" height={24} style={{ marginBottom: 8 }} />
      <Skeleton width="50%" height={16} style={{ marginBottom: 16 }} />
      <Skeleton width="100%" height={60} borderRadius={12} style={{ marginBottom: 12 }} />
      <SkeletonText lines={2} />
    </View>
  );
}

// Skeleton specifically for pick cards (TopPickCard/PickCard shape)
export function SkeletonPickCard({ variant = 'normal' }: { variant?: 'top' | 'normal' }) {
  const isTop = variant === 'top';

  return (
    <View style={[styles.pickCard, isTop && styles.topPickCard]}>
      {/* Badge */}
      <Skeleton
        width={isTop ? 90 : 70}
        height={isTop ? 26 : 20}
        borderRadius={isTop ? 20 : 10}
        style={{ marginBottom: isTop ? 16 : 10 }}
      />

      {/* Matchup */}
      <Skeleton
        width={isTop ? '60%' : '80%'}
        height={isTop ? 28 : 18}
        style={{ alignSelf: 'center', marginBottom: isTop ? 8 : 6 }}
      />

      {/* Time */}
      <Skeleton
        width={60}
        height={14}
        style={{ alignSelf: 'center', marginBottom: isTop ? 16 : 10 }}
      />

      {/* Pick box */}
      <View style={[styles.pickBox, isTop && styles.topPickBox]}>
        <Skeleton width={50} height={10} style={{ marginBottom: 6 }} />
        <Skeleton width={isTop ? 60 : 40} height={isTop ? 32 : 20} style={{ marginBottom: 4 }} />
        <Skeleton width={isTop ? 80 : 50} height={12} />
      </View>

      {/* Key factors (top variant only) */}
      {isTop && (
        <View style={styles.factorsBox}>
          <Skeleton width={100} height={12} style={{ marginBottom: 8 }} />
          <SkeletonText lines={3} lastLineWidth="80%" />
        </View>
      )}

      {/* Button */}
      <Skeleton
        width="100%"
        height={isTop ? 48 : 36}
        borderRadius={isTop ? 12 : 8}
        style={{ marginTop: isTop ? 16 : 8 }}
      />
    </View>
  );
}

// Skeleton for the stats row on home screen
export function SkeletonStatsRow() {
  return (
    <View style={styles.statsRow}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.statItem}>
          <Skeleton width={40} height={28} style={{ marginBottom: 4 }} />
          <Skeleton width={60} height={12} />
        </View>
      ))}
    </View>
  );
}

// Full home screen loading skeleton
export function SkeletonHomeScreen() {
  return (
    <View style={styles.homeContainer}>
      {/* Header area */}
      <View style={styles.homeHeader}>
        <Skeleton width={120} height={32} style={{ marginBottom: 8 }} />
        <Skeleton width={200} height={16} />
      </View>

      {/* Stats row */}
      <SkeletonStatsRow />

      {/* Top pick card */}
      <SkeletonPickCard variant="top" />

      {/* More picks section */}
      <Skeleton width={100} height={20} style={{ marginBottom: 12, marginTop: 8 }} />
      <View style={styles.picksGrid}>
        <SkeletonPickCard variant="normal" />
        <SkeletonPickCard variant="normal" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: theme.subtle,
  },
  textContainer: {
    width: '100%',
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.subtle,
  },
  pickCard: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#334e8d66',
    width: '48%',
  },
  topPickCard: {
    width: '100%',
    padding: 20,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.accent,
  },
  pickBox: {
    backgroundColor: '#071a3699',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  topPickBox: {
    borderRadius: 12,
    padding: 16,
  },
  factorsBox: {
    backgroundColor: '#071a3699',
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  homeContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  homeHeader: {
    marginBottom: 20,
  },
  picksGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
