import { getAllDailyPicks, type Pick } from './pickTracking';

export interface PeriodStats {
  total: number;
  correct: number;
  accuracy: number; // 0-1
}

export interface AccuracyStats {
  totalPicks: number;
  correctPicks: number;
  accuracy: number; // 0-1
  last7Days: PeriodStats;
  last30Days: PeriodStats;
  currentStreak: number; // consecutive correct picks
  bestStreak: number;
  dailyAccuracy: Array<{ date: string; accuracy: number; total: number }>;
}

/**
 * Get a date string N days ago from a reference date.
 */
function daysAgo(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Flatten all resolved picks (with outcome, excluding pushes) from daily picks.
 * Returns picks sorted by date ascending.
 */
function flattenResolvedPicks(allDailyPicks: Record<string, any>): Pick[] {
  const picks: Pick[] = [];

  for (const dayPicks of Object.values(allDailyPicks)) {
    if (dayPicks.lock && dayPicks.lock.outcome && dayPicks.lock.outcome !== 'push') {
      picks.push(dayPicks.lock);
    }
    for (const sp of dayPicks.smartPicks || []) {
      if (sp.outcome && sp.outcome !== 'push') {
        picks.push(sp);
      }
    }
    for (const up of dayPicks.userPicks || []) {
      if (up.outcome && up.outcome !== 'push') {
        picks.push(up);
      }
    }
  }

  // Sort ascending by date
  picks.sort((a, b) => a.date.localeCompare(b.date));
  return picks;
}

/**
 * Calculate stats for a subset of picks.
 */
function calcPeriodStats(picks: Pick[]): PeriodStats {
  const total = picks.length;
  const correct = picks.filter(p => p.outcome === 'win').length;
  return {
    total,
    correct,
    accuracy: total > 0 ? correct / total : 0,
  };
}

/**
 * Calculate current streak (consecutive correct picks, most recent first)
 * and best streak ever.
 */
function calcStreaks(picks: Pick[]): { currentStreak: number; bestStreak: number } {
  if (picks.length === 0) return { currentStreak: 0, bestStreak: 0 };

  // Most recent first for current streak
  const reversed = [...picks].reverse();

  let currentStreak = 0;
  for (const pick of reversed) {
    if (pick.outcome === 'win') {
      currentStreak++;
    } else {
      break;
    }
  }

  // Best streak (chronological)
  let bestStreak = 0;
  let running = 0;
  for (const pick of picks) {
    if (pick.outcome === 'win') {
      running++;
      if (running > bestStreak) bestStreak = running;
    } else {
      running = 0;
    }
  }

  return { currentStreak, bestStreak };
}

/**
 * Build daily accuracy array from daily picks (for chart).
 * Groups all resolved picks by date and calculates accuracy per day.
 */
function buildDailyAccuracy(
  allDailyPicks: Record<string, any>
): Array<{ date: string; accuracy: number; total: number }> {
  const dailyMap = new Map<string, { wins: number; total: number }>();

  for (const [date, dayPicks] of Object.entries(allDailyPicks)) {
    const allPicks: Pick[] = [];
    if (dayPicks.lock) allPicks.push(dayPicks.lock);
    allPicks.push(...(dayPicks.smartPicks || []));
    allPicks.push(...(dayPicks.userPicks || []));

    const resolved = allPicks.filter(
      (p: Pick) => p.outcome && p.outcome !== 'push'
    );
    if (resolved.length === 0) continue;

    const wins = resolved.filter((p: Pick) => p.outcome === 'win').length;
    dailyMap.set(date, { wins, total: resolved.length });
  }

  return Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { wins, total }]) => ({
      date,
      accuracy: total > 0 ? wins / total : 0,
      total,
    }));
}

/**
 * Load pick history from AsyncStorage and compute accuracy stats.
 */
export async function getAccuracyStats(): Promise<AccuracyStats> {
  const allDailyPicks = await getAllDailyPicks();
  const resolvedPicks = flattenResolvedPicks(allDailyPicks);
  const overall = calcPeriodStats(resolvedPicks);
  const { currentStreak, bestStreak } = calcStreaks(resolvedPicks);

  // Rolling window stats
  const now = new Date();
  const cutoff7 = daysAgo(7, now);
  const cutoff30 = daysAgo(30, now);

  const last7Picks = resolvedPicks.filter(p => p.date >= cutoff7);
  const last30Picks = resolvedPicks.filter(p => p.date >= cutoff30);

  return {
    totalPicks: overall.total,
    correctPicks: overall.correct,
    accuracy: overall.accuracy,
    last7Days: calcPeriodStats(last7Picks),
    last30Days: calcPeriodStats(last30Picks),
    currentStreak,
    bestStreak,
    dailyAccuracy: buildDailyAccuracy(allDailyPicks),
  };
}
