/**
 * Daily lineup assignment: who fills which slot, who sits on overflow, which slots go empty.
 *
 * Greedy-by-value with augmenting paths. The players who can be seated together form a
 * transversal matroid, so taking them in value order and re-seating along augmenting
 * paths yields the highest-value set of starters — not just the largest.
 */

import type { LineupSlots, SlotKey } from '../../types/fantasy';
import { SLOT_ORDER } from './positions';

export interface LineupPreset {
  id: string;
  label: string;
  detail: string;
  slots: LineupSlots;
}

export const STANDARD_SLOTS: LineupSlots = { C: 2, LW: 2, RW: 2, F: 0, D: 4, UTIL: 1, G: 2 };

export const LINEUP_PRESETS: LineupPreset[] = [
  {
    id: 'standard',
    label: 'Standard',
    detail: '2 C · 2 LW · 2 RW · 4 D · 1 UTIL · 2 G',
    slots: STANDARD_SLOTS,
  },
  {
    id: 'forwards',
    label: 'Forwards / D / G',
    detail: '6 F · 4 D · 2 G',
    slots: { C: 0, LW: 0, RW: 0, F: 6, D: 4, UTIL: 0, G: 2 },
  },
  {
    id: 'deep',
    label: 'Deep',
    detail: '3 C · 3 LW · 3 RW · 5 D · 1 UTIL · 2 G',
    slots: { C: 3, LW: 3, RW: 3, F: 0, D: 5, UTIL: 1, G: 2 },
  },
];

export const MAX_SLOTS_PER_TYPE = 8;

export function sanitizeSlots(input: Partial<LineupSlots> | null | undefined): LineupSlots {
  const out = { ...STANDARD_SLOTS };
  if (!input) return out;
  for (const key of SLOT_ORDER) {
    const value = Number(input[key]);
    if (Number.isFinite(value)) out[key] = Math.max(0, Math.min(MAX_SLOTS_PER_TYPE, Math.round(value)));
  }
  return out;
}

export function totalSlots(slots: LineupSlots): number {
  return SLOT_ORDER.reduce((sum, key) => sum + slots[key], 0);
}

export function slotsLabel(slots: LineupSlots): string {
  return SLOT_ORDER.filter((key) => slots[key] > 0)
    .map((key) => `${slots[key]} ${key}`)
    .join(' · ');
}

export function presetFor(slots: LineupSlots): LineupPreset | null {
  return LINEUP_PRESETS.find((preset) => SLOT_ORDER.every((key) => preset.slots[key] === slots[key])) ?? null;
}

export interface LineupCandidate {
  playerId: number;
  slots: SlotKey[];
  value: number;
}

export interface SeatedPlayer {
  slot: SlotKey;
  playerId: number;
}

export interface LineupResult {
  starters: SeatedPlayer[];
  /** Playing, eligible, but no room — the lowest-value players at crowded positions. */
  bench: number[];
  /** Slots no playing player could fill. */
  empty: SlotKey[];
}

export function expandSlots(slots: LineupSlots): SlotKey[] {
  return SLOT_ORDER.flatMap((key) => Array.from({ length: slots[key] }, () => key));
}

export function assignLineup(candidates: LineupCandidate[], slots: LineupSlots): LineupResult {
  const instances = expandSlots(slots);
  const seatedBy: number[] = instances.map(() => -1);
  const ordered = [...candidates].sort((a, b) => b.value - a.value || a.playerId - b.playerId);

  const trySeat = (candidateIndex: number, visited: Set<number>): boolean => {
    const eligible = ordered[candidateIndex].slots;
    // Take an open slot before bumping anyone, so better players keep their natural position.
    for (let s = 0; s < instances.length; s += 1) {
      if (seatedBy[s] !== -1 || visited.has(s) || !eligible.includes(instances[s])) continue;
      visited.add(s);
      seatedBy[s] = candidateIndex;
      return true;
    }
    for (let s = 0; s < instances.length; s += 1) {
      if (visited.has(s) || !eligible.includes(instances[s])) continue;
      visited.add(s);
      if (trySeat(seatedBy[s], visited)) {
        seatedBy[s] = candidateIndex;
        return true;
      }
    }
    return false;
  };

  const benchIndexes: number[] = [];
  ordered.forEach((_, index) => {
    if (!trySeat(index, new Set())) benchIndexes.push(index);
  });

  const starters: SeatedPlayer[] = [];
  const empty: SlotKey[] = [];
  instances.forEach((slot, s) => {
    if (seatedBy[s] === -1) empty.push(slot);
    else starters.push({ slot, playerId: ordered[seatedBy[s]].playerId });
  });

  return {
    starters,
    bench: benchIndexes.map((index) => ordered[index].playerId),
    empty,
  };
}
