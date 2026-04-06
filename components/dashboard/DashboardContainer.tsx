import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../../constants/theme';
import { MODULE_META, ModuleConfig, ModuleId } from '../../types/dashboard';
import { loadDashboardPrefs, saveDashboardPrefs, toggleModule } from '../../services/dashboardModules';

const ACCENT_COLORS = rinkGlass.moduleAccents as Record<ModuleId, string>;

export default function DashboardContainer() {
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardPrefs().then((prefs) => {
      setModules(prefs.modules);
      setLoading(false);
    });
  }, []);

  const handleToggle = useCallback(
    async (id: ModuleId) => {
      const updated = toggleModule(modules, id);
      setModules(updated);
      await saveDashboardPrefs({
        modules: updated,
        lastCustomized: new Date().toISOString().slice(0, 10),
      });
    },
    [modules]
  );

  const enabledModules = modules
    .filter((m) => m.enabled)
    .sort((a, b) => a.order - b.order);

  if (loading) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Command Center</Text>
        <TouchableOpacity
          testID="edit-mode-button"
          onPress={() => setEditMode((prev) => !prev)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={editMode ? 'checkmark-circle' : 'settings-outline'}
            size={22}
            color={editMode ? rinkGlass.faceoffDot : rinkGlass.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {editMode ? (
        <View testID="edit-mode-container" style={styles.editList}>
          {modules
            .sort((a, b) => a.order - b.order)
            .map((mod) => {
              const meta = MODULE_META[mod.id];
              const accent = ACCENT_COLORS[mod.id];
              return (
                <View key={mod.id} style={[styles.editRow, { borderLeftColor: accent }]}>
                  <View style={styles.editInfo}>
                    <Text style={styles.editTitle}>{meta.title}</Text>
                    <Text style={styles.editDesc}>{meta.description}</Text>
                  </View>
                  <Switch
                    testID={`toggle-${mod.id}`}
                    value={mod.enabled}
                    onValueChange={() => handleToggle(mod.id)}
                    trackColor={{ false: rinkGlass.textMuted, true: accent }}
                    thumbColor="#fff"
                  />
                </View>
              );
            })}
        </View>
      ) : (
        <ScrollView
          testID="module-scroll"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {enabledModules.map((mod) => {
            const meta = MODULE_META[mod.id];
            const accent = ACCENT_COLORS[mod.id];
            return (
              <View
                key={mod.id}
                testID={`module-card-${mod.id}`}
                style={[styles.card, { borderLeftColor: accent, borderLeftWidth: 3 }]}
              >
                <View style={styles.cardHeader}>
                  <Ionicons name={meta.icon as any} size={18} color={accent} />
                  <Text style={styles.cardTitle}>{meta.title}</Text>
                </View>
                <Text style={styles.cardPlaceholder}>{meta.description}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: rinkGlass.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: rinkGlass.glass,
    borderColor: rinkGlass.glassBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: rinkGlass.textPrimary,
  },
  cardPlaceholder: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
    marginLeft: 26,
  },
  editList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: rinkGlass.glass,
    borderColor: rinkGlass.glassBorder,
    borderWidth: 1,
    borderRadius: 12,
    borderLeftWidth: 3,
    padding: 14,
  },
  editInfo: {
    flex: 1,
    marginRight: 12,
  },
  editTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: rinkGlass.textPrimary,
  },
  editDesc: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
    marginTop: 2,
  },
});
