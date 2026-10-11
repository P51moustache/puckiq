import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ART } from '../../constants/art';
import { Card, colors } from '../coach/ui';

export function InsightCard({
  title,
  detail,
  onPress,
  featured = false,
  compact = false,
  testID,
  icon = 'sparkles',
}: {
  title: string;
  detail: string;
  onPress: () => void;
  featured?: boolean;
  compact?: boolean;
  testID?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${title}. ${detail}`}
      testID={testID}
      style={[
        styles.card,
        featured && styles.featured,
        compact && styles.compact,
      ]}
    >
      {compact ? (
        <>
          <View style={styles.iconChip}>
            <Ionicons name={icon} size={21} color={colors.accent} />
          </View>
          <View style={styles.body}>
            <Text numberOfLines={2} style={styles.title}>
              {title}
            </Text>
            <Text numberOfLines={1} style={styles.detail}>
              {detail}
            </Text>
          </View>
          <View style={styles.detailsCue}>
            <Text style={styles.link}>Details</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.accent} />
          </View>
        </>
      ) : (
        <>
          {featured ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Image
                source={ART.hockeyNight}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                contentPosition="right"
                accessible={false}
              />
              <LinearGradient
                colors={[
                  '#1B1115',
                  'rgba(17,12,16,0.94)',
                  'rgba(5,10,12,0.55)',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          ) : null}
          <View style={styles.top}>
            <Ionicons name={icon} size={15} color={colors.accent} />
            <Text style={styles.kicker}>
              {featured ? 'PuckIQ Insight' : 'Your edge'}
            </Text>
          </View>
          <Text style={[styles.title, featured && styles.featureTitle]}>
            {title}
          </Text>
          <Text style={styles.detail}>{detail}</Text>
          <Text style={styles.link}>
            {featured ? 'Explore this insight' : 'View details'} →
          </Text>
        </>
      )}
    </Card>
  );
}
const styles = StyleSheet.create({
  card: { gap: 5, overflow: 'hidden' },
  featured: { borderColor: 'rgba(255,37,45,0.42)', backgroundColor: '#1B1115' },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 9,
  },
  iconChip: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,37,45,0.09)',
  },
  body: { flex: 1, gap: 3 },
  detailsCue: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  kicker: { flex: 1, fontSize: 12, fontWeight: '500', color: colors.accent },
  title: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.text,
  },
  featureTitle: { fontSize: 15, lineHeight: 19 },
  detail: { fontSize: 13, lineHeight: 18, color: colors.sub },
  link: { fontSize: 12, fontWeight: '600', color: colors.accent, marginTop: 1 },
});
