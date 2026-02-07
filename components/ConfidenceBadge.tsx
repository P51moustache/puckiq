import { View, Text, StyleSheet } from 'react-native';

interface ConfidenceBadgeProps {
  confidence: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
}

type ConfidenceTier = {
  label: string;
  color: string;
  bgColor: string;
};

function getTier(confidence: number): ConfidenceTier {
  // Confidence is derived from |homeWinProb - 50| * 2, giving a 0-100 scale.
  // NHL games typically produce probabilities in the 55-82% range (scores 10-64).
  // Thresholds are calibrated so tiers distribute meaningfully across that range.
  if (confidence >= 70) {
    return { label: 'LOCK', color: '#FFB81C', bgColor: 'rgba(255, 184, 28, 0.15)' };
  }
  if (confidence >= 45) {
    return { label: 'STRONG', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)' };
  }
  if (confidence >= 20) {
    return { label: 'LEAN', color: '#60a5fa', bgColor: 'rgba(96, 165, 250, 0.15)' };
  }
  return { label: 'TOSS-UP', color: '#98a6bf', bgColor: 'rgba(152, 166, 191, 0.12)' };
}

const SIZE_CONFIG = {
  sm: { fontSize: 10, paddingH: 6, paddingV: 3, borderRadius: 6 },
  md: { fontSize: 12, paddingH: 10, paddingV: 5, borderRadius: 8 },
  lg: { fontSize: 14, paddingH: 14, paddingV: 7, borderRadius: 10 },
};

export function ConfidenceBadge({ confidence, size = 'md' }: ConfidenceBadgeProps) {
  const tier = getTier(confidence);
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <View
      testID="confidence-badge"
      style={[
        styles.badge,
        {
          backgroundColor: tier.bgColor,
          borderColor: tier.color,
          paddingHorizontal: sizeConfig.paddingH,
          paddingVertical: sizeConfig.paddingV,
          borderRadius: sizeConfig.borderRadius,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: tier.color,
            fontSize: sizeConfig.fontSize,
          },
        ]}
      >
        {tier.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '800',
    letterSpacing: 1,
  },
});
