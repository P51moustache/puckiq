import AsyncStorage from '@react-native-async-storage/async-storage';
import { createDailyAccuracyRecord, saveDailyAccuracy } from '../utils/accuracyTracking';

export interface Pick {
  gameId: string;
  date: string; // YYYY-MM-DD
  type: 'lock' | 'smart-pick' | 'user-pick';
  predictedWinner: string; // team abbrev
  homeTeam: string;
  awayTeam: string;
  confidenceScore?: number;
  outcome?: 'win' | 'loss' | 'push'; // null until game completes
  actualWinner?: string; // team abbrev that actually won
}

export interface DailyPicks {
  date: string; // YYYY-MM-DD
  lock?: Pick;
  smartPicks: Pick[];
  userPicks: Pick[];
}

export interface PickStats {
  total: number;
  wins: number;
  losses: number;
  pushes: number;
  accuracy: number; // percentage
}

const STORAGE_KEYS = {
  DAILY_PICKS: 'puckiq_daily_picks',
  LAST_CHECK_DATE: 'puckiq_last_check_date',
};

// Get today's date in YYYY-MM-DD format (using local timezone)
export function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get yesterday's date in YYYY-MM-DD format (using local timezone)
export function getYesterdayDateString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Save daily picks to storage
export async function saveDailyPicks(picks: DailyPicks): Promise<void> {
  try {
    const allPicks = await getAllDailyPicks();
    allPicks[picks.date] = picks;
    await AsyncStorage.setItem(STORAGE_KEYS.DAILY_PICKS, JSON.stringify(allPicks));
  } catch (error) {
    console.error('Error saving daily picks:', error);
    throw error;
  }
}

// Get all daily picks from storage
export async function getAllDailyPicks(): Promise<Record<string, DailyPicks>> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.DAILY_PICKS);
    return json ? JSON.parse(json) : {};
  } catch (error) {
    console.error('Error loading daily picks:', error);
    return {};
  }
}

// Get picks for a specific date
export async function getPicksForDate(date: string): Promise<DailyPicks | null> {
  try {
    const allPicks = await getAllDailyPicks();
    return allPicks[date] || null;
  } catch (error) {
    console.error('Error loading picks for date:', error);
    return null;
  }
}

// Save today's Lock of the Day
export async function saveLockOfTheDay(pick: Omit<Pick, 'type' | 'date'>): Promise<void> {
  const today = getTodayDateString();
  const todaysPicks = (await getPicksForDate(today)) || {
    date: today,
    smartPicks: [],
    userPicks: [],
  };

  todaysPicks.lock = {
    ...pick,
    type: 'lock',
    date: today,
  };

  await saveDailyPicks(todaysPicks);
}

// Save today's Smart Picks
export async function saveSmartPicks(picks: Omit<Pick, 'type' | 'date'>[]): Promise<void> {
  const today = getTodayDateString();
  const todaysPicks = (await getPicksForDate(today)) || {
    date: today,
    smartPicks: [],
    userPicks: [],
  };

  todaysPicks.smartPicks = picks.map(pick => ({
    ...pick,
    type: 'smart-pick' as const,
    date: today,
  }));

  await saveDailyPicks(todaysPicks);
}

// Add a user pick
export async function addUserPick(pick: Omit<Pick, 'type' | 'date'>): Promise<void> {
  const today = getTodayDateString();
  const todaysPicks = (await getPicksForDate(today)) || {
    date: today,
    smartPicks: [],
    userPicks: [],
  };

  // Check if pick already exists for this game
  const existingIndex = todaysPicks.userPicks.findIndex(p => p.gameId === pick.gameId);
  const newPick: Pick = {
    ...pick,
    type: 'user-pick',
    date: today,
  };

  if (existingIndex >= 0) {
    todaysPicks.userPicks[existingIndex] = newPick;
  } else {
    todaysPicks.userPicks.push(newPick);
  }

  await saveDailyPicks(todaysPicks);
}

// Remove a user pick
export async function removeUserPick(gameId: string): Promise<void> {
  const today = getTodayDateString();
  const todaysPicks = await getPicksForDate(today);

  if (!todaysPicks) return;

  todaysPicks.userPicks = todaysPicks.userPicks.filter(p => p.gameId !== gameId);
  await saveDailyPicks(todaysPicks);
}

// Update pick outcomes based on game results
export async function updatePickOutcomes(date: string, gameResults: {
  gameId: string;
  winner: string; // team abbrev, or 'tie' for shootout/OT ties (rare)
}[]): Promise<void> {
  const picks = await getPicksForDate(date);
  if (!picks) return;

  let updated = false;

  // Update lock
  if (picks.lock) {
    const result = gameResults.find(r => r.gameId === picks.lock!.gameId);
    if (result && !picks.lock.outcome) {
      picks.lock.actualWinner = result.winner;
      if (result.winner === 'tie') {
        picks.lock.outcome = 'push';
      } else {
        picks.lock.outcome = result.winner === picks.lock.predictedWinner ? 'win' : 'loss';
      }
      updated = true;
    }
  }

  // Update smart picks
  picks.smartPicks = picks.smartPicks.map(pick => {
    const result = gameResults.find(r => r.gameId === pick.gameId);
    if (result && !pick.outcome) {
      pick.actualWinner = result.winner;
      if (result.winner === 'tie') {
        pick.outcome = 'push';
      } else {
        pick.outcome = result.winner === pick.predictedWinner ? 'win' : 'loss';
      }
      updated = true;
    }
    return pick;
  });

  // Update user picks
  picks.userPicks = picks.userPicks.map(pick => {
    const result = gameResults.find(r => r.gameId === pick.gameId);
    if (result && !pick.outcome) {
      pick.actualWinner = result.winner;
      if (result.winner === 'tie') {
        pick.outcome = 'push';
      } else {
        pick.outcome = result.winner === pick.predictedWinner ? 'win' : 'loss';
      }
      updated = true;
    }
    return pick;
  });

  if (updated) {
    await saveDailyPicks(picks);
  }
}

// Calculate stats for a set of picks
export function calculatePickStats(picks: Pick[]): PickStats {
  const completed = picks.filter(p => p.outcome);
  const wins = completed.filter(p => p.outcome === 'win').length;
  const losses = completed.filter(p => p.outcome === 'loss').length;
  const pushes = completed.filter(p => p.outcome === 'push').length;

  const accuracy = completed.length > 0
    ? Math.round((wins / (wins + losses)) * 100)
    : 0;

  return {
    total: completed.length,
    wins,
    losses,
    pushes,
    accuracy,
  };
}

// Get yesterday's results
export async function getYesterdaysResults(): Promise<{
  lock?: Pick;
  smartPicks: Pick[];
  lockStats: PickStats;
  smartPickStats: PickStats;
} | null> {
  const yesterday = getYesterdayDateString();
  const picks = await getPicksForDate(yesterday);

  if (!picks) return null;

  const lockPicks = picks.lock ? [picks.lock] : [];
  const lockStats = calculatePickStats(lockPicks);
  const smartPickStats = calculatePickStats(picks.smartPicks);

  return {
    lock: picks.lock,
    smartPicks: picks.smartPicks,
    lockStats,
    smartPickStats,
  };
}

// Get rolling stats for last N days
export async function getRollingStats(days: number, pickType: 'lock' | 'smart-pick' | 'all' = 'all'): Promise<PickStats> {
  const allPicks = await getAllDailyPicks();
  const dates = Object.keys(allPicks).sort().reverse().slice(0, days);

  let allRelevantPicks: Pick[] = [];

  for (const date of dates) {
    const dayPicks = allPicks[date];
    if (pickType === 'lock' && dayPicks.lock) {
      allRelevantPicks.push(dayPicks.lock);
    } else if (pickType === 'smart-pick') {
      allRelevantPicks.push(...dayPicks.smartPicks);
    } else if (pickType === 'all') {
      if (dayPicks.lock) allRelevantPicks.push(dayPicks.lock);
      allRelevantPicks.push(...dayPicks.smartPicks);
    }
  }

  return calculatePickStats(allRelevantPicks);
}

// Check and update yesterday's games (should be called on app open)
export async function checkAndUpdateYesterdaysGames(): Promise<void> {
  const yesterday = getYesterdayDateString();
  const lastCheck = await AsyncStorage.getItem(STORAGE_KEYS.LAST_CHECK_DATE);

  // Only check once per day
  if (lastCheck === yesterday) return;

  const picks = await getPicksForDate(yesterday);
  if (!picks) return;

  // Fetch yesterday's scores
  try {
    const response = await fetch(`https://api-web.nhle.com/v1/score/${yesterday}`);
    if (!response.ok) throw new Error('Failed to fetch scores');

    const data = await response.json();
    const games = data.games || [];

    const results = games.map((game: any) => {
      const homeScore = game.homeTeam?.score || 0;
      const awayScore = game.awayTeam?.score || 0;
      const homeAbbrev = game.homeTeam?.abbrev || '';
      const awayAbbrev = game.awayTeam?.abbrev || '';

      let winner: string;
      if (homeScore > awayScore) {
        winner = homeAbbrev;
      } else if (awayScore > homeScore) {
        winner = awayAbbrev;
      } else {
        winner = 'tie';
      }

      return {
        gameId: String(game.id),
        winner,
      };
    });

    await updatePickOutcomes(yesterday, results);
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_CHECK_DATE, yesterday);

    // Track daily accuracy after updating outcomes
    try {
      const updatedPicks = await getPicksForDate(yesterday);
      if (updatedPicks) {
        const lockCorrect = updatedPicks.lock?.outcome === 'win' ? true :
                           updatedPicks.lock?.outcome === 'loss' ? false : null;
        const smartPicksCorrect = updatedPicks.smartPicks.filter(p => p.outcome === 'win').length;
        const smartPicksTotal = updatedPicks.smartPicks.filter(p => p.outcome && p.outcome !== 'push').length;

        const dailyAccuracy = createDailyAccuracyRecord(
          yesterday,
          lockCorrect,
          smartPicksCorrect,
          smartPicksTotal
        );

        await saveDailyAccuracy(dailyAccuracy);
        console.log(`[Pick Tracking] Accuracy tracked for ${yesterday}: ${dailyAccuracy.overallAccuracy}%`);
      }
    } catch (accuracyError) {
      console.error('[Pick Tracking] Error tracking daily accuracy:', accuracyError);
      // Don't throw - accuracy tracking failure shouldn't block main flow
    }
  } catch (error) {
    console.error('Error checking yesterday\'s games:', error);
  }
}

// Get today's picks
export async function getTodaysPicks(): Promise<{
  lock?: Pick;
  smartPicks: Pick[];
} | null> {
  const today = getTodayDateString();
  const picks = await getPicksForDate(today);

  if (!picks) return null;

  return {
    lock: picks.lock,
    smartPicks: picks.smartPicks,
  };
}

// Get all picks (flattened from all dates)
export async function getAllPicks(): Promise<Pick[]> {
  const allDailyPicks = await getAllDailyPicks();
  const allPicks: Pick[] = [];

  Object.values(allDailyPicks).forEach(dayPicks => {
    if (dayPicks.lock) allPicks.push(dayPicks.lock);
    allPicks.push(...dayPicks.smartPicks);
    allPicks.push(...dayPicks.userPicks);
  });

  // Sort by date (most recent first)
  allPicks.sort((a, b) => b.date.localeCompare(a.date));

  return allPicks;
}

// Get stats for user picks only
export async function getUserPickStats(): Promise<PickStats> {
  const allPicks = await getAllPicks();
  const userPicks = allPicks.filter(p => p.type === 'user-pick');
  return calculatePickStats(userPicks);
}

// Get stats for smart picks only
export async function getSmartPickStats(): Promise<PickStats> {
  const allPicks = await getAllPicks();
  const smartPicks = allPicks.filter(p => p.type === 'smart-pick');
  return calculatePickStats(smartPicks);
}

// Get stats for lock picks only
export async function getLockStats(): Promise<PickStats> {
  const allPicks = await getAllPicks();
  const lockPicks = allPicks.filter(p => p.type === 'lock');
  return calculatePickStats(lockPicks);
}

// Get streak information for user picks
export async function getUserStreakInfo(): Promise<{
  current: string;
  currentCount: number;
  bestWinStreak: number;
  worstLossStreak: number;
}> {
  const allPicks = await getAllPicks();
  const userPicks = allPicks
    .filter(p => p.type === 'user-pick' && p.outcome)
    .sort((a, b) => b.date.localeCompare(a.date)); // most recent first

  if (userPicks.length === 0) {
    return { current: '', currentCount: 0, bestWinStreak: 0, worstLossStreak: 0 };
  }

  // Calculate current streak
  let currentStreak = 0;
  let currentType: 'win' | 'loss' | null = null;

  for (const pick of userPicks) {
    if (pick.outcome === 'push') continue; // Skip pushes

    if (currentType === null) {
      currentType = pick.outcome as 'win' | 'loss';
      currentStreak = 1;
    } else if (pick.outcome === currentType) {
      currentStreak++;
    } else {
      break; // Streak broken
    }
  }

  const current = currentType ? `${currentType === 'win' ? 'W' : 'L'}${currentStreak}` : '';

  // Calculate best win streak and worst loss streak
  let bestWinStreak = 0;
  let worstLossStreak = 0;
  let tempStreak = 0;
  let tempType: 'win' | 'loss' | null = null;

  // Go through all picks in chronological order
  const chronologicalPicks = [...userPicks].reverse();

  for (const pick of chronologicalPicks) {
    if (pick.outcome === 'push') continue;

    if (tempType === null || tempType !== pick.outcome) {
      // Save previous streak
      if (tempType === 'win') {
        bestWinStreak = Math.max(bestWinStreak, tempStreak);
      } else if (tempType === 'loss') {
        worstLossStreak = Math.max(worstLossStreak, tempStreak);
      }

      // Start new streak
      tempType = pick.outcome as 'win' | 'loss';
      tempStreak = 1;
    } else {
      tempStreak++;
    }
  }

  // Check final streak
  if (tempType === 'win') {
    bestWinStreak = Math.max(bestWinStreak, tempStreak);
  } else if (tempType === 'loss') {
    worstLossStreak = Math.max(worstLossStreak, tempStreak);
  }

  return {
    current,
    currentCount: currentStreak,
    bestWinStreak,
    worstLossStreak,
  };
}

// Clear all user pick history (preserves AI picks)
export async function clearUserPickHistory(): Promise<void> {
  try {
    const allPicks = await getAllDailyPicks();

    // Remove user picks from each day
    Object.keys(allPicks).forEach(date => {
      allPicks[date].userPicks = [];
    });

    await AsyncStorage.setItem(STORAGE_KEYS.DAILY_PICKS, JSON.stringify(allPicks));
  } catch (error) {
    console.error('Error clearing user pick history:', error);
    throw error;
  }
}

// Clear all AI pick history (smart picks and lock picks, preserves user picks)
export async function clearAIPickHistory(): Promise<void> {
  try {
    const allPicks = await getAllDailyPicks();

    // Remove AI picks from each day
    Object.keys(allPicks).forEach(date => {
      allPicks[date].smartPicks = [];
      delete allPicks[date].lock;
    });

    await AsyncStorage.setItem(STORAGE_KEYS.DAILY_PICKS, JSON.stringify(allPicks));
  } catch (error) {
    console.error('Error clearing AI pick history:', error);
    throw error;
  }
}

// Get pick history organized by date
export async function getPickHistoryByDate(): Promise<Record<string, DailyPicks>> {
  return await getAllDailyPicks();
}
