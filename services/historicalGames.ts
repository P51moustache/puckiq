/**
 * Historical Games Service
 * Stores and queries NHL game results for backtesting prediction models
 *
 * Data is compressed and stored in AsyncStorage by season
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as pako from 'pako';

// Storage key pattern: puckiq_historical_games_{season}
const STORAGE_KEY_PREFIX = 'puckiq_historical_games_';
const SEEDING_STATUS_KEY = 'puckiq_seeding_status';

/**
 * Historical game result stored for backtesting
 */
export interface HistoricalGame {
  id: number;
  date: string;           // YYYY-MM-DD format
  homeTeam: string;       // Team abbreviation
  awayTeam: string;       // Team abbreviation
  homeScore: number;
  awayScore: number;
  winner: 'home' | 'away';
  homeGoalie?: string;    // Goalie name if available
  awayGoalie?: string;    // Goalie name if available
}

/**
 * Storage schema for a season's games
 */
interface SeasonGamesData {
  season: string;         // e.g., "20242025"
  games: HistoricalGame[];
  lastUpdated: string;    // ISO timestamp
  gamesCount: number;
}

/**
 * Seeding status tracking
 */
interface SeedingStatus {
  [seasonId: string]: {
    isSeeded: boolean;
    lastDate: string;     // Last date that was fetched
    gamesCount: number;
    completedAt?: string; // ISO timestamp when seeding completed
  };
}

/**
 * Progress callback for seeding operations
 */
export type SeedingProgressCallback = (progress: {
  currentDate: string;
  gamesLoaded: number;
  totalDays: number;
  currentDay: number;
}) => void;

/**
 * Get the storage key for a season
 */
function getStorageKey(seasonId: string): string {
  return `${STORAGE_KEY_PREFIX}${seasonId}`;
}

/**
 * Compress JSON data for storage
 */
function compressData(data: SeasonGamesData): string {
  const jsonString = JSON.stringify(data);
  const compressed = pako.deflate(jsonString);
  // Convert Uint8Array to base64 string for storage
  const binary = String.fromCharCode.apply(null, Array.from(compressed));
  return btoa(binary);
}

/**
 * Decompress data from storage
 */
function decompressData(compressedString: string): SeasonGamesData | null {
  try {
    // Convert base64 back to Uint8Array
    const binary = atob(compressedString);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decompressed = pako.inflate(bytes, { to: 'string' });
    return JSON.parse(decompressed);
  } catch (error) {
    console.error('[HISTORICAL_GAMES] Error decompressing data:', error);
    return null;
  }
}

/**
 * Get the season start date (October 1st of start year)
 */
function getSeasonStartDate(seasonId: string): Date {
  const startYear = parseInt(seasonId.substring(0, 4), 10);
  return new Date(startYear, 9, 1); // October 1st (month is 0-indexed)
}

/**
 * Get today's date or season end date, whichever is earlier
 */
function getSeasonEndDate(seasonId: string): Date {
  const endYear = parseInt(seasonId.substring(4, 8), 10);
  const seasonEnd = new Date(endYear, 5, 30); // June 30th
  const today = new Date();
  return today < seasonEnd ? today : seasonEnd;
}

/**
 * Format date as YYYY-MM-DD for NHL API
 */
function formatDateForApi(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Fetch games for a specific date from NHL API
 */
async function fetchGamesForDate(date: string): Promise<HistoricalGame[]> {
  try {
    const url = `https://api-web.nhle.com/v1/score/${date}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`[HISTORICAL_GAMES] Failed to fetch games for ${date}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const games: HistoricalGame[] = [];

    if (data.games && Array.isArray(data.games)) {
      for (const game of data.games) {
        // Only include completed games
        if (game.gameState !== 'FINAL' && game.gameState !== 'OFF') {
          continue;
        }

        const homeScore = game.homeTeam?.score ?? 0;
        const awayScore = game.awayTeam?.score ?? 0;

        const historicalGame: HistoricalGame = {
          id: game.id,
          date: date,
          homeTeam: game.homeTeam?.abbrev || '',
          awayTeam: game.awayTeam?.abbrev || '',
          homeScore,
          awayScore,
          winner: homeScore > awayScore ? 'home' : 'away',
        };

        // Try to get starting goalies if available
        // The score API includes goalies in the game summary
        if (game.summary?.scoring) {
          // Goalies might be in different places depending on API version
          // Check for goalies in game data
        }

        // Try homeTeam.goalie and awayTeam.goalie from game data
        if (game.homeTeam?.goalie) {
          historicalGame.homeGoalie = game.homeTeam.goalie.name?.default ||
            `${game.homeTeam.goalie.firstName?.default || ''} ${game.homeTeam.goalie.lastName?.default || ''}`.trim();
        }
        if (game.awayTeam?.goalie) {
          historicalGame.awayGoalie = game.awayTeam.goalie.name?.default ||
            `${game.awayTeam.goalie.firstName?.default || ''} ${game.awayTeam.goalie.lastName?.default || ''}`.trim();
        }

        games.push(historicalGame);
      }
    }

    return games;
  } catch (error) {
    console.error(`[HISTORICAL_GAMES] Error fetching games for ${date}:`, error);
    return [];
  }
}

/**
 * Load seeding status from storage
 */
async function loadSeedingStatus(): Promise<SeedingStatus> {
  try {
    const json = await AsyncStorage.getItem(SEEDING_STATUS_KEY);
    if (json) {
      return JSON.parse(json);
    }
  } catch (error) {
    console.error('[HISTORICAL_GAMES] Error loading seeding status:', error);
  }
  return {};
}

/**
 * Save seeding status to storage
 */
async function saveSeedingStatus(status: SeedingStatus): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEDING_STATUS_KEY, JSON.stringify(status));
  } catch (error) {
    console.error('[HISTORICAL_GAMES] Error saving seeding status:', error);
  }
}

/**
 * Check if a season has been seeded with historical data
 */
export async function isSeasonSeeded(seasonId: string): Promise<boolean> {
  const status = await loadSeedingStatus();
  return status[seasonId]?.isSeeded === true;
}

/**
 * Seed historical games for a season
 * Fetches all games from October 1st to today (or season end)
 *
 * @param seasonId - Season in format "20242025"
 * @param onProgress - Optional callback for progress updates
 * @returns Number of games seeded
 */
export async function seedSeason(
  seasonId: string,
  onProgress?: SeedingProgressCallback
): Promise<number> {
  console.log(`[HISTORICAL_GAMES] Starting to seed season ${seasonId}`);

  const startDate = getSeasonStartDate(seasonId);
  const endDate = getSeasonEndDate(seasonId);

  // Calculate total days
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const allGames: HistoricalGame[] = [];
  let currentDay = 0;

  // Iterate through each date
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateString = formatDateForApi(currentDate);
    currentDay++;

    // Report progress
    if (onProgress) {
      onProgress({
        currentDate: dateString,
        gamesLoaded: allGames.length,
        totalDays,
        currentDay,
      });
    }

    // Fetch games for this date
    const games = await fetchGamesForDate(dateString);
    allGames.push(...games);

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Store the games
  const seasonData: SeasonGamesData = {
    season: seasonId,
    games: allGames,
    lastUpdated: new Date().toISOString(),
    gamesCount: allGames.length,
  };

  const compressed = compressData(seasonData);
  await AsyncStorage.setItem(getStorageKey(seasonId), compressed);

  // Update seeding status
  const status = await loadSeedingStatus();
  status[seasonId] = {
    isSeeded: true,
    lastDate: formatDateForApi(endDate),
    gamesCount: allGames.length,
    completedAt: new Date().toISOString(),
  };
  await saveSeedingStatus(status);

  console.log(`[HISTORICAL_GAMES] Seeded ${allGames.length} games for season ${seasonId}`);
  return allGames.length;
}

/**
 * Get games within a date range
 *
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param seasonId - Optional season ID (will be inferred from startDate if not provided)
 * @returns Array of historical games in the range
 */
export async function getGamesInRange(
  startDate: string,
  endDate: string,
  seasonId?: string
): Promise<HistoricalGame[]> {
  // Infer season from start date if not provided
  if (!seasonId) {
    const startYear = parseInt(startDate.substring(0, 4), 10);
    const startMonth = parseInt(startDate.substring(5, 7), 10);
    // If Oct-Dec, season is currentYear + nextYear
    // If Jan-June, season is lastYear + currentYear
    if (startMonth >= 10) {
      seasonId = `${startYear}${startYear + 1}`;
    } else {
      seasonId = `${startYear - 1}${startYear}`;
    }
  }

  try {
    const compressed = await AsyncStorage.getItem(getStorageKey(seasonId));
    if (!compressed) {
      console.warn(`[HISTORICAL_GAMES] No data found for season ${seasonId}`);
      return [];
    }

    const seasonData = decompressData(compressed);
    if (!seasonData) {
      return [];
    }

    // Filter games by date range
    return seasonData.games.filter(game => {
      return game.date >= startDate && game.date <= endDate;
    });
  } catch (error) {
    console.error('[HISTORICAL_GAMES] Error getting games in range:', error);
    return [];
  }
}

/**
 * Get all games for a season
 */
export async function getSeasonGames(seasonId: string): Promise<HistoricalGame[]> {
  try {
    const compressed = await AsyncStorage.getItem(getStorageKey(seasonId));
    if (!compressed) {
      return [];
    }

    const seasonData = decompressData(compressed);
    return seasonData?.games || [];
  } catch (error) {
    console.error('[HISTORICAL_GAMES] Error getting season games:', error);
    return [];
  }
}

/**
 * Get the current NHL season ID (format: "20242025")
 */
export function getCurrentSeasonId(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();

  // NHL season runs from October (9) to June (5)
  if (month >= 6 && month <= 8) {
    // Off-season (July-September): return upcoming season
    return `${year}${year + 1}`;
  } else if (month >= 0 && month <= 5) {
    // Jan-June: season started last year
    return `${year - 1}${year}`;
  } else {
    // Oct-Dec: season started this year
    return `${year}${year + 1}`;
  }
}

/**
 * Clear stored data for a season (for debugging/testing)
 */
export async function clearSeasonData(seasonId: string): Promise<void> {
  await AsyncStorage.removeItem(getStorageKey(seasonId));

  const status = await loadSeedingStatus();
  delete status[seasonId];
  await saveSeedingStatus(status);

  console.log(`[HISTORICAL_GAMES] Cleared data for season ${seasonId}`);
}

/**
 * Get statistics about stored historical data
 */
export async function getStorageStats(): Promise<{
  seasons: { seasonId: string; gamesCount: number; isSeeded: boolean }[];
  totalGames: number;
}> {
  const status = await loadSeedingStatus();
  const seasons: { seasonId: string; gamesCount: number; isSeeded: boolean }[] = [];
  let totalGames = 0;

  for (const [seasonId, info] of Object.entries(status)) {
    seasons.push({
      seasonId,
      gamesCount: info.gamesCount,
      isSeeded: info.isSeeded,
    });
    totalGames += info.gamesCount;
  }

  return { seasons, totalGames };
}
