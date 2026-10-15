import { createTeam, parseTeamsState, addPlayers, removePlayer } from '../../teams';
import type { RosterPlayer } from '../../nhl/rosters';
import { applyRosterReconciliation, reconcileRoster, rosterReviewKey, type RosterProposal } from '../reconcileRoster';
import { membershipKey, parseRosterConfirmation, rosterConfirmationState } from '../rosterConfirmation';
import { toFantasyPlayer } from '../review';

const center: RosterPlayer = { playerId: 8478402, firstName: 'Connor', lastName: 'McDavid', team: 'EDM', position: 'C' };
const wing: RosterPlayer = { playerId: 8477934, firstName: 'Leon', lastName: 'Draisaitl', team: 'EDM', position: 'C' };
const defense: RosterPlayer = { playerId: 8482701, firstName: 'Luke', lastName: 'Hughes', team: 'NJD', position: 'D' };
const team = createTeam({ platform: 'yahoo', players: [
  { ...toFantasyPlayer(center), eligible: ['C', 'LW'], injuredReserve: true, rosterPosition: 'IR' }, toFantasyPlayer(wing),
] });
const receipt = { id: 'review-1', confirmedAt: '2026-10-13T19:00:00Z' };
const proposal = (selected = [center, defense], unresolved = 0): RosterProposal => ({ teamId: team.id, baseRosterKey: rosterReviewKey(team), selected, unresolved, method: 'screenshot' });

it('defaults to keeping unseen players in a partial import and preserves IR and eligibility', () => {
  const next = applyRosterReconciliation(team, proposal(), 'partial', new Set(), receipt);
  expect(next.players.map((p) => p.playerId)).toEqual([center.playerId, wing.playerId, defense.playerId]);
  expect(next.players[0]).toEqual(team.players[0]);
  expect(next.players[2].rosterPosition).toBe('BN');
  expect(next.rosterConfirmation).toMatchObject({ ...receipt, coverage: 'partial', reviewedPlayerIds: [center.playerId, defense.playerId] });
  expect(team.players).toHaveLength(2);
});

it('requires full coverage and a separate explicit removal selection', () => {
  const review = proposal();
  const untouched = applyRosterReconciliation(team, review, 'complete', new Set(), receipt);
  expect(untouched.players.some((p) => p.playerId === wing.playerId)).toBe(true);
  expect(untouched.rosterConfirmation?.coverage).toBe('partial');
  const removed = applyRosterReconciliation(team, review, 'complete', new Set([wing.playerId]), receipt);
  expect(removed.players.map((p) => p.playerId)).toEqual([center.playerId, defense.playerId]);
  expect(removed.rosterConfirmation?.coverage).toBe('complete');
  expect(applyRosterReconciliation(team, review, 'partial', new Set([wing.playerId]), receipt)).toBe(team);
});

it('allows an unchanged full roster to be confirmed without adding duplicates', () => {
  const next = applyRosterReconciliation(team, proposal([center, wing, center]), 'complete', new Set(), receipt);
  expect(next.players).toHaveLength(2);
  expect(next.rosterConfirmation?.reviewedPlayerIds).toEqual([center.playerId, wing.playerId]);
  expect(rosterConfirmationState(next)).toBe('complete');
});

it('shows NHL identity updates while retaining league-specific metadata', () => {
  const input = proposal([{ ...center, team: 'TOR', position: 'LW' }]);
  const changes = reconcileRoster(team, input, 'partial', new Set());
  expect(changes.identityUpdates).toHaveLength(1);
  const next = applyRosterReconciliation(team, input, 'partial', new Set(), receipt);
  expect(next.players[0]).toMatchObject({ teamAbbrev: 'TOR', position: 'LW', eligible: ['C', 'LW'], injuredReserve: true, rosterPosition: 'IR' });
});

it('blocks stale reviews, wrong teams and concurrent roster-setting edits', () => {
  const input = proposal();
  const removed = removePlayer(team, wing.playerId);
  const edited = { ...team, players: team.players.map((p) => ({ ...p, injuredReserve: false })) };
  for (const current of [removed, edited, { ...team, id: 'other-team' }]) {
    expect(applyRosterReconciliation(current, input, 'complete', new Set([wing.playerId]), receipt)).toBe(current);
  }
  const renamed = { ...team, name: 'Renamed league', opponentName: 'New opponent' };
  expect(applyRosterReconciliation(renamed, input, 'partial', new Set(), receipt)).toMatchObject({ name: 'Renamed league', opponentName: 'New opponent' });
});

it('blocks empty imports, unresolved full snapshots and removal of a matched player', () => {
  expect(applyRosterReconciliation(team, proposal([]), 'complete', new Set([wing.playerId]), receipt)).toBe(team);
  expect(applyRosterReconciliation(team, proposal(undefined, 1), 'complete', new Set([wing.playerId]), receipt)).toBe(team);
  expect(applyRosterReconciliation(team, proposal(), 'complete', new Set([center.playerId]), receipt)).toBe(team);
});

it('blocks overflow instead of silently truncating a roster', () => {
  const full = { ...team, players: Array.from({ length: 30 }, (_, i) => ({ ...toFantasyPlayer(center), playerId: i + 1 })) };
  const input = { ...proposal([center]), baseRosterKey: rosterReviewKey(full) };
  expect(reconcileRoster(full, input, 'partial', new Set()).error).toContain('exceed 30');
  expect(applyRosterReconciliation(full, input, 'partial', new Set(), receipt)).toBe(full);
});

it('removes departed players from saved lineup choices and preserves unrelated team settings', () => {
  const current = { ...team, lineupChoices: { '2026-10-13': { [center.playerId]: 'start' as const, [wing.playerId]: 'sit' as const } } };
  const input = { ...proposal(), baseRosterKey: rosterReviewKey(current) };
  const next = applyRosterReconciliation(current, input, 'complete', new Set([wing.playerId]), receipt);
  expect(next.lineupChoices).toEqual({ '2026-10-13': { [center.playerId]: 'start' } });
  expect(next.slots).toBe(current.slots);
  expect(next.scoring).toBe(current.scoring);
});

it('persists the confirmation separately and detects subsequent membership or host-association changes', () => {
  const confirmed = applyRosterReconciliation(team, proposal([center, wing]), 'complete', new Set(), receipt);
  const parsed = parseTeamsState({ activeTeamId: team.id, teams: [confirmed] }).teams[0];
  expect(parsed.rosterConfirmation).toEqual(confirmed.rosterConfirmation);
  const changed = addPlayers(parsed, [toFantasyPlayer(defense)]);
  expect(changed.rosterConfirmation?.confirmedAt).toBe(receipt.confirmedAt);
  expect(rosterConfirmationState(changed)).toBe('changed');
  expect(rosterConfirmationState({ ...parsed, platform: 'espn' })).toBe('changed');
  expect(rosterConfirmationState({ ...parsed, name: 'New name' })).toBe('complete');
});

it.each([null, {}, { ...receipt, method: 'paste', coverage: 'complete', reviewedPlayerIds: [1, 1], membershipKey: '' },
  { ...receipt, confirmedAt: '2100-01-01', method: 'paste', coverage: 'complete', reviewedPlayerIds: [1], membershipKey: '' }])('discards invalid stored confirmation metadata', (raw) => {
  expect(parseRosterConfirmation(raw, Date.parse('2026-10-13T20:00:00Z'))).toBeUndefined();
});

it('compares membership without making roster ordering or local update timestamps look like a host change', () => {
  expect(membershipKey(team)).toBe(membershipKey({ ...team, players: [...team.players].reverse() }));
  expect(rosterConfirmationState(team)).toBe('none');
});
