import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rinkGlass } from '../../constants/theme';
import { MODULE_META, ModuleConfig, ModuleId } from '../../types/dashboard';
import { loadDashboardPrefs, saveDashboardPrefs, toggleModule } from '../../services/dashboardModules';
import StartSitModule from './StartSitModule';
import { TrendingModule } from './TrendingModule';
import AlertsModule from './AlertsModule';
import WaiverWireModule from './WaiverWireModule';
import MatchupEdgeModule from './MatchupEdgeModule';
import DailyInsightModule from './DailyInsightModule';
import ModulePicker from './ModulePicker';
import { useDashboardData } from '../../hooks/useDashboardData';
import type { DashboardData } from '../../hooks/useDashboardData';

const ACCENT_COLORS = rinkGlass.moduleAccents as Record<ModuleId, string>;

function renderModule(moduleId: ModuleId, dashData: DashboardData) {
  switch (moduleId) {
    case 'startSit':
      return <StartSitModule players={dashData.startSitPlayers} />;
    case 'trending':
      return <TrendingModule players={dashData.trendingPlayers} />;
    case 'alerts':
      return <AlertsModule alerts={dashData.alerts} />;
    case 'waiverWire':
      return <WaiverWireModule players={dashData.waiverPlayers} />;
    case 'matchupEdge':
      return <MatchupEdgeModule matchups={dashData.matchups} />;
    case 'dailyInsight':
      return <DailyInsightModule insight={dashData.dailyInsight} />;
    default:
      return null;
  }
}

export default function DashboardContainer() {
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const dashData = useDashboardData();

  useEffect(() => {
    loadDashboardPrefs().then((prefs) => {
      setModules(prefs.modules);
      if (prefs.isFirstLaunch) {
        setShowPicker(true);
      }
      setLoading(false);
    });
  }, []);

  const handlePickerComplete = useCallback(
    async (pickedModules: ModuleConfig[]) => {
      setModules(pickedModules);
      setShowPicker(false);
      await saveDashboardPrefs({
        modules: pickedModules,
        lastCustomized: new Date().toISOString().slice(0, 10),
      });
    },
    []
  );

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
      <ModulePicker visible={showPicker} onComplete={handlePickerComplete} />

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
      ) : dashData.isLoading ? (
        <View testID="dashboard-loading" style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={rinkGlass.textSecondary} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      ) : (
        <View
          testID="module-scroll"
          style={styles.scrollContent}
        >
          {enabledModules.map((mod) => (
            <View key={mod.id} testID={`module-card-${mod.id}`}>
              {renderModule(mod.id, dashData)}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: rinkGlass.textSecondary,
  },
});
