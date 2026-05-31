import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { theme } from '../constants/theme';
import { getTeamLogoUrl } from '../utils/teamLogo';
import type { Insight } from '../types/insights';

interface Props {
  insight: Insight;
  index?: number;
  onShare?: (text: string) => void;
}

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  trend: 'trending-up-outline',
  regression: 'swap-vertical-outline',
  goalie: 'shield-outline',
};

function accentFor(sentiment: Insight['sentiment']): string {
  if (sentiment === 'positive') return theme.semantic.positive;
  if (sentiment === 'negative') return theme.semantic.negative;
  return theme.semantic.neutral;
}

function InsightFinderCardComponent({ insight, index = 0, onShare }: Props) {
  const accent = accentFor(insight.sentiment);
  const icon = CATEGORY_ICON[insight.category] ?? 'analytics-outline';

  return (
    <Animated.View entering={FadeInUp.duration(280).delay(Math.min(index, 8) * 60)}>
      <View style={[styles.card, { borderLeftColor: accent }]}>
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: `${accent}22` }]}>
            <Ionicons name={icon} size={16} color={accent} />
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {insight.text}
          </Text>
          {insight.teamAbbrev ? (
            <Image
              source={{ uri: getTeamLogoUrl(insight.teamAbbrev) }}
              style={styles.logo}
              contentFit="contain"
            />
          ) : null}
        </View>

        {insight.detail ? <Text style={styles.detail}>{insight.detail}</Text> : null}

        {insight.metrics && insight.metrics.length > 0 ? (
          <View style={styles.metricsRow}>
            {insight.metrics.map((m, i) => (
              <View key={`${insight.id}-m${i}`} style={styles.metricChip}>
                <Text style={styles.metricLabel}>{m.label}</Text>
                <Text style={styles.metricValue}>{m.value}</Text>
                {m.context ? <Text style={styles.metricContext}>{m.context}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {onShare ? (
          <Pressable
            onPress={() => onShare(insight.shareText ?? insight.text)}
            hitSlop={8}
            style={styles.shareBtn}
          >
            <Ionicons name="share-outline" size={14} color={theme.subtext} />
            <Text style={styles.shareLabel}>Share</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default React.memo(InsightFinderCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderLeftWidth: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    marginHorizontal: 10,
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
    lineHeight: 20,
  },
  logo: {
    width: 24,
    height: 24,
  },
  detail: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '400',
    color: theme.subtext,
    lineHeight: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  metricChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.subtext,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
    marginTop: 1,
  },
  metricContext: {
    fontSize: 11,
    color: theme.subtext,
    marginTop: 1,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 10,
  },
  shareLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.subtext,
  },
});
