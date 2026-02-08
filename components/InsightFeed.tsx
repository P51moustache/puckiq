import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { theme } from '../constants/theme';
import { getTeamLogoUrl } from '../utils/teamLogo';
import type { Insight } from '../types/insights';

interface InsightFeedProps {
  insights: Insight[];
  onShareInsight?: (insightText: string) => void;
  headerLabel?: string;
}

const EDGE_PURPLE = '#a78bfa';

const TYPE_CONFIG: Record<string, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  cardBg: string;
}> = {
  streak: {
    icon: 'flame-outline',
    color: theme.semantic.positive,
    bg: `${theme.semantic.positive}26`,
    cardBg: `${theme.semantic.positive}0A`,
  },
  trend: {
    icon: 'trending-up-outline',
    color: theme.semantic.info,
    bg: `${theme.semantic.info}26`,
    cardBg: `${theme.semantic.info}0A`,
  },
  matchup: {
    icon: 'people-outline',
    color: theme.semantic.neutral,
    bg: `${theme.semantic.neutral}26`,
    cardBg: `${theme.semantic.neutral}0A`,
  },
  h2h: {
    icon: 'people-outline',
    color: theme.semantic.neutral,
    bg: `${theme.semantic.neutral}26`,
    cardBg: `${theme.semantic.neutral}0A`,
  },
  rest: {
    icon: 'time-outline',
    color: theme.semantic.info,
    bg: `${theme.semantic.info}26`,
    cardBg: `${theme.semantic.info}0A`,
  },
  player: {
    icon: 'flame-outline',
    color: theme.semantic.positive,
    bg: `${theme.semantic.positive}26`,
    cardBg: `${theme.semantic.positive}0A`,
  },
  standings: {
    icon: 'trending-up-outline',
    color: theme.semantic.info,
    bg: `${theme.semantic.info}26`,
    cardBg: `${theme.semantic.info}0A`,
  },
  edge: {
    icon: 'analytics-outline',
    color: EDGE_PURPLE,
    bg: `${EDGE_PURPLE}26`,
    cardBg: `${EDGE_PURPLE}0A`,
  },
};

const DEFAULT_CONFIG = {
  icon: 'analytics-outline' as keyof typeof Ionicons.glyphMap,
  color: EDGE_PURPLE,
  bg: `${EDGE_PURPLE}26`,
  cardBg: `${EDGE_PURPLE}0A`,
};

function getConfig(category?: string) {
  if (category && TYPE_CONFIG[category]) return TYPE_CONFIG[category];
  return DEFAULT_CONFIG;
}

function InsightFeedComponent({ insights, onShareInsight, headerLabel }: InsightFeedProps) {
  if (!insights || insights.length === 0) return null;

  const sorted = useMemo(
    () => [...insights].slice(0, 3),
    [insights],
  );

  return (
    <View testID="insight-feed" style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>{headerLabel ?? "INTEL"}</Text>
        <View style={styles.headerAccent} />
      </View>
      {sorted.map((insight, index) => {
        const config = getConfig(insight.category);
        return (
          <Animated.View
            key={`insight-${index}`}
            entering={FadeInUp.duration(300).delay(index * 80)}
          >
            <View style={[styles.card, { backgroundColor: config.cardBg }]}>
              <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
                <Ionicons name={config.icon} size={16} color={config.color} />
              </View>
              <Text style={styles.text} numberOfLines={2}>
                {insight.text}
              </Text>
              {insight.teamAbbrev ? (
                <Image
                  source={{ uri: getTeamLogoUrl(insight.teamAbbrev) }}
                  style={styles.teamLogo}
                  contentFit="contain"
                />
              ) : null}
              {onShareInsight && (
                <Pressable
                  onPress={() => onShareInsight(insight.shareText ?? insight.text)}
                  hitSlop={8}
                  style={styles.shareBtn}
                >
                  <Ionicons name="share-outline" size={14} color={theme.subtext} />
                </Pressable>
              )}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

export default React.memo(InsightFeedComponent);

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    gap: 8,
  },
  headerRow: {
    marginBottom: 4,
  },
  header: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerAccent: {
    width: 32,
    height: 2,
    backgroundColor: theme.accent,
    borderRadius: 1,
    marginTop: 4,
    opacity: 0.6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    flex: 1,
    marginHorizontal: 10,
    fontSize: 15,
    fontWeight: '500',
    color: theme.text,
    lineHeight: 20,
  },
  teamLogo: {
    width: 24,
    height: 24,
  },
  shareBtn: {
    marginLeft: 6,
  },
});
