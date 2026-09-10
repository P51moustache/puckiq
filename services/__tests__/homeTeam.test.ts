import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HOME_TEAM_STORAGE_KEY,
  getStoredHomeTeam,
  setStoredHomeTeam,
} from '../homeTeam';

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('homeTeam storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
    storage.removeItem.mockResolvedValue(undefined);
  });

  it('loads a case-normalized active team', async () => {
    storage.getItem.mockResolvedValue('edm');
    await expect(getStoredHomeTeam()).resolves.toBe('EDM');
    expect(storage.getItem).toHaveBeenCalledWith('puckiq_home_team');
  });

  it('ignores legacy and unknown stored teams', async () => {
    storage.getItem.mockResolvedValue('ARI');
    await expect(getStoredHomeTeam()).resolves.toBeNull();
    storage.getItem.mockResolvedValue('XYZ');
    await expect(getStoredHomeTeam()).resolves.toBeNull();
  });

  it('persists normalized active teams', async () => {
    await setStoredHomeTeam('edm');
    expect(storage.setItem).toHaveBeenCalledWith(HOME_TEAM_STORAGE_KEY, 'EDM');
  });

  it('rejects inactive teams without mutating storage', async () => {
    await expect(setStoredHomeTeam('ARI')).rejects.toThrow('Unknown active NHL team: ARI');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('clears the choice when no followed team remains', async () => {
    await setStoredHomeTeam(null);
    expect(storage.removeItem).toHaveBeenCalledWith(HOME_TEAM_STORAGE_KEY);
  });

  it('surfaces failed writes', async () => {
    storage.setItem.mockRejectedValue(new Error('disk full'));
    await expect(setStoredHomeTeam('EDM')).rejects.toThrow('disk full');
  });
});
