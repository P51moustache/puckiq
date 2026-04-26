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
import { rinkGlass } from '../constants/theme';

interface PageHeaderProps {
  title: string;
  /** Comma- or space-separated tokens; rendered uppercase. The first token is bright, the rest are muted, separated by middle dots. */
  subtitle?: string;
  /** Optional right-side affordance (search button, etc.). */
  right?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
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
    paddingTop: 4,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
  },
  right: {
    marginLeft: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    fontFamily: 'Display-Bold',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 10,
    color: rinkGlass.textSecondary,
    marginTop: 2,
    letterSpacing: 1.5,
  },
});
