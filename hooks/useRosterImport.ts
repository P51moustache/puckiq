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

export function useRosterImport(open: boolean, rosterIds: ReadonlySet<number>): RosterImport {
  const [stage, setStage] = useState<ImportStage>({ kind: 'choose' });
  const index = useRef<Promise<PlayerIndex> | null>(null);

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
    setStage({ kind: 'choose' });
    loadIndex().catch(() => undefined);
  }, [open, loadIndex]);

  const run = useCallback(async (rows: string[], method: ImportMethod) => {
    let players: PlayerIndex;
    try {
      players = await loadIndex();
    } catch {
      setStage({ kind: 'error', message: ROSTERS_FAILED });
      return;
    }
    const indexed = matchRosterRows(rows, players);
    const match = indexed.leftovers.length > 0 ? mergeSearchMatches(indexed, await searchLeftovers(indexed.leftovers)) : indexed;
    track('roster_import_result', {
      method,
      rows: rows.length,
      found: match.matched.length,
      likely: match.matched.filter((entry) => entry.confidence === 'likely').length,
      ambiguous: match.ambiguous.length,
      unmatched: match.unmatched.length,
    });
    setStage({ kind: 'review', method, review: startReview(match, rosterIds) });
  }, [loadIndex, rosterIds]);

  const scan = useCallback(async () => {
    setStage({ kind: 'reading', method: 'screenshot' });
    let images;
    try {
      images = await scanRosterScreenshots();
    } catch {
      setStage({ kind: 'error', message: SCAN_FAILED });
      return;
    }
    if (!images) {
      setStage({ kind: 'choose' });
      return;
    }
    await run(rowsFromOcr(images), 'screenshot');
  }, [run]);

  const paste = useCallback(async (text: string) => {
    setStage({ kind: 'reading', method: 'paste' });
    await run(rowsFromPastedText(text), 'paste');
  }, [run]);

  const toggle = useCallback((playerId: number) => {
    setStage((current) => (current.kind === 'review' ? { ...current, review: toggleChecked(current.review, playerId) } : current));
  }, []);

  const pick = useCallback((entry: number, playerId: number) => {
    setStage((current) => (current.kind === 'review' ? { ...current, review: pickOption(current.review, entry, playerId) } : current));
  }, []);

  const restart = useCallback(() => setStage({ kind: 'choose' }), []);

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
