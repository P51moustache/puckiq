/**
 * The roster import's safety net: names the roster index missed (a team whose roster didn't
 * load, a call-up not on one yet) looked up one by one with the regular player search. Only an
 * exact name counts, so a league or fantasy-team name never turns into a player.
 */

import type { NhlSearchPlayer } from '../../types/fantasy';
import type { RosterPlayer } from '../nhl/rosters';
import { searchNhlPlayers } from '../nhlPlayerSearch';
import { normalizeName } from './normalize';

/** A screenshot's worth of stragglers; more than this and the screenshot wasn't a roster. */
export const MAX_SEARCHED_LEFTOVERS = 8;
const RESULTS_PER_NAME = 5;

/** "Nikita Kucherov" -> first "Nikita", last "Kucherov"; "Trevor van Riemsdyk" keeps "van". */
export function rosterPlayerFromSearch(result: NhlSearchPlayer): RosterPlayer {
  const [firstName, ...rest] = result.name.trim().split(/\s+/);
  return { playerId: result.playerId, firstName, lastName: rest.join(' ') || firstName, team: result.teamAbbrev, position: result.position };
}

export async function searchLeftovers(names: string[]): Promise<Map<string, RosterPlayer>> {
  const found = new Map<string, RosterPlayer>();
  await Promise.all(names.slice(0, MAX_SEARCHED_LEFTOVERS).map(async (name) => {
    try {
      const results = await searchNhlPlayers(name, RESULTS_PER_NAME);
      const exact = results.find((result) => normalizeName(result.name) === normalizeName(name));
      if (exact) found.set(name, rosterPlayerFromSearch(exact));
    } catch {
      // A failed lookup leaves the name listed as missed.
    }
  }));
  return found;
}
