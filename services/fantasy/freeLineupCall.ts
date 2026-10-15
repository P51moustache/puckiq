import type { FantasyTeam, SlotKey } from '../../types/fantasy';
import type { DayPlan } from './weekPlan';
import { buildPlannedDay, lineupValue, setLineupChoice, starterChoiceError, starterReplacements } from './lineupPlan';
import { eligibleSlots } from './positions';

export interface FreeLineupCall {
  kind: 'start' | 'swap';
  startId: number;
  benchId: number | null;
  slot: SlotKey;
  /** Only compare with a saved local plan; no fabricated host lineup or guaranteed points. */
  estimatedGain: number | null;
  saved: boolean;
}

/** One complete recommendation using the same eligibility and values as the Pro optimizer. */
export function freeLineupCall(team: FantasyTeam, best: DayPlan, values: ReadonlyMap<number, number>): FreeLineupCall | null {
  const planned = buildPlannedDay(team, best, values);
  const hasPlan = !!team.lineupChoices?.[best.date];
  const starts = new Set(planned.starters.map((seat) => seat.playerId));
  const sorted = best.starters.filter((seat) => best.playing.includes(seat.playerId) && team.players.some((player) => player.playerId === seat.playerId && !player.injuredReserve && eligibleSlots(player).includes(seat.slot)))
    .sort((a, b) => (values.get(b.playerId) ?? 0) - (values.get(a.playerId) ?? 0) || a.playerId - b.playerId);
  for (const seat of sorted.filter((entry) => hasPlan && !starts.has(entry.playerId))) {
    const error = starterChoiceError(team, best, seat.playerId, values);
    const benchId = error ? starterReplacements(team, best, seat.playerId, values)[0] : planned.starters.find((entry) => entry.slot === seat.slot)?.playerId;
    if (error && !benchId) continue;
    const withoutBench = benchId ? setLineupChoice(team, best.date, benchId, 'sit') : team;
    if (starterChoiceError(withoutBench, best, seat.playerId, values)) continue;
    const proposed = buildPlannedDay(setLineupChoice(withoutBench, best.date, seat.playerId, 'start'), best, values);
    const gain = lineupValue(proposed, values) - lineupValue(planned, values);
    if (gain <= 0) continue;
    return {
      kind: benchId ? 'swap' : 'start', startId: seat.playerId, benchId: benchId ?? null, slot: seat.slot,
      estimatedGain: gain, saved: false,
    };
  }
  const seat = hasPlan ? sorted.find((entry) => starts.has(entry.playerId)) : sorted[0];
  if (!seat) return null;
  return { kind: 'start', startId: seat.playerId, benchId: null, slot: seat.slot, estimatedGain: null, saved: team.lineupChoices?.[best.date]?.[seat.playerId] === 'start' };
}

/** Recompute on committed state so a stale recommendation cannot violate roster eligibility. */
export function saveFreeLineupCall(team: FantasyTeam, best: DayPlan, values: ReadonlyMap<number, number>, today: string, expected?: FreeLineupCall): FantasyTeam {
  const call = freeLineupCall(team, best, values);
  if (!call || call.saved) return team;
  if (expected && (call.startId !== expected.startId || call.benchId !== expected.benchId || call.slot !== expected.slot)) return team;
  let next = call.benchId ? setLineupChoice(team, best.date, call.benchId, 'sit', today) : team;
  if (starterChoiceError(next, best, call.startId, values)) return team;
  next = setLineupChoice(next, best.date, call.startId, 'start', today);
  return next;
}
