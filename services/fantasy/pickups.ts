/**
 * Pickups ranked for MY lineup, not the league at large.
 *
 * A player is only worth adding on nights he'd actually start for you: either an
 * empty slot he can fill, or a starter he'd out-value. Score = value added over
 * the rest of the week.
 */

import type { FantasyPlayer, LineupSlots, SlotKey } from '../../types/fantasy';
import { daysBetween } from '../nhl/dates';
import { fantasyGamesOn, gameForTeam, isGameStarted, isOffNight, opponentOf, type WeekSchedule } from '../nhl/schedule';
import type { PlayerForm } from './form';
import { assignLineup } from './lineup';
import { eligibleSlots } from './positions';
import type { WeekPlan } from './weekPlan';

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
}

export function rankPickups(input: PickupInput): PickupRow[] {
  const rosterById = new Map(input.roster.map((player) => [player.playerId, player]));
  const rows: PickupRow[] = [];

  for (const candidate of input.candidates) {
    if (rosterById.has(candidate.playerId) || !candidate.team) continue;
    const slots = eligibleSlots({ position: candidate.position });
    if (slots.length === 0) continue;

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

      let usable = fillsEmpty;
      let dayGain = fillsEmpty ? candidate.form.value : 0;
      if (!fillsEmpty && planDay) {
        const lineup = assignLineup(
          [
            ...planDay.playing.map((id) => {
              const player = rosterById.get(id);
              return {
                playerId: id,
                slots: player ? eligibleSlots(player) : [],
                value: input.values.get(id) ?? 0,
              };
            }),
            { playerId: candidate.playerId, slots, value: candidate.form.value },
          ],
          input.slots,
        );
        usable = lineup.starters.some((seat) => seat.playerId === candidate.playerId);
        if (usable) {
          const displaced = lineup.bench.filter((id) => id !== candidate.playerId && !planDay.bench.includes(id));
          const lost = displaced.reduce((sum, id) => sum + (input.values.get(id) ?? 0), 0);
          dayGain = Math.max(0, candidate.form.value - lost);
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
  return new Set([...skaters, ...goalies].map((c) => c.playerId));
}

export type PickupFilter = 'ALL' | 'F' | 'D' | 'G';

export function filterPickups(rows: PickupRow[], filter: PickupFilter): PickupRow[] {
  if (filter === 'ALL') return rows;
  if (filter === 'F') return rows.filter((row) => row.slots.includes('F'));
  return rows.filter((row) => row.slots.includes(filter));
}
