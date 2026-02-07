import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  STREAK_DATA: 'puckiq_streak_data',
  LAST_VISIT: 'puckiq_last_visit',
};

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastVisitDate: string; // YYYY-MM-DD
  totalDays: number;
}

// Get today's date in YYYY-MM-DD format
function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// Get yesterday's date in YYYY-MM-DD format
function getYesterdayDateString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

// Calculate days between two dates
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Get current streak data
export async function getStreakData(): Promise<StreakData> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.STREAK_DATA);
    if (!json) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastVisitDate: '',
        totalDays: 0,
      };
    }
    return JSON.parse(json);
  } catch (error) {
    console.error('Error loading streak data:', error);
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastVisitDate: '',
      totalDays: 0,
    };
  }
}

// Save streak data
async function saveStreakData(data: StreakData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.STREAK_DATA, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving streak data:', error);
    throw error;
  }
}

// Check and update streak (call this on app open)
export async function checkAndUpdateStreak(): Promise<StreakData> {
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();
  const streakData = await getStreakData();

  // If already visited today, return current data
  if (streakData.lastVisitDate === today) {
    return streakData;
  }

  // If this is the first visit ever
  if (!streakData.lastVisitDate) {
    const newData: StreakData = {
      currentStreak: 1,
      longestStreak: 1,
      lastVisitDate: today,
      totalDays: 1,
    };
    await saveStreakData(newData);
    return newData;
  }

  // If last visit was yesterday, increment streak
  if (streakData.lastVisitDate === yesterday) {
    const newStreak = streakData.currentStreak + 1;
    const newData: StreakData = {
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, streakData.longestStreak),
      lastVisitDate: today,
      totalDays: streakData.totalDays + 1,
    };
    await saveStreakData(newData);
    return newData;
  }

  // If last visit was more than 1 day ago, reset streak to 1
  const newData: StreakData = {
    currentStreak: 1,
    longestStreak: streakData.longestStreak, // Keep the longest streak
    lastVisitDate: today,
    totalDays: streakData.totalDays + 1,
  };
  await saveStreakData(newData);
  return newData;
}

// Get streak badge text for display
export function getStreakBadgeText(streak: number): string {
  if (streak === 0) return '';
  if (streak === 1) return '1 day';
  return `${streak} days`;
}

// Get streak milestone info
export function getStreakMilestone(streak: number): { icon: string; message: string } | null {
  const milestones = [
    { days: 7, icon: 'flame', message: '7 day streak!' },
    { days: 14, icon: 'fitness', message: '2 week streak!' },
    { days: 30, icon: 'star', message: '30 day streak!' },
    { days: 50, icon: 'trophy', message: '50 day streak!' },
    { days: 100, icon: 'ribbon', message: '100 day streak!' },
    { days: 365, icon: 'sparkles', message: '1 year streak!' },
  ];

  const milestone = milestones.find(m => m.days === streak);
  return milestone || null;
}

// Reset streak (for testing or if user wants to start over)
export async function resetStreak(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.STREAK_DATA);
  } catch (error) {
    console.error('Error resetting streak:', error);
    throw error;
  }
}
