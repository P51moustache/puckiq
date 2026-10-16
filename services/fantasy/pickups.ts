/**
 * Pickups ranked for MY lineup, not the league at large.
 *
 * A player is only worth adding on nights he'd actually start for you: either an
 * empty slot he can fill, or a starter he'd out-value. Score = value added over
 * the rest of the week.
 */

import type { FantasyPlayer, LineupSlots, SlotKey } from '../../types/fantasy';
import { daysBetween } from '../nhl/dates';
import { teamBackToBacks } from '../nhl/goalieStarts';
import { fantasyGamesOn, gameForTeam, isGameStarted, isOffNight, opponentOf, type WeekSchedule } from '../nhl/schedule';
import type { PlayerForm } from './form';
import { startChance } from './goalieOutlook';
import { assignLineup } from './lineup';
import { eligibleSlots, isGoalie } from './positions';
import { goalieValueOnNight, startShareOf, type PlanInput, type WeekPlan } from './weekPlan';

export interface PickupCandidate {
  playerId: number;
  name: string;
  team: string;
  position: string;
  form: PlayerForm;
}

export interface PickupDay {
  date: string;
  dayAbbrev: string;
  opponent: string;
  isHome: boolean;
  offNight: boolean;
  /** He'd get a slot this night. */
  usable: boolean;
  /** …by filling a slot that would otherwise be empty. */
  fillsEmpty: boolean;
}

export interface PickupRow {
  playerId: number;
  name: string;
  team: string;
  position: string;
  slots: SlotKey[];
  form: PlayerForm;
  remainingGames: number;
  usableGames: number;
  emptyFills: number;
  offNightGames: number;
  /** Value added to your lineup over the remaining days. */
  gain: number;
  days: PickupDay[];
}

export interface PickupInput {
  schedule: WeekSchedule;
  plan: WeekPlan;
  roster: FantasyPlayer[];
  slots: LineupSlots;
  values: Map<number, number>;
  candidates: PickupCandidate[];
  today: string;
  /** Only nights from `today` onward (default) or just one date. */
  onlyDate?: string;
  /**
   * The plan's own per-night goalie chances and shares (PlanInput), so each re-solved night values
   * my goalies the way the plan did. Streaming goalies get theirs from the schedule's back-to-backs.
   */
  startChanceOn?: PlanInput['startChanceOn'];
  startShares?: Map<number, number>;
}

export function rankPickups(input: PickupInput): PickupRow[] {
  const rosterById = new Map(input.roster.map((player) => [player.playerId, player]));
  const rows: PickupRow[] = [];
  const rosterValue = (id: number, date: string): number => {
    const value = input.values.get(id) ?? 0;
    const player = rosterById.get(id);
    if (!input.startChanceOn || !player || !isGoalie(player)) return value;
    return goalieValueOnNight(value, startShareOf(id, input.startShares), input.startChanceOn(id, date));
  };

  for (const candidate of input.candidates) {
    if (rosterById.has(candidate.playerId) || !candidate.team) continue;
    const slots = eligibleSlots({ position: candidate.position });
    if (slots.length === 0) continue;

    // A streaming goalie on a back-to-back usually starts one of the two nights. Nobody has read
    // his first night's starter, so that half stays a toss-up.
    const backToBacks = candidate.form.isGoalie ? teamBackToBacks(input.schedule.days, candidate.team) : null;
    const candidateValue = (date: string): number => {
      const backToBack = backToBacks?.get(date);
      if (!backToBack) return candidate.form.value;
      const chance = startChance({ startShare: candidate.form.startShare, backToBack });
      return goalieValueOnNight(candidate.form.value, candidate.form.startShare, chance);
    };

    const days: PickupDay[] = [];
    let gain = 0;
    for (const day of input.schedule.days) {
      if (daysBetween(input.today, day.date) < 0) continue;
      if (input.onlyDate && day.date !== input.onlyDate) continue;
      const games = fantasyGamesOn(day);
      const game = gameForTeam(games, candidate.team);
      // Only tonight's games can already be underway; later dates always count.
      if (!game || (day.date === input.today && isGameStarted(game))) continue;

      const planDay = input.plan.days.find((entry) => entry.date === day.date);
      const { opponent, isHome } = opponentOf(game, candidate.team);
      const fillsEmpty = !!planDay && planDay.empty.some((slot) => slots.includes(slot));

      const value = candidateValue(day.date);
      let usable = fillsEmpty;
      let dayGain = fillsEmpty ? value : 0;
      if (!fillsEmpty && planDay) {
        const lineup = assignLineup(
          [
            ...planDay.playing.map((id) => {
              const player = rosterById.get(id);
              return {
                playerId: id,
                slots: player ? eligibleSlots(player) : [],
                value: rosterValue(id, day.date),
              };
            }),
            { playerId: candidate.playerId, slots, value },
          ],
          input.slots,
        );
        usable = lineup.starters.some((seat) => seat.playerId === candidate.playerId);
        if (usable) {
          const displaced = lineup.bench.filter((id) => id !== candidate.playerId && !planDay.bench.includes(id));
          const lost = displaced.reduce((sum, id) => sum + rosterValue(id, day.date), 0);
          dayGain = Math.max(0, value - lost);
        }
      }

      gain += usable ? dayGain : 0;
      days.push({
        date: day.date,
        dayAbbrev: day.dayAbbrev,
        opponent,
        isHome,
        offNight: isOffNight(day),
        usable,
        fillsEmpty,
      });
    }

    if (days.length === 0) continue;
    rows.push({
      playerId: candidate.playerId,
      name: candidate.name,
      team: candidate.team,
      position: candidate.position,
      slots,
      form: candidate.form,
      remainingGames: days.length,
      usableGames: days.filter((day) => day.usable).length,
      emptyFills: days.filter((day) => day.fillsEmpty).length,
      offNightGames: days.filter((day) => day.offNight).length,
      gain,
      days,
    });
  }

  return rows.sort((a, b) => b.gain - a.gain || b.form.value - a.form.value || a.playerId - b.playerId);
}

/** Bench skaters and a backup goalie most teams carry beyond their active slots. */
const BENCH_SKATERS_PER_TEAM = 3;
const BENCH_GOALIES_PER_TEAM = 1;

/**
 * We can't see your league's waiver wire, so estimate who is already owned: in a
 * 12-team league the best ~170 skaters and ~36 goalies are almost never available.
 * Ranked by season value (last season before opening night).
 */
export function likelyRosteredIds(candidates: PickupCandidate[], leagueSize: number, slots: LineupSlots): Set<number> {
  const { skaters, goalies } = likelyRostered(candidates, leagueSize, slots);
  return new Set([...skaters, ...goalies].map((c) => c.playerId));
}

/** The players a league of this size would own, most-owned first: skaters and goalies ranked apart. */
export function likelyRostered(
  candidates: PickupCandidate[],
  leagueSize: number,
  slots: LineupSlots,
): { skaters: PickupCandidate[]; goalies: PickupCandidate[] } {
  const skaterSlots = slots.C + slots.LW + slots.RW + slots.F + slots.D + slots.UTIL;
  const skaterCut = leagueSize * (skaterSlots + BENCH_SKATERS_PER_TEAM);
  const goalieCut = leagueSize * (slots.G + BENCH_GOALIES_PER_TEAM);
  const bySeason = (a: PickupCandidate, b: PickupCandidate) => b.form.seasonRate - a.form.seasonRate || a.playerId - b.playerId;
  const skaters = candidates.filter((c) => !c.form.isGoalie).sort(bySeason).slice(0, skaterCut);
  // Goalie value per start ignores workload; owners hold starters, so rank goalies by share first.
  const goalies = candidates
    .filter((c) => c.form.isGoalie)
    .sort((a, b) => b.form.startShare - a.form.startShare || bySeason(a, b))
    .slice(0, goalieCut);
  return { skaters, goalies };
}

export type PickupFilter = 'ALL' | 'F' | 'D' | 'G';

export function filterPickups(rows: PickupRow[], filter: PickupFilter): PickupRow[] {
  if (filter === 'ALL') return rows;
  if (filter === 'F') return rows.filter((row) => row.slots.includes('F'));
  return rows.filter((row) => row.slots.includes(filter));
}
