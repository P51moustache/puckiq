/**
 * SlateRowViz — small dataviz primitives for the Tonight's Slate row.
 *
 * Three pieces:
 *   - DualTeamSplitBar: full-width 32px gradient bar from away color → home
 *     color with a model-probability tick mark. Visually shows favorite +
 *     magnitude in one glance.
 *   - FormSquares: L10 W/L/OTL pattern as 10 thin colored rectangles.
 *   - FactorMiniBar: a labeled bar chart for the top model factor — favored
 *     team value vs underdog value, scaled to fit the row.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { rinkGlass } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';

/* ---------------- DualTeamSplitBar ---------------- */
interface DualTeamSplitBarProps {
  awayAbbrev: string;
  homeAbbrev: string;
  /** Home win probability 0..1. */
  homeProb: number;
  delay?: number;
}

export function DualTeamSplitBar({ awayAbbrev, homeAbbrev, homeProb, delay = 200 }: DualTeamSplitBarProps) {
  const awayColors = getTeamColors(awayAbbrev);
  const homeColors = getTeamColors(homeAbbrev);
  const awayColor = awayColors?.primary ?? '#3a4f7a';
  const homeColor = homeColors?.primary ?? '#7a3a4f';
  const tickPos = useSharedValue(0);

  useEffect(() => {
    tickPos.value = 0;
    tickPos.value = withDelay(
      delay,
      withTiming(homeProb * 100, { duration: 850, easing: Easing.out(Easing.cubic) }),
    );
  }, [homeProb, delay, tickPos]);

  const tickStyle = useAnimatedStyle(() => ({ left: `${tickPos.value}%` }));

  return (
    <View style={styles.splitBarTrack}>
      <LinearGradient
        colors={[awayColor, awayColor + 'BB', homeColor + 'BB', homeColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.splitBarFill}
      />
      <Animated.View style={[styles.splitBarTick, tickStyle]} />
    </View>
  );
}

/* ---------------- FormSquares ---------------- */
interface FormSquaresProps {
  results?: ('W' | 'L' | 'OTL')[];
}

export function FormSquares({ results }: FormSquaresProps) {
  if (!results?.length) return null;
  // Show oldest → newest left-to-right, capped at 10
  const display = results.slice(0, 10).reverse();
  return (
    <View style={styles.formRow}>
      {display.map((r, i) => (
        <View
          key={i}
          style={[
            styles.formSquare,
            r === 'W' && { backgroundColor: rinkGlass.faceoffDot },
            r === 'L' && { backgroundColor: rinkGlass.redLine, opacity: 0.75 },
            r === 'OTL' && { backgroundColor: rinkGlass.powerPlay, opacity: 0.7 },
          ]}
        />
      ))}
    </View>
  );
}

/* ---------------- FactorMiniBar ---------------- */
interface FactorMiniBarProps {
  /** e.g. "5v5 xGF/60" */
  label: string;
  /** Favored team's value */
  favoredValue: number;
  /** Underdog team's value */
  underdogValue: number;
  /** Favored team abbrev (for color tinting + label) */
  favoredAbbrev: string;
  underdogAbbrev: string;
  /** Lower-is-better metrics flip the visual (e.g. GA, save% inverse). Defaults to higher-is-better. */
  higherIsBetter?: boolean;
}

export function FactorMiniBar({
  label,
  favoredValue,
  underdogValue,
  favoredAbbrev,
  underdogAbbrev,
  higherIsBetter = true,
}: FactorMiniBarProps) {
  const fav = getTeamColors(favoredAbbrev)?.primary ?? rinkGlass.blueLight;
  const und = getTeamColors(underdogAbbrev)?.primary ?? rinkGlass.textMuted;
  const max = Math.max(Math.abs(favoredValue), Math.abs(underdogValue), 0.01);
  const favWidth = Math.min(100, (Math.abs(favoredValue) / max) * 100);
  const undWidth = Math.min(100, (Math.abs(underdogValue) / max) * 100);

  // Style note: bar grows from center to give a clear who-leads visual.
  return (
    <View style={styles.factorBlock}>
      <View style={styles.factorLabelRow}>
        <Text style={styles.factorLabel}>{label}</Text>
        <Text style={styles.factorValues}>
          <Text style={[styles.factorValue, { color: fav }]}>{favoredValue.toFixed(2)}</Text>
          <Text style={styles.factorSep}>  vs  </Text>
          <Text style={styles.factorValue}>{underdogValue.toFixed(2)}</Text>
        </Text>
      </View>
      <View style={styles.factorBarTrack}>
        <View style={[styles.factorBarFav, { width: `${favWidth / 2}%`, backgroundColor: fav }]} />
        <View style={styles.factorBarCenter} />
        <View style={[styles.factorBarUnd, { width: `${undWidth / 2}%`, backgroundColor: und }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Split bar
  splitBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 10,
    backgroundColor: rinkGlass.glassBorder,
    position: 'relative',
  },
  splitBarFill: {
    position: 'absolute',
    inset: 0 as any,
    width: '100%',
    height: '100%',
  },
  splitBarTick: {
    position: 'absolute',
    top: -3,
    width: 3,
    height: 12,
    backgroundColor: '#fff',
    borderRadius: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 3,
    transform: [{ translateX: -1.5 }],
  },
  // Form squares
  formRow: {
    flexDirection: 'row',
    gap: 2,
    height: 8,
  },
  formSquare: {
    width: 6,
    height: 8,
    borderRadius: 1,
    backgroundColor: rinkGlass.textMuted,
  },
  // Factor mini-bar
  factorBlock: {
    width: '100%',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: rinkGlass.glassBorder,
    gap: 6,
  },
  factorLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  factorLabel: {
    fontSize: 9,
    color: rinkGlass.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  factorValues: {
    fontFamily: rinkGlass.fonts.mono,
    fontSize: 11,
    color: rinkGlass.textSecondary,
  },
  factorValue: {
    fontWeight: '700',
    color: rinkGlass.textPrimary,
  },
  factorSep: {
    color: rinkGlass.textMuted,
  },
  factorBarTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 4,
  },
  factorBarFav: {
    height: 4,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    alignSelf: 'flex-end',
  },
  factorBarCenter: {
    width: 2,
    height: 8,
    backgroundColor: rinkGlass.textMuted,
    borderRadius: 1,
    marginHorizontal: 0,
  },
  factorBarUnd: {
    height: 4,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
});
