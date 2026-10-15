/**
 * One roster import, from opening the sheet to the players to add. The NHL player list starts
 * loading as the sheet opens, so it's ready by the time a screenshot is picked; screenshots are
 * read on the device; the matching and review are pure (services/rosterImport).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAllRosters, type RosterPlayer } from '../services/nhl/rosters';
import { scanRosterScreenshots, rosterScannerSupported } from '../services/native/rosterScanner';
import { buildPlayerIndex, matchRosterRows, mergeSearchMatches, rowsFromPastedText, type PlayerIndex } from '../services/rosterImport/matchRoster';
import { searchLeftovers } from '../services/rosterImport/searchFallback';
import { rowsFromOcr } from '../services/rosterImport/ocrRows';
import { pickOption, playersToAdd, startReview, toggleChecked, type ImportReview } from '../services/rosterImport/review';
import { track } from '../services/analytics/track';
import { newInstallId } from '../services/analytics/posthog';

export type ImportMethod = 'screenshot' | 'paste';

export type ImportStage =
  | { kind: 'choose' }
  | { kind: 'reading'; method: ImportMethod }
  | { kind: 'review'; method: ImportMethod; review: ImportReview }
  | { kind: 'error'; message: string };

export interface RosterImport {
  stage: ImportStage;
  /** This build can read screenshots (iOS with the native scanner). */
  canScan: boolean;
  scan: () => Promise<void>;
  paste: (text: string) => Promise<void>;
  toggle: (playerId: number) => void;
  pick: (entry: number, playerId: number) => void;
  restart: () => void;
  /** Who "Add" would add right now. */
  selection: RosterPlayer[];
}

const ROSTERS_FAILED = 'Couldn’t load the NHL rosters. Check your connection and try again.';
const SCAN_FAILED = 'Couldn’t read those screenshots. Try again, or paste the names instead.';

export function useRosterImport(open: boolean, rosterIds: ReadonlySet<number>, source = 'unknown'): RosterImport {
  const [stage, setStage] = useState<ImportStage>({ kind: 'choose' });
  const index = useRef<Promise<PlayerIndex> | null>(null);
  const generation = useRef(0);

  const loadIndex = useCallback((): Promise<PlayerIndex> => {
    if (!index.current) {
      const loading = fetchAllRosters().then(buildPlayerIndex);
      // A failed load is retried on the next attempt rather than cached.
      loading.catch(() => {
        if (index.current === loading) index.current = null;
      });
      index.current = loading;
    }
    return index.current;
  }, []);

  useEffect(() => {
    if (!open) return;
    generation.current += 1;
    setStage({ kind: 'choose' });
    loadIndex().catch(() => undefined);
    return () => { generation.current += 1; };
  }, [open, loadIndex]);

  const run = useCallback(async (rows: string[], method: ImportMethod, attempt: string, startedAt: number, request: number) => {
    let players: PlayerIndex;
    try {
      players = await loadIndex();
    } catch {
      if (request !== generation.current) return;
      track('roster_import_failure', { source, method, import_attempt_id: attempt, reason: 'rosters_unavailable', elapsed_ms: Date.now() - startedAt });
      setStage({ kind: 'error', message: ROSTERS_FAILED });
      return;
    }
    if (request !== generation.current) return;
    const indexed = matchRosterRows(rows, players);
    let match;
    try {
      match = indexed.leftovers.length > 0 ? mergeSearchMatches(indexed, await searchLeftovers(indexed.leftovers)) : indexed;
    } catch {
      if (request !== generation.current) return;
      track('roster_import_failure', { source, method, import_attempt_id: attempt, reason: 'matching_unavailable', elapsed_ms: Date.now() - startedAt });
      setStage({ kind: 'error', message: ROSTERS_FAILED });
      return;
    }
    if (request !== generation.current) return;
    track('roster_import_result', {
      source, import_attempt_id: attempt, elapsed_ms: Date.now() - startedAt,
      method,
      rows: rows.length,
      found: match.matched.length,
      likely: match.matched.filter((entry) => entry.confidence === 'likely').length,
      ambiguous: match.ambiguous.length,
      unmatched: match.unmatched.length,
    });
    setStage({ kind: 'review', method, review: startReview(match, rosterIds) });
  }, [loadIndex, rosterIds, source]);

  const scan = useCallback(async () => {
    const request = ++generation.current;
    const attempt = newInstallId();
    const startedAt = Date.now();
    track('roster_import_started', { source, method: 'screenshot', import_attempt_id: attempt });
    setStage({ kind: 'reading', method: 'screenshot' });
    let images;
    try {
      images = await scanRosterScreenshots();
    } catch {
      if (request !== generation.current) return;
      track('roster_import_failure', { source, method: 'screenshot', import_attempt_id: attempt, reason: 'scan_failed', elapsed_ms: Date.now() - startedAt });
      setStage({ kind: 'error', message: SCAN_FAILED });
      return;
    }
    if (request !== generation.current) return;
    if (!images) {
      track('roster_import_cancelled', { source, method: 'screenshot', import_attempt_id: attempt });
      setStage({ kind: 'choose' });
      return;
    }
    await run(rowsFromOcr(images), 'screenshot', attempt, startedAt, request);
  }, [run, source]);

  const paste = useCallback(async (text: string) => {
    const request = ++generation.current;
    const attempt = newInstallId();
    const startedAt = Date.now();
    track('roster_import_started', { source, method: 'paste', import_attempt_id: attempt });
    setStage({ kind: 'reading', method: 'paste' });
    await run(rowsFromPastedText(text), 'paste', attempt, startedAt, request);
  }, [run, source]);

  const toggle = useCallback((playerId: number) => {
    setStage((current) => (current.kind === 'review' ? { ...current, review: toggleChecked(current.review, playerId) } : current));
  }, []);

  const pick = useCallback((entry: number, playerId: number) => {
    setStage((current) => (current.kind === 'review' ? { ...current, review: pickOption(current.review, entry, playerId) } : current));
  }, []);

  const restart = useCallback(() => { generation.current += 1; setStage({ kind: 'choose' }); }, []);

  return {
    stage,
    canScan: rosterScannerSupported(),
    scan,
    paste,
    toggle,
    pick,
    restart,
    selection: stage.kind === 'review' ? playersToAdd(stage.review) : [],
  };
}
