import AsyncStorage from '@react-native-async-storage/async-storage';

export type AlertType = 'injury' | 'goalie' | 'lineup';

export interface FantasyAlert {
  id: string;
  type: AlertType;
  playerName: string;
  team: string;
  message: string;
  timestamp: string;
  isRosterPlayer: boolean;
}

const DISMISSED_KEY = 'puckiq_dismissed_alerts';
const SAVED_KEY = 'puckiq_saved_alerts';

export async function getDismissedAlertIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function dismissAlert(alertId: string): Promise<void> {
  const ids = await getDismissedAlertIds();
  if (!ids.includes(alertId)) {
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids, alertId]));
  }
}

export async function getSavedAlertIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveAlert(alertId: string): Promise<void> {
  const ids = await getSavedAlertIds();
  if (!ids.includes(alertId)) {
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify([...ids, alertId]));
  }
}

export function getAlertColor(type: AlertType): string {
  switch (type) {
    case 'injury':
      return '#e63946'; // redLine
    case 'goalie':
      return '#06d6a0'; // faceoffDot
    case 'lineup':
      return '#ffd60a'; // powerPlay
  }
}
