import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ART } from '../../constants/art';
import { colors } from './theme';

export function HockeyHero({
  title = 'Smarter moves.\nBigger wins.',
  compact = false,
}: {
  title?: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.hero, compact && styles.compact]} testID="hockey-hero">
      <Image
        source={ART.hockeyNight}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="right"
        accessible={false}
      />
      <LinearGradient
        colors={[colors.bg, 'transparent', colors.bg]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.copy, compact && styles.compactCopy]}>
        <Text style={[styles.brand, compact && styles.compactBrand]}>
          Puck<Text style={{ color: colors.accent }}>IQ</Text>
        </Text>
        <Text style={[styles.title, compact && styles.compactTitle]}>
          {title}
        </Text>
        <Text style={styles.caption}>YOUR FANTASY HOCKEY EDGE</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  hero: {
    height: 260,
    overflow: 'hidden',
    marginTop: 22,
    justifyContent: 'flex-end',
  },
  compact: { height: 142, marginTop: 8 },
  compactCopy: { padding: 12, gap: 4 },
  compactBrand: { fontSize: 25 },
  compactTitle: { fontSize: 13, lineHeight: 17, fontWeight: '400' },
  copy: { padding: 22, gap: 7 },
  brand: {
    fontSize: 30,
    fontWeight: '800',
    fontStyle: 'italic',
    color: colors.text,
  },
  title: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '600',
    color: colors.text,
  },
  caption: { fontSize: 10, letterSpacing: 2, color: colors.sub },
});
