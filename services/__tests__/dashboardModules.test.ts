import { loadDashboardPrefs, saveDashboardPrefs, reorderModules, toggleModule } from '../dashboardModules';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('dashboardModules', () => {
  beforeEach(() => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns default modules when no prefs saved', async () => {
    const prefs = await loadDashboardPrefs();
    expect(prefs.modules).toHaveLength(6);
    expect(prefs.modules[0].id).toBe('startSit');
  });

  it('saves and loads custom preferences', async () => {
    const custom = {
      modules: [
        { id: 'trending' as const, enabled: true, order: 0 },
        { id: 'startSit' as const, enabled: false, order: 1 },
      ],
      lastCustomized: '2026-04-05',
    };
    await saveDashboardPrefs(custom);
    // Verify setItem was called with the right data
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'puckiq_dashboard_modules',
      JSON.stringify(custom)
    );
    // Mock getItem to return saved data for the load call
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(custom));
    const loaded = await loadDashboardPrefs();
    expect(loaded.modules[0].id).toBe('trending');
  });

  it('toggles a module on/off', () => {
    const modules = [{ id: 'alerts' as const, enabled: true, order: 0 }];
    const result = toggleModule(modules, 'alerts');
    expect(result[0].enabled).toBe(false);
  });

  it('reorders modules', () => {
    const modules = [
      { id: 'startSit' as const, enabled: true, order: 0 },
      { id: 'trending' as const, enabled: true, order: 1 },
    ];
    const result = reorderModules(modules, 1, 0);
    expect(result[0].id).toBe('trending');
    expect(result[0].order).toBe(0);
    expect(result[1].id).toBe('startSit');
    expect(result[1].order).toBe(1);
  });
});
