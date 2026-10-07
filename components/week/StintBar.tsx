/**
 * One day of a player's stint strip. Solid team colour: a game that counts (free: any
 * game). Hatched amber outline: he plays, but your lineup has no slot for him that night.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { teamTile } from '../../constants/teamTiles';
import { colors } from '../coach/ui';
import { DAY_GAP, HATCH, JOIN_RADIUS, PAST_OPACITY, type GridMetrics } from './gridMetrics';
import { barLabel, type StintCell } from './stints';

export function StintBar({ cell, team, metrics, hatchId }: { cell: StintCell; team: string; metrics: GridMetrics; hatchId: string }) {
  if (cell.kind === 'none') return null;
  const end = metrics.barHeight / 2;
  const left = cell.joinsPrev ? JOIN_RADIUS : end;
  const right = cell.joinsNext ? JOIN_RADIUS : end;
  const shape = {
    height: metrics.barHeight,
    borderTopLeftRadius: left,
    borderBottomLeftRadius: left,
    borderTopRightRadius: right,
    borderBottomRightRadius: right,
  };
  const bench = cell.kind === 'bench';
  const { tile, on } = teamTile(team);
  return (
    <View style={[styles.bar, shape, bench ? styles.bench : { backgroundColor: tile }, cell.past && styles.past]} testID={`stint-${cell.kind}`}>
      {bench ? <Hatch id={hatchId} /> : null}
      <Text
        style={[styles.label, { fontSize: metrics.labelSize, color: bench ? colors.warn : on }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={1}
      >
        {barLabel(cell, metrics.long)}
      </Text>
    </View>
  );
}

/**
 * Diagonal amber stripes filling the parent (which clips them to its rounded shape).
 * A user-space pattern keeps the pitch and angle the same on every bar length.
 * `id` must be unique within the screen.
 */
export function Hatch({ id }: { id: string }) {
  const mid = HATCH.pitch / 2;
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id={id} patternUnits="userSpaceOnUse" width={HATCH.pitch} height={HATCH.pitch} patternTransform="rotate(45)">
          <Line x1={mid} y1={0} x2={mid} y2={HATCH.pitch} stroke={colors.warn} strokeWidth={HATCH.stroke} strokeOpacity={HATCH.opacity} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignSelf: 'stretch',
    marginHorizontal: DAY_GAP / 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  bench: {
    // Clips the hatch to the rounded bar.
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: HATCH.outline,
    borderColor: colors.warn,
  },
  past: {
    opacity: PAST_OPACITY,
  },
  label: {
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
