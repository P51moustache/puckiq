import AsyncStorage from '@react-native-async-storage/async-storage';
import { ModuleConfig, ModuleId, DashboardPreferences, DEFAULT_MODULES } from '../types/dashboard';

const STORAGE_KEY = 'puckiq_dashboard_modules';

export async function loadDashboardPrefs(): Promise<DashboardPreferences & { isFirstLaunch: boolean }> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...JSON.parse(raw), isFirstLaunch: false };
    }
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
