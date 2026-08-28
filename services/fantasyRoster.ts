/**
 * Fantasy Roster Service
 * Handles persistence of fantasy hockey rosters using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FantasyRoster, FantasyPlayer, NhlSearchPlayer, ScoringFormat } from '../types/fantasy';

const ROSTER_STORAGE_KEY = 'puckiq_fantasy_roster';
const MAX_ROSTER_SIZE = 20;

/**
 * Generate a unique ID for new rosters
 */
function generateRosterId(): string {
  return Date.now().toString();
}

/**
 * Load the saved fantasy roster from storage
 */
export async function loadRoster(): Promise<FantasyRoster | null> {
  try {
    const json = await AsyncStorage.getItem(ROSTER_STORAGE_KEY);
    if (!json) {
      return null;
    }
    return JSON.parse(json) as FantasyRoster;
  } catch (error) {
    console.error('[FANTASY_ROSTER] Error loading roster:', error);
    return null;
  }
}

/**
 * Save a new fantasy roster to storage
 * Generates id, createdAt, and updatedAt automatically
 */
export async function saveRoster(
  roster: Omit<FantasyRoster, 'id' | 'createdAt' | 'updatedAt'>
): Promise<FantasyRoster> {
  try {
    const now = new Date().toISOString();
    const newRoster: FantasyRoster = {
      ...roster,
      id: generateRosterId(),
      createdAt: now,
      updatedAt: now,
    };

    await AsyncStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(newRoster));
    return newRoster;
  } catch (error) {
    console.error('[FANTASY_ROSTER] Error saving roster:', error);
    throw error;
  }
}

/**
 * Update an existing fantasy roster
 * Updates the updatedAt timestamp automatically
 */
export async function updateRoster(roster: FantasyRoster): Promise<FantasyRoster> {
  try {
    const updatedRoster: FantasyRoster = {
      ...roster,
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(updatedRoster));
    return updatedRoster;
  } catch (error) {
    console.error('[FANTASY_ROSTER] Error updating roster:', error);
    throw error;
  }
}

/**
 * Add a player to the roster
 * Validates against duplicates and max roster size
 */
export async function addPlayerToRoster(player: FantasyPlayer): Promise<FantasyRoster> {
  try {
    const roster = await loadRoster();

    if (!roster) {
      throw new Error('No roster found. Create a roster first.');
    }

    // Check for duplicate player
    const isDuplicate = roster.players.some(p => p.playerId === player.playerId);
    if (isDuplicate) {
      throw new Error(`Player ${player.playerName} is already on the roster.`);
    }

    // Check max roster size
    if (roster.players.length >= MAX_ROSTER_SIZE) {
      throw new Error(`Roster is full (max ${MAX_ROSTER_SIZE} players).`);
    }

    const updatedRoster: FantasyRoster = {
      ...roster,
      players: [...roster.players, player],
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(updatedRoster));
    return updatedRoster;
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('already on the roster') ||
      error.message.includes('Roster is full') ||
      error.message.includes('No roster found')
    )) {
      throw error;
    }
    console.error('[FANTASY_ROSTER] Error adding player:', error);
    throw error;
  }
}

/**
 * Remove a player from the roster by player ID
 */
export async function removePlayerFromRoster(playerId: number): Promise<FantasyRoster> {
  try {
    const roster = await loadRoster();

    if (!roster) {
      throw new Error('No roster found.');
    }

    const playerExists = roster.players.some(p => p.playerId === playerId);
    if (!playerExists) {
      throw new Error(`Player with ID ${playerId} not found on roster.`);
    }

    const updatedRoster: FantasyRoster = {
      ...roster,
      players: roster.players.filter(p => p.playerId !== playerId),
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(updatedRoster));
    return updatedRoster;
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('No roster found') ||
      error.message.includes('not found on roster')
    )) {
      throw error;
    }
    console.error('[FANTASY_ROSTER] Error removing player:', error);
    throw error;
  }
}

/**
 * Clear the roster entirely from storage
 */
export async function clearRoster(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ROSTER_STORAGE_KEY);
  } catch (error) {
    console.error('[FANTASY_ROSTER] Error clearing roster:', error);
    throw error;
  }
}

/**
 * Load the saved roster, or create an empty one so add-player flows always have a target.
 */
export function createLocalPlayer(name: string, position: string = 'F'): FantasyPlayer {
  return {
    playerId: Date.now() * 1000 + Math.floor(Math.random() * 1000),
    playerName: name.trim(),
    teamAbbrev: '',
    position,
    rosterPosition: 'BN',
  };
}

export async function ensureRoster(
  defaults: Omit<FantasyRoster, 'id' | 'createdAt' | 'updatedAt'> = {
    name: 'My Team',
    scoringFormat: 'yahoo',
    players: [],
  },
): Promise<FantasyRoster> {
  const existing = await loadRoster();
  if (existing) return existing;
  return saveRoster(defaults);
}

/**
 * Type a name on Lines. Creates the one roster if needed and appends the player.
 * Local only — no NHL search.
 */
export async function addOrCreateNamedPlayer(
  name: string,
  position: string = 'F',
): Promise<{ roster: FantasyRoster; player: FantasyPlayer }> {
  const trimmed = name.trim();
  if (trimmed.length < 1) {
    throw new Error('Name required');
  }

  const player = createLocalPlayer(trimmed, position);
  const existing = await loadRoster();

  if (!existing) {
    const roster = await saveRoster({
      name: 'My Team',
      scoringFormat: 'yahoo',
      players: [player],
    });
    return { roster, player };
  }

  const duplicate = existing.players.some(
    (row) => row.playerName.toLowerCase() === trimmed.toLowerCase(),
  );
  if (duplicate) {
    throw new Error(`${trimmed} is already on the roster.`);
  }

  if (existing.players.length >= MAX_ROSTER_SIZE) {
    throw new Error(`Roster is full (max ${MAX_ROSTER_SIZE} players).`);
  }

  const roster = await updateRoster({
    ...existing,
    players: [...existing.players, player],
  });
  return { roster, player };
}

export function nhlHitToPlayer(hit: NhlSearchPlayer, rosterPosition: FantasyPlayer['rosterPosition'] = 'BN'): FantasyPlayer {
  return {
    playerId: hit.playerId,
    playerName: hit.name,
    teamAbbrev: hit.teamAbbrev,
    position: hit.position,
    rosterPosition,
  };
}

/** Add an official NHL search hit to the one roster. Real playerId — no local fake IDs. */
export async function addNhlSearchPlayer(
  hit: NhlSearchPlayer,
): Promise<{ roster: FantasyRoster; player: FantasyPlayer }> {
  const player = nhlHitToPlayer(hit);
  const existing = await ensureRoster();
  const duplicate = existing.players.some((row) => row.playerId === player.playerId);
  if (duplicate) {
    throw new Error(`${player.playerName} is already on the roster.`);
  }
  if (existing.players.length >= MAX_ROSTER_SIZE) {
    throw new Error(`Roster is full (max ${MAX_ROSTER_SIZE} players).`);
  }
  const roster = await updateRoster({
    ...existing,
    players: [...existing.players, player],
  });
  return { roster, player };
}

/**
 * Get just the scoring format from the saved roster
 */
export async function getScoringFormat(): Promise<ScoringFormat | null> {
  try {
    const roster = await loadRoster();
    return roster?.scoringFormat ?? null;
  } catch (error) {
    console.error('[FANTASY_ROSTER] Error getting scoring format:', error);
    return null;
  }
}
