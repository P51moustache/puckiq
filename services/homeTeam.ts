import AsyncStorage from '@react-native-async-storage/async-storage';
import { getArenaTeam } from '../constants/arenaTheme';

export const HOME_TEAM_STORAGE_KEY = 'puckiq_home_team';

export async function getStoredHomeTeam(): Promise<string | null> {
  const stored = await AsyncStorage.getItem(HOME_TEAM_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  return getArenaTeam(stored)?.abbrev ?? null;
}

export async function setStoredHomeTeam(abbrev: string | null): Promise<void> {
  if (abbrev === null) {
    await AsyncStorage.removeItem(HOME_TEAM_STORAGE_KEY);
    return;
  }

  const team = getArenaTeam(abbrev);
  if (!team) {
    throw new Error(`Unknown active NHL team: ${abbrev}`);
  }

  await AsyncStorage.setItem(HOME_TEAM_STORAGE_KEY, team.abbrev);
}
