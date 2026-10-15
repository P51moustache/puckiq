import type { FantasyPlayer, FantasyTeam } from '../../types/fantasy';
import type { RosterPlayer } from '../nhl/rosters';
import { MAX_ROSTER_PLAYERS, sanitizePlayer } from '../teams';
import { sanitizeLineupChoices } from '../fantasy/lineupPlan';
import { membershipKey, type RosterConfirmation, type RosterCoverage } from './rosterConfirmation';
import { toFantasyPlayer } from './review';

export interface RosterProposal {
  teamId: string;
  baseRosterKey: string;
  selected: RosterPlayer[];
  method: 'screenshot' | 'paste';
  unresolved: number;
}
export interface RosterChanges {
  additions: FantasyPlayer[];
  retained: FantasyPlayer[];
  unseen: FantasyPlayer[];
  identityUpdates: { before: FantasyPlayer; after: FantasyPlayer }[];
  removed: FantasyPlayer[];
  players: FantasyPlayer[];
  error: string | null;
  coverage: RosterCoverage;
}

/** Detect roster edits while preserving unrelated changes such as league scoring or names. */
export function rosterReviewKey(team: FantasyTeam): string {
  return JSON.stringify([membershipKey(team), [...team.players].sort((a, b) => a.playerId - b.playerId)]);
}

/** Default is non-destructive. Full coverage only enables individually reviewed removals. */
export function reconcileRoster(team: FantasyTeam, proposal: RosterProposal, coverage: RosterCoverage, removeIds: ReadonlySet<number>): RosterChanges {
  const incoming = new Map(proposal.selected.map((p) => [p.playerId, sanitizePlayer(toFantasyPlayer(p))]));
  const existing = new Map(team.players.map((p) => [p.playerId, p]));
  const additions: FantasyPlayer[] = [];
  const retained: FantasyPlayer[] = [];
  const identityUpdates: RosterChanges['identityUpdates'] = [];
  for (const [id, player] of incoming) {
    if (!player) continue;
    const before = existing.get(id);
    if (!before) additions.push(player);
    else {
      // Only NHL identity fields change. Host-specific IR, eligibility and local slots survive.
      const after = { ...before, playerName: player.playerName, teamAbbrev: player.teamAbbrev, position: player.position };
      retained.push(after);
      if (before.playerName !== after.playerName || before.teamAbbrev !== after.teamAbbrev || before.position !== after.position) identityUpdates.push({ before, after });
    }
  }
  const unseen = team.players.filter((p) => !incoming.has(p.playerId));
  const removed = coverage === 'complete' ? unseen.filter((p) => removeIds.has(p.playerId)) : [];
  const removedIds = new Set(removed.map((p) => p.playerId));
  const updated = new Map(retained.map((p) => [p.playerId, p]));
  const players = [...team.players.filter((p) => !removedIds.has(p.playerId)).map((p) => updated.get(p.playerId) ?? p), ...additions];
  const error = team.id !== proposal.teamId || rosterReviewKey(team) !== proposal.baseRosterKey
    ? 'Your roster changed during review. Go back and review the changes again.'
    : !incoming.size || [...incoming.values()].some((p) => !p) ? 'Select at least one valid matched player before updating.'
    : coverage === 'complete' && proposal.unresolved > 0 ? 'Resolve unmatched names before confirming a full roster.'
    : coverage === 'partial' && removeIds.size > 0 ? 'Partial imports cannot remove players.'
    : [...removeIds].some((id) => !unseen.some((p) => p.playerId === id)) ? 'Only players absent from this import can be removed.'
    : players.length > MAX_ROSTER_PLAYERS ? `This would exceed ${MAX_ROSTER_PLAYERS} players. Review the roster before applying.` : null;
  return { additions, retained, identityUpdates, unseen, removed, players, error,
    coverage: coverage === 'complete' && unseen.length === removed.length ? 'complete' : 'partial' };
}

/** Pure guarded commit. Rejected/stale reviews do not mutate a team or record confirmation. */
export function applyRosterReconciliation(team: FantasyTeam, proposal: RosterProposal, coverage: RosterCoverage, removeIds: ReadonlySet<number>, receipt: Pick<RosterConfirmation, 'id' | 'confirmedAt'>): FantasyTeam {
  const changes = reconcileRoster(team, proposal, coverage, removeIds);
  if (changes.error) return team;
  const next = { ...team, players: changes.players };
  return { ...next,
    lineupChoices: sanitizeLineupChoices(team.lineupChoices, new Set(next.players.map((p) => p.playerId))),
    rosterConfirmation: { ...receipt, method: proposal.method, coverage: changes.coverage,
      reviewedPlayerIds: [...new Set(proposal.selected.map((p) => p.playerId))], membershipKey: membershipKey(next) },
    updatedAt: receipt.confirmedAt,
  };
}
