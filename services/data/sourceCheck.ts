/** Provider-neutral provenance. A successful empty result differs from an unavailable check. */
export interface SourceCheck {
  source: string;
  fetchedAt: number | null;
  maxAgeMs: number;
  state: 'fresh' | 'stale' | 'unavailable';
}

export interface Sourced<T> {
  data: T;
  check: SourceCheck;
}

/** Re-evaluate age when data is used, including after the app resumes. */
export function sourceState(check: SourceCheck, now: number): SourceCheck['state'] {
  if (check.state !== 'fresh') return check.state;
  if (check.fetchedAt === null || !Number.isFinite(check.fetchedAt) || check.fetchedAt > now) return 'unavailable';
  return now - check.fetchedAt < check.maxAgeMs ? 'fresh' : 'stale';
}

export function unavailableCheck(source: string): SourceCheck {
  return { source, fetchedAt: null, maxAgeMs: 0, state: 'unavailable' };
}
