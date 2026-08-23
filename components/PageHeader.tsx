/**
 * PageHeader — the standardized header for every tab page.
 *
 * Every tab uses this, so the four tabs feel like one app.
 *
 *   24px Display-Bold title with 0.5 letter-spacing
 *   10px uppercase muted subtitle with 1.5 letter-spacing
 *   Optional right-side accessory (search icon, settings cog, etc.)
 *
 * Don't deviate from this in individual tabs.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rinkGlass } from '../constants/theme';

interface PageHeaderProps {
  title: string;
  /** Comma- or space-separated tokens; rendered uppercase. The first token is bright, the rest are muted, separated by middle dots. */
  subtitle?: string;
  /** Optional right-side affordance (search button, etc.). */
  right?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.row, { paddingTop: insets.top + 8 }]} testID="page-header">
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
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  right: {
    marginLeft: 8,
    marginTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    fontFamily: 'Display-Bold',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 10,
    color: rinkGlass.textSecondary,
    marginTop: 2,
    letterSpacing: 1.5,
    lineHeight: 15,
    flexShrink: 1,
  },
});
