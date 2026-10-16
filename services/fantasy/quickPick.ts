/**
 * Quick-pick roster setup: the players most fantasy leagues roster, grouped by position,
 * so a new user can tap the ones they own instead of typing names. Uses the same
 * ownership cut as Pickups (likelyRostered), so the list matches what leagues hold.
 */

import type { LineupSlots, NhlSearchPlayer } from '../../types/fantasy';
import { normalizePosition } from './positions';
import { likelyRostered, type PickupCandidate } from './pickups';

export type QuickPickGroup = 'F' | 'D' | 'G';
export const QUICK_PICK_GROUPS: QuickPickGroup[] = ['F', 'D', 'G'];

/**
 * A standard 12-team league: most users play in one, and a fixed size keeps the list
 * the same for everyone during setup (the league size is set later in League settings).
 */
export const QUICK_PICK_LEAGUE_SIZE = 12;

export function quickPickGroup(position: string): QuickPickGroup | null {
  const slot = normalizePosition(position);
  if (slot === 'G') return 'G';
  if (slot === 'D') return 'D';
  return slot ? 'F' : null;
}

/** Most-owned first within each group; players without a known position are left out. */
export function quickPickGroups(
  candidates: PickupCandidate[],
  slots: LineupSlots,
  leagueSize: number = QUICK_PICK_LEAGUE_SIZE,
): Record<QuickPickGroup, NhlSearchPlayer[]> {
  const groups: Record<QuickPickGroup, NhlSearchPlayer[]> = { F: [], D: [], G: [] };
  const { skaters, goalies } = likelyRostered(candidates, leagueSize, slots);
  for (const candidate of [...skaters, ...goalies]) {
    const group = quickPickGroup(candidate.position);
    if (!group) continue;
    groups[group].push({ playerId: candidate.playerId, name: candidate.name, teamAbbrev: candidate.team, position: candidate.position, active: true });
  }
  return groups;
}
