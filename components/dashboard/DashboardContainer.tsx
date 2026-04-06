import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, StyleSheet } from 'react-native';
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

const ACCENT_COLORS = rinkGlass.moduleAccents as Record<ModuleId, string>;

/* ── Mock data for visual preview (replaced by real data later) ── */
const MOCK_START_SIT = [
  { id: 1, name: 'Connor McDavid', team: 'EDM', opponent: 'CGY', projectedPoints: 4.2, recommendation: 'START' as const },
  { id: 2, name: 'Leon Draisaitl', team: 'EDM', opponent: 'CGY', projectedPoints: 3.8, recommendation: 'SIT' as const },
  { id: 3, name: 'Nick Suzuki', team: 'MTL', opponent: 'TOR', projectedPoints: 3.1, recommendation: 'START' as const },
];

const MOCK_TRENDING = [
  { id: 1, name: 'Macklin Celebrini', team: 'SJS', flameCount: 5, recentPoints: [2, 4, 3, 5, 4, 6, 3, 5, 7, 4], trend: 'up' as const },
  { id: 2, name: 'Jakub Dobes', team: 'MTL', flameCount: 4, recentPoints: [1, 2, 3, 2, 4, 3, 5, 4, 3, 5], trend: 'up' as const },
];

const MOCK_ALERTS = [
  { id: '1', type: 'goalie' as const, playerName: 'Jakub Dobes', team: 'MTL', message: 'Confirmed starter tonight vs TOR', timestamp: 'Just now', isRosterPlayer: true },
  { id: '2', type: 'injury' as const, playerName: 'Auston Matthews', team: 'TOR', message: 'Upper-body, game-time decision', timestamp: '1h ago', isRosterPlayer: false },
];

const MOCK_WAIVER = [
  { id: 1, name: 'Marco Rossi', team: 'MIN', position: 'C', valueScore: 4.2, ownershipPct: 12, projectedPoints: 3.5, currentPlayerName: 'J.T. Miller', currentPlayerPoints: 2.1 },
  { id: 2, name: 'Shane Wright', team: 'SEA', position: 'C', valueScore: 3.1, ownershipPct: 8, projectedPoints: 2.8 },
];

const MOCK_MATCHUPS = [
  { id: 1, playerName: 'Nathan MacKinnon', team: 'COL', opponent: 'STL', edgeRating: 9, projectedPoints: 4.5, reasons: ['STL allows 4th-most goals to centers', 'PP1 usage at 22+ min'] },
  { id: 2, playerName: 'David Pastrnak', team: 'BOS', opponent: 'DET', edgeRating: 7, projectedPoints: 3.9, reasons: ['DET bottom-5 PK', 'Pastrnak on 5-game point streak'] },
];

const MOCK_INSIGHT = {
  headline: 'Suzuki has quietly outscored McDavid over the last 10 games',
  context: 'Nick Suzuki has 14 points in his last 10, compared to McDavid\'s 11. His PP1 time has increased to 4:30/game.',
  sentiment: 'surprising' as const,
  dataPoint: '14 pts vs 11 pts (last 10 GP)',
};

function renderModule(moduleId: ModuleId) {
  switch (moduleId) {
    case 'startSit':
      return <StartSitModule players={MOCK_START_SIT} />;
    case 'trending':
      return <TrendingModule players={MOCK_TRENDING} />;
    case 'alerts':
      return <AlertsModule alerts={MOCK_ALERTS} />;
    case 'waiverWire':
      return <WaiverWireModule players={MOCK_WAIVER} />;
    case 'matchupEdge':
      return <MatchupEdgeModule matchups={MOCK_MATCHUPS} />;
    case 'dailyInsight':
      return <DailyInsightModule insight={MOCK_INSIGHT} />;
    default:
      return null;
  }
}

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
          {enabledModules.map((mod) => (
            <View key={mod.id} testID={`module-card-${mod.id}`}>
              {renderModule(mod.id)}
            </View>
          ))}
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
