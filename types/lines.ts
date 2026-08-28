/**
 * This week's lines — one current week plus a single previous-week snapshot
 * used only to copy last week forward. No archive.
 */

export type LineGroup = 'F' | 'D' | 'G' | 'bench';

export interface LineAssignment {
  playerId: number;
  group: LineGroup;
}

export interface WeeklyLines {
  weekId: string;
  label: string;
  assignments: LineAssignment[];
}

export type DoNotPair = [number, number];

export interface LinesStore {
  current: WeeklyLines;
  previous: WeeklyLines | null;
  /** Roster-level: these two names should not share a forward line. */
  doNotPairs: DoNotPair[];
}
