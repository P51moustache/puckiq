import { SAMPLE_PLAYERS } from '../../../constants/sampleTeam';
import { createTeam } from '../../teams';
import { needsPersonalRoster, opportunityCopy } from '../proOpportunity';
import { targetPickups } from '../targetPickups';
import { buildSkaterForm } from '../form';
import type { PickupRow } from '../pickups';
import { player } from './fixtures';

it('asks for a personal roster before promoting personal advice', () => {
  expect(needsPersonalRoster(null)).toBe(true);
  expect(needsPersonalRoster(createTeam({}))).toBe(true);
  expect(needsPersonalRoster(createTeam({ players: SAMPLE_PLAYERS }))).toBe(true);
  expect(needsPersonalRoster(createTeam({ players: [player(0, 'Unlinked', '', 'C')] }))).toBe(true);
  expect(needsPersonalRoster(createTeam({ players: [player(8478402, 'Personal', 'EDM', 'C')] }))).toBe(false);
});

it('uses actual supplied gaps or alternatives without inventing a gain', () => {
  const team = createTeam({ players: [player(8478402, 'Personal', 'EDM', 'C')] });
  expect(opportunityCopy(team, { kind: 'lineup', date: '2026-10-13', emptySlots: 2 }).title).toBe('2 open slots on Oct 13');
  expect(opportunityCopy(team, { kind: 'pickups', alternatives: 4 }).title).toBe('4 more pickup options');
  expect(opportunityCopy(team).title).toBe('Built for your 1-player roster');
  expect(opportunityCopy(team).detail).not.toContain('+');
});

it('preserves exact forward-slot eligibility and handles unknown route parameters', () => {
  const row = (id: number, slots: PickupRow['slots']): PickupRow => ({ playerId: id, name: 'Candidate', team: 'EDM', position: 'C', slots, form: buildSkaterForm(id, {}), gain: 2, remainingGames: 1, usableGames: 1, emptyFills: 1, offNightGames: 0, days: [] });
  const rows = [row(1, ['C', 'F', 'UTIL']), row(2, ['RW', 'F', 'UTIL']), row(3, ['G'])];
  expect(targetPickups(rows, 'C').map((r) => r.playerId)).toEqual([1]);
  expect(targetPickups(rows, 'RW').map((r) => r.playerId)).toEqual([2]);
  expect(targetPickups(rows, 'F')).toHaveLength(2);
  expect(targetPickups(rows, 'anything')).toBe(rows);
});
