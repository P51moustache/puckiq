import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'puckiq_favorite_teams';

type FavoriteTeamsListener = (favorites: FavoriteTeam[]) => void;

const listeners = new Set<FavoriteTeamsListener>();

export interface FavoriteTeam {
  triCode: string;
  fullName: string;
  addedAt: string; // ISO timestamp
}

function publishFavoriteTeams(favorites: FavoriteTeam[]): void {
  const snapshot = favorites.map((favorite) => ({ ...favorite }));
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch (error) {
      console.error('Error notifying favorite team subscriber:', error);
    }
  }
}

export function subscribeToFavoriteTeams(listener: FavoriteTeamsListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Corrective writes must distinguish unavailable storage from an empty collection.
export async function readFavoriteTeams(): Promise<FavoriteTeam[]> {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  const parsed: unknown = json ? JSON.parse(json) : [];
  if (!Array.isArray(parsed)) throw new Error('Followed teams could not be read. Stored preferences have been preserved.');
  return parsed.filter((item): item is FavoriteTeam => !!item && typeof item.triCode === 'string' && typeof item.fullName === 'string' && typeof item.addedAt === 'string');
}

// Preserve the legacy read-only fallback for existing screens.
export async function getFavoriteTeams(): Promise<FavoriteTeam[]> {
  try {
    return await readFavoriteTeams();
  } catch (error) {
    console.error('Error loading favorite teams:', error);
    return [];
  }
}

// Check if a team is favorited
export async function isTeamFavorited(triCode: string): Promise<boolean> {
  try {
    const favorites = await getFavoriteTeams();
    return favorites.some(team => team.triCode === triCode);
  } catch (error) {
    console.error('Error checking if team is favorited:', error);
    return false;
  }
}

// One queue covers provider and legacy callers, including atomic toggles.
let pendingMutation: Promise<unknown> = Promise.resolve();
function mutate<T>(operation: (favorites: FavoriteTeam[]) => Promise<T>): Promise<T> {
  const next = pendingMutation.catch(() => undefined).then(async () => operation(await readFavoriteTeams()));
  pendingMutation = next;
  return next;
}
async function persist(favorites: FavoriteTeam[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  publishFavoriteTeams(favorites);
}
export function addFavoriteTeam(triCode: string, fullName: string): Promise<void> {
  return mutate(async favorites => {
    if (favorites.some(team => team.triCode === triCode)) return;
    await persist([...favorites, { triCode, fullName, addedAt: new Date().toISOString() }]);
  });
}
export function removeFavoriteTeam(triCode: string): Promise<void> {
  return mutate(async favorites => { await persist(favorites.filter(team => team.triCode !== triCode)); });
}
export function toggleFavoriteTeam(triCode: string, fullName: string): Promise<boolean> {
  return mutate(async favorites => {
    const exists = favorites.some(team => team.triCode === triCode);
    await persist(exists ? favorites.filter(team => team.triCode !== triCode) : [...favorites, { triCode, fullName, addedAt: new Date().toISOString() }]);
    return !exists;
  });
}
