import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../../constants/theme';
import { MODULE_META, ModuleConfig, ModuleId, DEFAULT_MODULES } from '../../types/dashboard';

const MODULE_IDS: ModuleId[] = ['startSit', 'trending', 'alerts', 'waiverWire', 'matchupEdge', 'dailyInsight'];
const ACCENT_COLORS = rinkGlass.moduleAccents as Record<ModuleId, string>;

interface ModulePickerProps {
  visible: boolean;
  onComplete: (modules: ModuleConfig[]) => void;
}

export default function ModulePicker({ visible, onComplete }: ModulePickerProps) {
  const [selected, setSelected] = useState<Set<ModuleId>>(
    new Set(DEFAULT_MODULES.filter((m) => m.enabled).map((m) => m.id))
  );

  const toggle = (id: ModuleId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const modules: ModuleConfig[] = MODULE_IDS.map((id, i) => ({
      id,
      enabled: selected.has(id),
      order: i,
    }));
    onComplete(modules);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>What matters to you?</Text>
          <Text style={styles.subtitle}>Pick the modules you want on your dashboard. You can change this anytime.</Text>

          <View style={styles.moduleList}>
            {MODULE_IDS.map((id) => {
              const meta = MODULE_META[id];
              const accent = ACCENT_COLORS[id];
              const isSelected = selected.has(id);
              return (
                <TouchableOpacity
                  key={id}
                  testID={`picker-${id}`}
                  style={[
                    styles.moduleRow,
                    { borderLeftColor: accent },
                    isSelected && { borderColor: accent, backgroundColor: 'rgba(255,255,255,0.04)' },
                  ]}
                  onPress={() => toggle(id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={meta.icon as any} size={20} color={accent} style={styles.icon} />
                  <View style={styles.info}>
                    <Text style={styles.moduleTitle}>{meta.title}</Text>
                    <Text style={styles.moduleDesc}>{meta.description}</Text>
                  </View>
                  <View style={[styles.checkbox, isSelected && { backgroundColor: accent, borderColor: accent }]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            testID="picker-confirm"
            style={[styles.confirmButton, selected.size === 0 && styles.confirmDisabled]}
            onPress={handleConfirm}
            disabled={selected.size === 0}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmText}>Let's Go</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: rinkGlass.boards,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
    fontFamily: 'Display-Bold',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: rinkGlass.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  moduleList: {
    gap: 8,
    marginBottom: 20,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: rinkGlass.glass,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    borderLeftWidth: 3,
    borderRadius: 10,
    padding: 12,
  },
  icon: {
    marginRight: 10,
  },
  info: {
    flex: 1,
  },
  moduleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: rinkGlass.textPrimary,
  },
  moduleDesc: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
    marginTop: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: rinkGlass.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: rinkGlass.blueLight,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  confirmDisabled: {
    opacity: 0.4,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
