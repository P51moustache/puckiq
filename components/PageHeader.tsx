/**
 * Page titles and controls; compact headers keep the concept's information density.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, contentFrame, display, IconButton } from './coach/ui';
import { useOpenSettings } from './SettingsLauncher';

interface PageHeaderProps {
  title: string;
  /** Optional muted line under the title. */
  subtitle?: string;
  /** Optional right-side affordance (buttons, a segmented control). */
  right?: React.ReactNode;
  /** Optional control above the title (e.g. the team switcher). */
  accessory?: React.ReactNode;
  compact?: boolean;
}

export default function PageHeader({
  title,
  subtitle,
  right,
  accessory,
  compact = true,
}: PageHeaderProps) {
  const insets = useSafeAreaInsets();
  const openSettings = useOpenSettings();

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.compactWrap,
        contentFrame,
        { paddingTop: insets.top + (compact ? 0 : 6) },
      ]}
      testID="page-header"
    >
      {!compact && (accessory || right) ? (
        <View style={styles.controls}>
          <View style={styles.accessory}>{accessory}</View>
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
      ) : null}
      <View style={[styles.titleRow, compact && styles.compactRow]}>
        {compact ? (
          <View style={styles.compactAccessory}>{accessory}</View>
        ) : null}
        <Text
          style={[styles.title, compact && styles.compactTitle]}
          testID="page-header-title"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {title}
        </Text>
        <View style={[styles.headerActions, compact && styles.compactActions]}>
          {compact && right ? <View style={styles.right}>{right}</View> : null}
          {openSettings ? (
            <IconButton
              compact={compact}
              icon="settings-outline"
              label="Settings"
              onPress={openSettings}
              testID="page-header-settings"
            />
          ) : null}
        </View>
      </View>
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
  compactWrap: { paddingHorizontal: 12, paddingBottom: 2 },
  compactRow: { minHeight: 40, gap: 6 },
  compactAccessory: { width: 94 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  compactActions: { width: 94, justifyContent: 'flex-end' },
  compactTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0,
    textAlign: 'center',
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    ...display(27),
    flex: 1,
    letterSpacing: -1,
    textTransform: 'none',
  },
  subtitle: {
    fontSize: 15,
    color: colors.sub,
    marginTop: 2,
  },
});
