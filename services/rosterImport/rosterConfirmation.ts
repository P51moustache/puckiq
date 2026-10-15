import type { FantasyTeam } from '../../types/fantasy';
import { MAX_ROSTER_PLAYERS } from '../../constants/roster';

export type RosterCoverage = 'partial' | 'complete';
export interface RosterConfirmation {
  id: string;
  confirmedAt: string;
  method: 'screenshot' | 'paste';
  coverage: RosterCoverage;
  /** Names actually reviewed; no screenshots, OCR text or host credentials. */
  reviewedPlayerIds: number[];
  membershipKey: string;
}

const MAX_MEMBERSHIP_KEY_LENGTH = 3000;

/** Membership and host association only. IR/eligibility have not been inferred from names. */
export function membershipKey(team: Pick<FantasyTeam, 'players' | 'platform' | 'teamLink'>): string {
  return JSON.stringify([team.platform, team.teamLink ?? '', team.players.map((p) => p.playerId).sort((a, b) => a - b)]);
}

export function parseRosterConfirmation(raw: unknown, now: number): RosterConfirmation | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'string' || !value.id || value.id.length > 100 ||
      typeof value.confirmedAt !== 'string' || !Number.isFinite(Date.parse(value.confirmedAt)) || Date.parse(value.confirmedAt) > now ||
      value.method !== 'screenshot' && value.method !== 'paste' ||
      value.coverage !== 'partial' && value.coverage !== 'complete' ||
      typeof value.membershipKey !== 'string' || value.membershipKey.length > MAX_MEMBERSHIP_KEY_LENGTH ||
      !Array.isArray(value.reviewedPlayerIds) || !value.reviewedPlayerIds.length || value.reviewedPlayerIds.length > MAX_ROSTER_PLAYERS ||
      value.reviewedPlayerIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
      new Set(value.reviewedPlayerIds).size !== value.reviewedPlayerIds.length) return undefined;
  return { id: value.id, confirmedAt: value.confirmedAt, method: value.method, coverage: value.coverage,
    reviewedPlayerIds: value.reviewedPlayerIds, membershipKey: value.membershipKey };
}

/** A later local edit never silently refreshes the user's observation. */
export function rosterConfirmationState(team: FantasyTeam): 'none' | 'changed' | RosterCoverage {
  if (!team.rosterConfirmation) return 'none';
  return team.rosterConfirmation.membershipKey === membershipKey(team) ? team.rosterConfirmation.coverage : 'changed';
}
