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

export interface LinesStore {
  current: WeeklyLines;
  previous: WeeklyLines | null;
}
