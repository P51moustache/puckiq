import { createTeam, parseTeamsState, removePlayer } from '../../teams';
import { freeLineupCall, saveFreeLineupCall } from '../freeLineupCall';
import { buildPlannedDay, setLineupChoice } from '../lineupPlan';
import { startedPlayerIds } from '../loadNight';
import { buildWeekPlan } from '../weekPlan';
import { game, player, week } from './fixtures';

const date = '2026-10-13';
const players = [player(8478402, 'High center', 'EDM', 'C'), player(8481559, 'Low center', 'NJD', 'C'), player(8480069, 'Defense', 'COL', 'D')];
const slots = { C: 1, LW: 0, RW: 0, D: 1, F: 0, UTIL: 0, G: 0 };
const team = createTeam({ players, slots });
const values = new Map([[8478402, 10], [8481559, 3], [8480069, 5]]);
const best = buildWeekPlan({ players, slots, values, today: date, schedule: week('2026-10-12', { [date]: [game(date, 'EDM', 'NJD'), game(date, 'COL', 'BOS')] }) }).days.find((day) => day.date === date)!;

it('gives an actionable call without inventing a host-lineup gain', () => {
  expect(freeLineupCall(team, best, values)).toMatchObject({ startId: 8478402, benchId: null, estimatedGain: null, saved: false });
  const saved = saveFreeLineupCall(team, best, values, date);
  expect(saved.lineupChoices?.[date]).toEqual({ '8478402': 'start' });
  expect(team.lineupChoices?.[date]).toBeUndefined();
  expect(freeLineupCall(saved, best, values)?.saved).toBe(true);
  expect(saveFreeLineupCall(saved, best, values, date)).toBe(saved);
});

it('swaps a lower-value saved starter and persists just that decision', () => {
  const pinned = setLineupChoice(team, date, 8481559, 'start');
  const call = freeLineupCall(pinned, best, values)!;
  expect(call).toMatchObject({ kind: 'swap', startId: 8478402, benchId: 8481559, estimatedGain: 7 });
  const saved = saveFreeLineupCall(pinned, best, values, date, call);
  expect(saved.lineupChoices?.[date]).toEqual({ '8481559': 'sit', '8478402': 'start' });
  expect(buildPlannedDay(saved, best, values).starters).toEqual(best.starters);
  const restored = parseTeamsState(JSON.parse(JSON.stringify({ teams: [saved], activeTeamId: saved.id }))).teams[0];
  expect(restored.lineupChoices).toEqual(saved.lineupChoices);
});

it('rejects stale recommendations after removal, IR or a saved-plan change', () => {
  const call = freeLineupCall(team, best, values)!;
  const removed = removePlayer(team, call.startId);
  expect(saveFreeLineupCall(removed, best, values, date, call)).toBe(removed);
  const ir = { ...team, players: team.players.map((p) => p.playerId === call.startId ? { ...p, injuredReserve: true } : p) };
  expect(saveFreeLineupCall(ir, best, values, date, call)).toBe(ir);
  const changed = setLineupChoice(team, date, 8481559, 'start');
  expect(saveFreeLineupCall(changed, best, values, date, call)).toBe(changed);
});

it('does not offer an unavailable player or an ineligible slot', () => {
  const noGames = { ...best, playing: [], starters: [] };
  expect(freeLineupCall(team, noGames, values)).toBeNull();
  const badSeat = { ...best, starters: [{ playerId: 8478402, slot: 'G' as const }] };
  expect(freeLineupCall(team, badSeat, values)).toBeNull();
});

it('never calls a player whose game has already started', () => {
  expect(freeLineupCall(team, best, values, new Set([8478402]))).toMatchObject({ startId: 8480069 });
  expect(freeLineupCall(team, best, values, new Set([8478402, 8480069]))).toBeNull();
});

it('finds started players from the live game state, falling back to the schedule', () => {
  const night = {
    games: [{ id: 1, state: 'FINAL' }, { id: 2, state: 'FUT' }] as never,
    playerGames: {
      10: { gameId: 1, state: 'FUT' },
      11: { gameId: 2, state: 'FUT' },
      12: { gameId: 3, state: 'LIVE' },
      13: undefined,
    } as never,
  };
  expect([...startedPlayerIds(night)].sort()).toEqual([10, 12]);
});
