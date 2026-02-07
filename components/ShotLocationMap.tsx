import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { theme } from '../constants/theme';
import type { ShotLocationZone } from '../types/edgeStats';

interface ShotLocationMapProps {
  zones: ShotLocationZone[];
}

// Simplified half-rink layout: 17 zone positions
// Arranged in a 5-row grid representing the offensive half
const ZONE_POSITIONS: Record<string, { x: number; y: number; w: number; h: number }> = {
  // Near slot
  'slotNear': { x: 80, y: 140, w: 40, h: 30 },
  // Mid slot
  'slotMid': { x: 80, y: 105, w: 40, h: 30 },
  // High slot
  'slotHigh': { x: 80, y: 70, w: 40, h: 30 },
  // Left side
  'leftNear': { x: 30, y: 140, w: 45, h: 30 },
  'leftMid': { x: 30, y: 105, w: 45, h: 30 },
  'leftHigh': { x: 30, y: 70, w: 45, h: 30 },
  'leftPoint': { x: 30, y: 35, w: 45, h: 30 },
  // Right side
  'rightNear': { x: 125, y: 140, w: 45, h: 30 },
  'rightMid': { x: 125, y: 105, w: 45, h: 30 },
  'rightHigh': { x: 125, y: 70, w: 45, h: 30 },
  'rightPoint': { x: 125, y: 35, w: 45, h: 30 },
  // Behind net
  'behindNet': { x: 70, y: 175, w: 60, h: 20 },
  // Point / blue line
  'centerPoint': { x: 65, y: 10, w: 70, h: 25 },
  'leftWing': { x: 5, y: 10, w: 55, h: 25 },
  'rightWing': { x: 140, y: 10, w: 55, h: 25 },
  // Neutral zone
  'neutralLeft': { x: 5, y: 35, w: 20, h: 60 },
  'neutralRight': { x: 175, y: 35, w: 20, h: 60 },
};

function getZoneColor(shots: number, maxShots: number): string {
  if (maxShots === 0) return 'rgba(100, 116, 139, 0.3)';
  const ratio = shots / maxShots;
  if (ratio > 0.7) return 'rgba(239, 68, 68, 0.6)'; // Hot
  if (ratio > 0.4) return 'rgba(234, 179, 8, 0.5)'; // Warm
  if (ratio > 0.2) return 'rgba(96, 165, 250, 0.4)'; // Cool
  return 'rgba(100, 116, 139, 0.3)'; // Cold
}

export default function ShotLocationMap({ zones }: ShotLocationMapProps) {
  const [tooltip, setTooltip] = useState<{ area: string; shots: number } | null>(null);

  if (!zones || zones.length === 0) return null;

  const maxShots = Math.max(...zones.map((z) => z.shots), 1);

  return (
    <View testID="shot-location-map" style={styles.container}>
      <Svg width={200} height={200} viewBox="0 0 200 200">
        {zones.map((zone) => {
          const pos = ZONE_POSITIONS[zone.area];
          if (!pos) return null;
          const color = getZoneColor(zone.shots, maxShots);

          return (
            <Rect
              key={zone.area}
              x={pos.x}
              y={pos.y}
              width={pos.w}
              height={pos.h}
              rx={4}
              fill={color}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={0.5}
              onPress={() => setTooltip({ area: zone.area, shots: zone.shots })}
            />
          );
        })}

        {/* Shot count labels for zones with data */}
        {zones.map((zone) => {
          const pos = ZONE_POSITIONS[zone.area];
          if (!pos || zone.shots === 0) return null;
          return (
            <SvgText
              key={`label-${zone.area}`}
              x={pos.x + pos.w / 2}
              y={pos.y + pos.h / 2 + 4}
              textAnchor="middle"
              fill="#e6eef8"
              fontSize={9}
              fontWeight="600"
            >
              {zone.shots}
            </SvgText>
          );
        })}
      </Svg>

      {/* Tooltip */}
      {tooltip && (
        <Pressable
          testID="shot-location-tooltip"
          style={styles.tooltip}
          onPress={() => setTooltip(null)}
        >
          <Text style={styles.tooltipText}>
            {tooltip.area}: {tooltip.shots} shots
          </Text>
        </Pressable>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: 'rgba(239, 68, 68, 0.6)' }]} />
          <Text style={styles.legendText}>Hot</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: 'rgba(234, 179, 8, 0.5)' }]} />
          <Text style={styles.legendText}>Warm</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: 'rgba(96, 165, 250, 0.4)' }]} />
          <Text style={styles.legendText}>Cool</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 8,
  },
  tooltip: {
    marginTop: 8,
    backgroundColor: theme.card,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
  },
  tooltipText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.text,
  },
  legend: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 9,
    color: theme.subtext,
  },
});
