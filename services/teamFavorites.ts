import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'puckiq_favorite_teams';

export interface FavoriteTeam {
  triCode: string;
  fullName: string;
  addedAt: string; // ISO timestamp
}

// Get all favorite teams
export async function getFavoriteTeams(): Promise<FavoriteTeam[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : [];
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

// Add a team to favorites
export async function addFavoriteTeam(triCode: string, fullName: string): Promise<void> {
  try {
    const favorites = await getFavoriteTeams();

    // Check if already favorited
    if (favorites.some(team => team.triCode === triCode)) {
      return;
    }

    const newFavorite: FavoriteTeam = {
      triCode,
      fullName,
      addedAt: new Date().toISOString(),
    };

    favorites.push(newFavorite);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error('Error adding favorite team:', error);
    throw error;
  }
}

// Remove a team from favorites
export async function removeFavoriteTeam(triCode: string): Promise<void> {
  try {
    const favorites = await getFavoriteTeams();
    const updated = favorites.filter(team => team.triCode !== triCode);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error removing favorite team:', error);
    throw error;
  }
}

// Toggle a team's favorite status
export async function toggleFavoriteTeam(triCode: string, fullName: string): Promise<boolean> {
  try {
    const isFavorited = await isTeamFavorited(triCode);

    if (isFavorited) {
      await removeFavoriteTeam(triCode);
      return false;
    } else {
      await addFavoriteTeam(triCode, fullName);
      return true;
    }
  } catch (error) {
    console.error('Error toggling favorite team:', error);
    throw error;
  }
}
