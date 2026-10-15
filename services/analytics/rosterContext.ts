import type { FantasyTeam } from '../../types/fantasy';
import { hasSamplePlayers } from '../../constants/sampleTeam';
import { isNhlLinked } from '../fantasy/positions';

/** Counts only; no team identity, names, roster contents or player IDs. */
export function rosterContext(team: FantasyTeam | null) {
  const players = team?.players ?? [];
  return {
    roster_count: players.length,
    linked_roster_count: players.filter(isNhlLinked).length,
    roster_kind: players.length === 0 ? 'empty' : hasSamplePlayers(team) ? 'sample' : 'personal',
    league_platform: team?.platform ?? 'none',
    league_format: team?.format ?? 'points',
  };
}
