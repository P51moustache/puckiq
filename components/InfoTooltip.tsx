import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import type { GlossaryEntry } from '../constants/glossary';

interface InfoTooltipProps {
  visible: boolean;
  entry: GlossaryEntry | null;
  onClose: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  confidence: 'shield-checkmark',
  factor: 'analytics',
  edge: 'trending-up',
  stat: 'stats-chart',
  category: 'layers',
};

export default function InfoTooltip({ visible, entry, onClose }: InfoTooltipProps) {
  if (!entry) return null;

  const iconName = CATEGORY_ICONS[entry.category] ?? 'information-circle';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(150)} style={StyleSheet.absoluteFill} />
      </Pressable>
      <Animated.View entering={SlideInDown.duration(250).springify().damping(20)} style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Ionicons name={iconName as any} size={18} color={theme.accent} />
            <Text style={styles.term}>{entry.term}</Text>
          </View>
          <Text style={styles.explanation}>{entry.explanation}</Text>
        </View>
        <Pressable onPress={onClose} style={styles.dismissButton}>
          <Text style={styles.dismissText}>Got it</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  content: {
    paddingHorizontal: 20,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  term: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
    letterSpacing: 0.5,
  },
  explanation: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.subtext,
  },
  dismissButton: {
    marginTop: 16,
    marginHorizontal: 20,
    backgroundColor: theme.accent + '22',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.accent,
  },
});
