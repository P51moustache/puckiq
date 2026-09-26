/**
 * PageHeader — F1-style: a small control row (team pill, actions) over a big, heavy,
 * italic uppercase title. Every tab uses it so the app reads as one publication.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, contentFrame, display } from './coach/ui';

interface PageHeaderProps {
  title: string;
  /** Optional muted line under the title. */
  subtitle?: string;
  /** Optional right-side affordance (buttons, a segmented control). */
  right?: React.ReactNode;
  /** Optional control above the title (e.g. the team switcher). */
  accessory?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, right, accessory }: PageHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, contentFrame, { paddingTop: insets.top + 6 }]} testID="page-header">
      {accessory || right ? (
        <View style={styles.controls}>
          <View style={styles.accessory}>{accessory}</View>
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
      ) : null}
      <Text style={styles.title} testID="page-header-title" numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} testID="page-header-subtitle">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.bg,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    marginBottom: 6,
  },
  accessory: {
    flexShrink: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  title: {
    ...display(38),
    letterSpacing: -1,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 14,
    color: colors.sub,
    marginTop: 2,
  },
});
