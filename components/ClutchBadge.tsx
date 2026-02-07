import { View, Text, StyleSheet } from 'react-native';
import type { ClutchRatingLevel } from '../types/edgeStats';

interface ClutchBadgeProps {
  rating: ClutchRatingLevel;
  compact?: boolean;
}

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  CLUTCH: { bg: 'rgba(34, 197, 94, 0.2)', text: '#22c55e' },
  CLOSER: { bg: 'rgba(234, 179, 8, 0.2)', text: '#eab308' },
  'ICE COLD': { bg: 'rgba(148, 163, 184, 0.2)', text: '#94a3b8' },
};

export default function ClutchBadge({ rating, compact = false }: ClutchBadgeProps) {
  if (!rating) return null;

  const colors = BADGE_COLORS[rating] ?? BADGE_COLORS.CLOSER;

  return (
    <View
      testID="clutch-badge"
      style={[
        styles.badge,
        { backgroundColor: colors.bg },
        compact && styles.badgeCompact,
      ]}
    >
      <Text
        testID="clutch-badge-text"
        style={[
          styles.text,
          { color: colors.text },
          compact && styles.textCompact,
        ]}
      >
        {rating}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textCompact: {
    fontSize: 8,
  },
});
