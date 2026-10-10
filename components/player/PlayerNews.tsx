/** ESPN headlines that mention him, shown as-is, linked and credited. Hidden when there are none. */

import React from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import type { RosterNewsItem } from '../../types/fantasy';
import { Card, colors, SectionLabel } from '../coach/ui';
import { sectionStyles } from './styles';

export function PlayerNews({ items }: { items: RosterNewsItem[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <SectionLabel title="In the news" />
      <Card style={styles.newsCard}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => Linking.openURL(item.url)}
            style={({ pressed }) => [styles.newsRow, pressed && sectionStyles.pressed]}
            accessibilityRole="link"
            testID="player-news-item"
          >
            <Text style={styles.newsTitle}>{item.title}</Text>
            <Text style={styles.newsMeta}>ESPN{item.publishedAt ? ` · ${new Date(item.publishedAt).toLocaleDateString()}` : ''} ↗</Text>
          </Pressable>
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  newsCard: {
    paddingVertical: 4,
  },
  newsRow: {
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 3,
  },
  newsTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: colors.text,
  },
  newsMeta: {
    fontSize: 11,
    color: colors.muted,
  },
});
