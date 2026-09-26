/**
 * NHL positions → fantasy slot eligibility.
 */

import type { FantasyPlayer, SlotKey, SlotPosition } from '../../types/fantasy';

export const SLOT_ORDER: SlotKey[] = ['C', 'LW', 'RW', 'F', 'D', 'UTIL', 'G'];

export const SLOT_LABEL: Record<SlotKey, string> = {
  C: 'C',
  LW: 'LW',
  RW: 'RW',
  F: 'F',
  D: 'D',
  UTIL: 'UTIL',
  G: 'G',
};

const FORWARDS: SlotPosition[] = ['C', 'LW', 'RW'];

/** NHL API uses C, L, R, D, G (and sometimes LW / RW). */
export function normalizePosition(position: string | null | undefined): SlotPosition | null {
  switch ((position ?? '').toUpperCase()) {
    case 'C':
      return 'C';
    case 'L':
    case 'LW':
      return 'LW';
    case 'R':
    case 'RW':
      return 'RW';
    case 'D':
      return 'D';
    case 'G':
      return 'G';
    default:
      return null;
  }
}

export function basePositions(player: Pick<FantasyPlayer, 'position' | 'eligible'>): SlotPosition[] {
  if (player.eligible && player.eligible.length > 0) return [...new Set(player.eligible)];
  const pos = normalizePosition(player.position);
  return pos ? [pos] : [];
}

/** Every lineup slot this player can fill. */
export function eligibleSlots(player: Pick<FantasyPlayer, 'position' | 'eligible'>): SlotKey[] {
  const positions = basePositions(player);
  const slots = new Set<SlotKey>();
  for (const pos of positions) {
    slots.add(pos);
    if (FORWARDS.includes(pos)) {
      slots.add('F');
      slots.add('UTIL');
    }
    if (pos === 'D') slots.add('UTIL');
  }
  return SLOT_ORDER.filter((slot) => slots.has(slot));
}

export function isGoalie(player: Pick<FantasyPlayer, 'position' | 'eligible'>): boolean {
  return basePositions(player).includes('G');
}

export function positionLabel(player: Pick<FantasyPlayer, 'position' | 'eligible'>): string {
  const positions = basePositions(player);
  return positions.length > 0 ? positions.join('/') : player.position || '—';
}

/**
 * NHL player ids are 7-digit (84xxxxx). Names typed in PuckIQ 2.x got a local timestamp id
 * — those need linking to a real NHL player before any schedule or stats can load.
 */
export function isNhlLinked(player: Pick<FantasyPlayer, 'playerId'>): boolean {
  return player.playerId >= 8_000_000 && player.playerId <= 9_999_999;
}
