import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, contentFrame, PrimaryButton } from '../coach/ui';

/** Keeps the local plan action and fantasy-host handoff visible above the tabs. */
export function LineupActionsFooter({
  bottom,
  locked,
  disabled,
  onApply,
  hostName,
  onOpenHost,
}: {
  bottom: number;
  locked: boolean;
  disabled: boolean;
  onApply: () => void;
  hostName?: string;
  onOpenHost?: () => void;
}) {
  return (
    <View style={[styles.footer, { bottom }]}>
      <View style={[styles.content, contentFrame]}>
        <PrimaryButton
          label={locked ? 'Lineup locked' : 'Apply lineup'}
          disabled={disabled}
          onPress={onApply}
          testID="lineup-apply"
        />
        {hostName && onOpenHost ? (
          <Pressable
            style={styles.host}
            onPress={onOpenHost}
            accessibilityRole="link"
            hitSlop={8}
          >
            <Ionicons name="open-outline" size={12} color={colors.sub} />
            <Text style={styles.note}>Make changes in {hostName}</Text>
          </Pressable>
        ) : (
          <Text style={[styles.note, styles.host]}>
            Saved in PuckIQ · Apply changes in your fantasy host
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  content: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
  host: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
    minHeight: 28,
    gap: 4,
    textAlign: 'center',
  },
  note: { fontSize: 12, lineHeight: 16, color: colors.sub },
});
