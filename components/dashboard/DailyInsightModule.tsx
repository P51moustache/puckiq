import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass, theme } from '../../constants/theme';

export interface DailyInsight {
  headline: string;
  context: string;
  sentiment: 'bullish' | 'bearish' | 'surprising';
  dataPoint?: string;
}

const SENTIMENT_CONFIG = {
  bullish: {
    background: 'rgba(6, 214, 160, 0.12)',
    stripe: rinkGlass.faceoffDot,
    icon: 'trending-up' as const,
  },
  bearish: {
    background: 'rgba(230, 57, 70, 0.12)',
    stripe: rinkGlass.redLine,
    icon: 'trending-down' as const,
  },
  surprising: {
    background: 'rgba(255, 214, 10, 0.12)',
    stripe: rinkGlass.powerPlay,
    icon: 'alert-circle' as const,
  },
};

export default function DailyInsightModule({ insight }: { insight: DailyInsight | null }) {
  const [expanded, setExpanded] = useState(false);
  const pressed = useSharedValue(1);

  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressed.value }],
  }));

  if (!insight) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.accentStripe, { backgroundColor: rinkGlass.moduleAccents.dailyInsight }]} />
          <Text style={styles.title}>Daily Insight</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="bulb-outline" size={32} color={rinkGlass.textMuted} />
          <Text style={styles.emptyText}>No insight today</Text>
        </View>
      </View>
    );
  }

  const config = SENTIMENT_CONFIG[insight.sentiment];

  return (
    <Animated.View
      entering={FadeInUp.delay(100).springify().damping(theme.animation.spring.damping).stiffness(theme.animation.spring.stiffness)}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={[styles.accentStripe, { backgroundColor: rinkGlass.moduleAccents.dailyInsight }]} />
        <Text style={styles.title}>Daily Insight</Text>
      </View>

      <Pressable
        testID="insight-tap"
        onPress={() => setExpanded(!expanded)}
        onPressIn={() => { pressed.value = withTiming(rinkGlass.pressScale, { duration: 100 }); }}
        onPressOut={() => { pressed.value = withTiming(1, { duration: 100 }); }}
      >
        <Animated.View
          testID="insight-card"
          style={[styles.card, { backgroundColor: config.background }, pressAnimStyle]}
        >
          {/* Left accent stripe */}
          <View style={[styles.leftStripe, { backgroundColor: config.stripe }]} />

          {/* Share button */}
          <Pressable testID="share-button" style={styles.shareButton}>
            <Ionicons name="share-outline" size={20} color={rinkGlass.textSecondary} />
          </Pressable>

          {/* Sentiment icon */}
          <View style={styles.iconRow}>
            <Ionicons name={config.icon} size={20} color={config.stripe} />
          </View>

          {/* Headline */}
          <Text style={styles.headline}>{insight.headline}</Text>

          {/* Expanded content */}
          {expanded && (
            <View style={styles.expandedContent}>
              <Text style={styles.contextText}>{insight.context}</Text>
              {insight.dataPoint && (
                <View style={styles.dataPointContainer}>
                  <Text style={styles.dataPointText}>{insight.dataPoint}</Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  accentStripe: {
    width: 3,
    height: 20,
    borderRadius: 2,
    marginRight: 10,
  },
  title: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 18,
    color: rinkGlass.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    padding: 20,
    paddingLeft: 28,
    overflow: 'hidden',
  },
  leftStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  shareButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: rinkGlass.glass,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconRow: {
    marginBottom: 8,
  },
  headline: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 24,
    color: rinkGlass.textPrimary,
    lineHeight: 30,
    paddingRight: 40,
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: rinkGlass.glassBorder,
  },
  contextText: {
    fontSize: 14,
    color: rinkGlass.textSecondary,
    lineHeight: 20,
  },
  dataPointContainer: {
    marginTop: 10,
    backgroundColor: rinkGlass.glass,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dataPointText: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 14,
    color: rinkGlass.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: rinkGlass.textMuted,
  },
});
