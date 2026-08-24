/**
 * Local persistence for this week's lines.
 * One current week + one previous-week snapshot for copy-forward. No iCloud.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LineAssignment, LineGroup, LinesStore, WeeklyLines } from '../types/lines';

export const LINES_STORAGE_KEY = 'puckiq_weekly_lines';

const LINE_GROUPS: LineGroup[] = ['F', 'D', 'G', 'bench'];

export function isLineGroup(value: unknown): value is LineGroup {
  return typeof value === 'string' && LINE_GROUPS.includes(value as LineGroup);
}

/**
 * ISO week id (Monday start), e.g. 2026-W34.
 * Uses the Thursday of the week so late-December / early-January land in the ISO week year.
 */
export function getIsoWeekId(date: Date): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getMondayOfIsoWeek(weekId: string): Date {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekId);
  if (!match) {
    throw new Error(`[WEEKLY_LINES] Invalid weekId: ${weekId}`);
  }
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayNum = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayNum + 1 + (week - 1) * 7);
  return monday;
}

export function getWeekRangeLabel(weekId: string): string {
  const monday = getMondayOfIsoWeek(weekId);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const start = monday.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const end = sunday.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${start}–${end}`;
}

export function emptyWeek(weekId: string): WeeklyLines {
  return {
    weekId,
    label: getWeekRangeLabel(weekId),
    assignments: [],
  };
}

export function rollToCurrentWeek(store: LinesStore | null, now: Date): LinesStore {
  const weekId = getIsoWeekId(now);
  if (!store) {
    return { current: emptyWeek(weekId), previous: null };
  }

  if (store.current.weekId === weekId) {
    return {
      ...store,
      current: {
        ...store.current,
        label: getWeekRangeLabel(weekId),
      },
    };
  }

  if (store.current.weekId < weekId) {
    return {
      current: emptyWeek(weekId),
      previous: store.current,
    };
  }

  return store;
}

export function assignPlayer(store: LinesStore, playerId: number, group: LineGroup): LinesStore {
  const assignments = store.current.assignments.filter((row) => row.playerId !== playerId);
  assignments.push({ playerId, group });
  return {
    ...store,
    current: {
      ...store.current,
      assignments,
    },
  };
}

export function copyPreviousWeek(store: LinesStore, rosterPlayerIds: number[]): LinesStore {
  if (!store.previous) {
    return store;
  }
  const allowed = new Set(rosterPlayerIds);
  const assignments = store.previous.assignments.filter((row) => allowed.has(row.playerId));
  return {
    ...store,
    current: {
      ...store.current,
      assignments,
    },
  };
}

export function groupForPlayer(assignments: LineAssignment[], playerId: number): LineGroup {
  return assignments.find((row) => row.playerId === playerId)?.group ?? 'bench';
}

export function canCopyLastWeek(store: LinesStore | null): boolean {
  return !!store?.previous && store.previous.assignments.length > 0;
}

function parseStore(raw: unknown): LinesStore | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const candidate = raw as Partial<LinesStore>;
  if (!candidate.current || typeof candidate.current.weekId !== 'string') {
    return null;
  }
  const currentAssignments = Array.isArray(candidate.current.assignments)
    ? candidate.current.assignments.filter(
        (row): row is LineAssignment =>
          !!row && typeof row.playerId === 'number' && isLineGroup(row.group),
      )
    : [];
  const previous = candidate.previous && typeof candidate.previous.weekId === 'string'
    ? {
        weekId: candidate.previous.weekId,
        label: typeof candidate.previous.label === 'string' ? candidate.previous.label : candidate.previous.weekId,
        assignments: Array.isArray(candidate.previous.assignments)
          ? candidate.previous.assignments.filter(
              (row): row is LineAssignment =>
                !!row && typeof row.playerId === 'number' && isLineGroup(row.group),
            )
          : [],
      }
    : null;

  return {
    current: {
      weekId: candidate.current.weekId,
      label: typeof candidate.current.label === 'string' ? candidate.current.label : candidate.current.weekId,
      assignments: currentAssignments,
    },
    previous,
  };
}

export async function loadAndRollLines(now: Date = new Date()): Promise<LinesStore> {
  try {
    const json = await AsyncStorage.getItem(LINES_STORAGE_KEY);
    const stored = json ? parseStore(JSON.parse(json)) : null;
    const rolled = rollToCurrentWeek(stored, now);
    const changed =
      !stored ||
      stored.current.weekId !== rolled.current.weekId ||
      stored.previous?.weekId !== rolled.previous?.weekId;
    if (changed) {
      await persistLines(rolled);
    }
    return rolled;
  } catch (error) {
    console.error('[WEEKLY_LINES] Error loading lines:', error);
    return rollToCurrentWeek(null, now);
  }
}

export async function persistLines(store: LinesStore): Promise<LinesStore> {
  try {
    await AsyncStorage.setItem(LINES_STORAGE_KEY, JSON.stringify(store));
    return store;
  } catch (error) {
    console.error('[WEEKLY_LINES] Error saving lines:', error);
    throw error;
  }
}

export async function clearLines(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LINES_STORAGE_KEY);
  } catch (error) {
    console.error('[WEEKLY_LINES] Error clearing lines:', error);
    throw error;
  }
}
