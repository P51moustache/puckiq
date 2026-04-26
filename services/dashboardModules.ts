import AsyncStorage from '@react-native-async-storage/async-storage';
import { ModuleConfig, ModuleId, DashboardPreferences, DEFAULT_MODULES } from '../types/dashboard';

// v2 — Stat Sheet pivot: dailyInsight + alerts are off by default.
// Bumping the key resets users who previously had the old defaults so the
// new stat-focused dashboard takes effect on next launch.
const STORAGE_KEY = 'puckiq_dashboard_modules_v2';
const LEGACY_KEY = 'puckiq_dashboard_modules';

export async function loadDashboardPrefs(): Promise<DashboardPreferences & { isFirstLaunch: boolean }> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...JSON.parse(raw), isFirstLaunch: false };
    }
    // First launch on the new key — clean up the v1 record so the upgrade is one-shot.
    await AsyncStorage.removeItem(LEGACY_KEY).catch(() => {});
  } catch (err) {
    console.warn('[DashboardModules] Failed to load preferences:', err);
  }
  return { modules: [...DEFAULT_MODULES], lastCustomized: null, isFirstLaunch: true };
}

export async function saveDashboardPrefs(prefs: DashboardPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn('[DashboardModules] Failed to save preferences:', err);
  }
}

export function toggleModule(modules: ModuleConfig[], id: ModuleId): ModuleConfig[] {
  return modules.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m));
}

export function reorderModules(modules: ModuleConfig[], fromIndex: number, toIndex: number): ModuleConfig[] {
  const result = [...modules];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result.map((m, i) => ({ ...m, order: i }));
}
