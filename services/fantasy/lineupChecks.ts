import { sourceState, type SourceCheck } from '../data/sourceCheck';
import type { PlayerStatus } from './coach';

export interface LineupChecks {
  schedule: SourceCheck;
  scratches: SourceCheck[];
  /** Null when news was deliberately skipped, for example a completed night's recap. */
  news: SourceCheck | null;
}

export interface NamedCheck { label: string; check: SourceCheck }

/** Scope describes checks performed, never a guarantee of health or a host lineup sync. */
export function namedLineupChecks(checks: LineupChecks, week?: SourceCheck): NamedCheck[] {
  return [
    { label: 'Game schedule', check: checks.schedule },
    ...(week ? [{ label: 'Planning schedule', check: week }] : []),
    ...checks.scratches.map((check) => ({ label: 'Scratch list', check })),
    ...(checks.news ? [{ label: 'Injury news', check: checks.news }] : []),
  ];
}

export function incompleteChecks(checks: readonly NamedCheck[], now: number): string[] {
  return [...new Set(checks.flatMap(({ label, check }) => {
    const state = sourceState(check, now);
    return state === 'fresh' ? [] : [`${label}: ${state === 'stale' ? 'last saved data' : 'check unavailable'}`];
  }))];
}

/** Original source time, never the time cached data happened to be displayed. */
export function lineupCheckedAt(checks: readonly NamedCheck[], now: number): number | null {
  if (!checks.length || checks.some(({ check }) => sourceState(check, now) !== 'fresh')) return null;
  return Math.min(...checks.map(({ check }) => check.fetchedAt!));
}

/** Keep useful warnings while removing current confirmation from expired evidence. */
export function currentStatuses(statuses: ReadonlyMap<number, PlayerStatus>, now: number): Map<number, PlayerStatus> {
  return new Map([...statuses].map(([id, status]) => {
    if (!status.check || sourceState(status.check, now) === 'fresh') return [id, status];
    if (status.signal === 'scratch' && status.confidence === 'confirmed') return [id, { ...status, confidence: 'likely', note: 'Last saved scratch list flags this player — verify current availability before lock.' }];
    if (status.signal === 'ok') return [id, { ...status, signal: 'unknown', confidence: 'unknown' }];
    return [id, status];
  }));
}
