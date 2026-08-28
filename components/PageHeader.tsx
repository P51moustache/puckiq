/**
 * PageHeader — tiny tracked wordmark. The line carries the screen, not the title.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { barn } from '../constants/barn';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.row, { paddingTop: insets.top + 12 }]} testID="page-header">
      <View style={styles.left}>
        <Text style={styles.title} testID="page-header-title">
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} testID="page-header-subtitle">
            {subtitle.toUpperCase()}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  left: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    paddingRight: 8,
  },
  right: {
    marginLeft: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: barn.ink,
    fontFamily: barn.fonts.mono,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  subtitle: {
    flex: 1,
    fontSize: 10,
    color: barn.ghost,
    letterSpacing: 1.8,
    fontFamily: barn.fonts.mono,
    textTransform: 'uppercase',
  },
});
