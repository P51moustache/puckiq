/**
 * Start/sit leaning for MY roster only.
 * Uses public NHL signals (game tonight, scratch, injury language) — not ML projections.
 */

import type { InjurySignal, StartSitRec } from '../types/fantasy';

export interface LeanInput {
  hasGameTonight: boolean;
  injurySignal: InjurySignal;
  isGoalie: boolean;
  goalieConfirmedStarter?: boolean | null;
}

export interface LeanResult {
  recommendation: StartSitRec;
  reason: string;
}

export function leanStartSit(input: LeanInput): LeanResult {
  if (input.injurySignal === 'scratch') {
    return { recommendation: 'SIT', reason: 'Scratched tonight' };
  }
  if (input.injurySignal === 'out') {
    return { recommendation: 'SIT', reason: 'Out / IR — do not start' };
  }
  if (!input.hasGameTonight) {
    return { recommendation: 'SIT', reason: 'No game tonight' };
  }
  if (input.isGoalie) {
    if (input.goalieConfirmedStarter === false) {
      return { recommendation: 'SIT', reason: 'Not confirmed to start' };
    }
    if (input.goalieConfirmedStarter !== true) {
      return { recommendation: 'FLEX', reason: 'Starter not confirmed' };
    }
  }
  if (input.injurySignal === 'dtd') {
    return { recommendation: 'FLEX', reason: 'Day-to-day — monitor lineup' };
  }
  if (input.injurySignal === 'unknown') {
    return { recommendation: 'FLEX', reason: 'Playing, injury status unclear' };
  }
  return { recommendation: 'START', reason: 'In tonight\'s lineup' };
}

const OUT_RE = /\b(out indefinitely|placed on ir|\bir\b|season[- ]ending|will not play|sidelined)\b/i;
const DTD_RE = /\b(day-to-day|dtd|week-to-week|questionable|upper-body|lower-body|undisclosed)\b/i;
const SCRATCH_RE = /\b(scratch(?:ed)?|healthy scratch)\b/i;

export function injurySignalFromText(text: string): InjurySignal | null {
  if (!text.trim()) return null;
  if (SCRATCH_RE.test(text)) return 'scratch';
  if (OUT_RE.test(text)) return 'out';
  if (DTD_RE.test(text)) return 'dtd';
  return null;
}
