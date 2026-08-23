/**
 * Manually attached opponent roster for the League screen.
 * Not a hosted league — friends already play on Yahoo/ESPN.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FantasyPlayer } from '../types/fantasy';

const STORAGE_KEY = 'puckiq_opponent_roster';
const MAX_SIZE = 20;

export async function loadOpponentRoster(): Promise<FantasyPlayer[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveOpponentRoster(players: FantasyPlayer[]): Promise<FantasyPlayer[]> {
  const next = players.slice(0, MAX_SIZE);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function addOpponentPlayer(player: FantasyPlayer): Promise<FantasyPlayer[]> {
  const current = await loadOpponentRoster();
  if (current.some((p) => p.playerId === player.playerId)) {
    throw new Error(`${player.playerName} is already on the opponent roster.`);
  }
  if (current.length >= MAX_SIZE) {
    throw new Error(`Opponent roster is full (max ${MAX_SIZE} players).`);
  }
  return saveOpponentRoster([...current, player]);
}

export async function removeOpponentPlayer(playerId: number): Promise<FantasyPlayer[]> {
  const current = await loadOpponentRoster();
  return saveOpponentRoster(current.filter((p) => p.playerId !== playerId));
}

export async function clearOpponentRoster(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
