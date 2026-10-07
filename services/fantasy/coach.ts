/**
 * Tonight's coach: what to change in Yahoo / ESPN / Fantrax before lock.
 * Built from the NHL scratch sheet, roster-filtered news, and the slot-aware
 * lineup — never an invented "confirmed" status.
 */

import type { FantasyPlayer, InjuryConfidence, InjurySignal, SlotKey } from '../../types/fantasy';
import { formatPuckDrop } from '../nhl/dates';
import type { PlayerForm } from './form';
import type { DayPlan, PlayerGameDay } from './weekPlan';

export type CoachMoveKind = 'scratch' | 'injury' | 'overflow' | 'empty' | 'goalie' | 'off' | 'clean';

export interface CoachMove {
  id: string;
  kind: CoachMoveKind;
  /** 0 = act now … 4 = housekeeping */
  severity: number;
  title: string;
  detail: string;
  playerIds: number[];
  /** Empty-slot moves point at Pickups for this position. */
  slot?: SlotKey;
  /** A grouped empty-slot move lists every open position. */
  slots?: SlotKey[];
}

export interface PlayerStatus {
  playerId: number;
  signal: InjurySignal;
  confidence: InjuryConfidence;
  note: string | null;
}

export interface CoachInput {
  day: DayPlan;
  players: FantasyPlayer[];
  games: Record<number, PlayerGameDay | undefined>;
  statuses: Map<number, PlayerStatus>;
  forms: Map<number, PlayerForm>;
  /** How to name the night in copy: "tonight", "tomorrow". */
  when?: string;
}

function nameOf(players: Map<number, FantasyPlayer>, id: number): string {
  return players.get(id)?.playerName ?? 'Player';
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

/** Last names, with a first initial where two share one ("J. Hughes, Q. Hughes"). */
function shortNames(fullNames: string[]): string[] {
  const lasts = fullNames.map(lastName);
  return fullNames.map((full, index) => {
    const clash = lasts.some((other, j) => j !== index && other === lasts[index]);
    const first = full.trim().split(/\s+/)[0] ?? '';
    return clash && first && first !== lasts[index] ? `${first[0]}. ${lasts[index]}` : lasts[index];
  });
}

function joinNames(names: string[], max = 3): string {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} +${names.length - max}`;
}

/**
 * Everyone who plays but has no slot, as ONE move: "Sit 3: Scheifele, Larkin, Hughes" reads in
 * a glance, where three near-identical cards read like a wall. One player keeps the named form
 * with the starters who outrank him.
 */
function overflowMove(
  day: DayPlan,
  byId: Map<number, FantasyPlayer>,
  forms: Map<number, PlayerForm>,
  when: string,
): CoachMove | null {
  const benched = day.bench.filter((id) => byId.has(id));
  if (benched.length === 0) return null;
  if (benched.length > 1) {
    const names = shortNames(benched.map((id) => nameOf(byId, id)));
    return {
      id: `overflow-${benched.join('-')}`,
      kind: 'overflow',
      severity: 2,
      title: `Sit ${benched.length}: ${joinNames(names)}`,
      detail: `They play ${when}, but your slots at their positions are full with higher-value players.`,
      playerIds: benched,
    };
  }
  const id = benched[0];
  const player = byId.get(id)!;
  const mine = forms.get(id)?.value ?? 0;
  const names = day.starters
    .filter((seat) => (forms.get(seat.playerId)?.value ?? 0) >= mine && seat.playerId !== id)
    .map((seat) => seat.playerId)
    .filter((starterId) => byId.get(starterId)?.position === player.position)
    .map((starterId) => lastName(nameOf(byId, starterId)));
  return {
    id: `overflow-${id}`,
    kind: 'overflow',
    severity: 2,
    title: `Sit ${player.playerName}`,
    detail: names.length > 0
      ? `No slot left. ${joinNames(names)} ${names.length === 1 ? 'has' : 'have'} more value ${when}.`
      : `Your eligible slots are full with higher-value players ${when}.`,
    playerIds: [id],
  };
}

/**
 * Two or more open positions read as one move ("3 empty slots tonight: RW · D · G") with a
 * pickup link per position, instead of a stack of identical cards. One position keeps its own card.
 */
function emptySlotsMove(counts: Map<SlotKey, number>, when: string): CoachMove | null {
  if (counts.size < 2) return null;
  const entries = [...counts];
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const label = entries.map(([slot, count]) => (count > 1 ? `${count} ${slot}` : slot)).join(' · ');
  return {
    id: `empty-${entries.map(([slot]) => slot).join('-')}`,
    kind: 'empty',
    severity: 2,
    title: `${total} empty slots ${when}: ${label}`,
    detail: `Nobody eligible of yours is left to play at these spots ${when}. Each streamer adds a game you’d otherwise lose.`,
    playerIds: [],
    slot: entries[0][0],
    slots: entries.map(([slot]) => slot),
  };
}

export function buildCoachMoves({ day, players, games, statuses, forms, when = 'tonight' }: CoachInput): CoachMove[] {
  const byId = new Map(players.map((player) => [player.playerId, player]));
  const moves: CoachMove[] = [];
  const startersById = new Map(day.starters.map((seat) => [seat.playerId, seat.slot]));

  // Status moves cover everyone with a game — including scratches the lineup already left out.
  for (const { playerId: id } of players) {
    const status = statuses.get(id);
    const game = games[id];
    if (!status || !game) continue;
    const name = nameOf(byId, id);
    if (status.signal === 'scratch' && status.confidence === 'confirmed') {
      moves.push({
        id: `scratch-${id}`,
        kind: 'scratch',
        severity: 0,
        title: `Bench ${name}`,
        detail: `On the NHL scratch list vs ${game.opponent}.`,
        playerIds: [id],
      });
    } else if (status.signal === 'out' || status.signal === 'dtd' || status.signal === 'scratch') {
      moves.push({
        id: `injury-${id}`,
        kind: 'injury',
        severity: 1,
        title: `Check ${name} before ${formatPuckDrop(game.startTimeUTC)}`,
        detail: status.note ?? 'Injury language in today’s news. Not confirmed by the NHL yet.',
        playerIds: [id],
      });
    }
  }

  const overflow = overflowMove(day, byId, forms, when);
  if (overflow) moves.push(overflow);

  const emptyCounts = new Map<SlotKey, number>();
  for (const slot of day.empty) emptyCounts.set(slot, (emptyCounts.get(slot) ?? 0) + 1);
  const grouped = emptySlotsMove(emptyCounts, when);
  if (grouped) moves.push(grouped);
  for (const [slot, count] of grouped ? [] : emptyCounts) {
    moves.push({
      id: `empty-${slot}`,
      kind: 'empty',
      severity: 2,
      title: `${count} empty ${slot} slot${count === 1 ? '' : 's'} ${when}`,
      detail: slot === 'UTIL'
        ? `No spare skater of yours plays ${when}. A streamer adds a game you’d otherwise lose.`
        : `No ${slot}-eligible player of yours is left to play ${when}. A streamer adds a game you’d otherwise lose.`,
      playerIds: [],
      slot,
    });
  }

  for (const id of day.playing) {
    const form = forms.get(id);
    const player = byId.get(id);
    if (!player || !form?.isGoalie) continue;
    if (statuses.get(id)?.signal === 'scratch') continue;
    const game = games[id];
    if (game && ['LIVE', 'CRIT', 'FINAL', 'OFF'].includes(game.state)) continue;
    const pct = Math.round(form.startShare * 100);
    moves.push({
      id: `goalie-${id}`,
      kind: 'goalie',
      severity: 3,
      title: `${player.playerName}: starter not announced`,
      detail: `The NHL doesn't post starters before puck drop. He's started ~${pct}% of his team's games.`,
      playerIds: [id],
    });
  }

  const off = players.filter((player) => !player.injuredReserve && !day.playing.includes(player.playerId));
  if (off.length > 0 && day.playing.length > 0) {
    moves.push({
      id: 'off',
      kind: 'off',
      severity: 4,
      title: `${off.length} with no game — keep them benched`,
      detail: joinNames(off.map((player) => player.playerName), 4),
      playerIds: off.map((player) => player.playerId),
    });
  }

  if (!moves.some((move) => move.severity <= 2) && day.playing.length > 0) {
    moves.unshift({
      id: 'clean',
      kind: 'clean',
      severity: 5,
      title: 'Lineup is clean',
      detail: `${startersById.size} starters, no conflicts or scratches posted.`,
      playerIds: [],
    });
  }

  return moves.sort((a, b) => a.severity - b.severity);
}

/** Free sees one move. Pro sees the list. */
export function visibleMoves(moves: CoachMove[], isPro: boolean): CoachMove[] {
  return isPro ? moves : moves.slice(0, 1);
}

export const HOST_NOTE = 'Make changes in Yahoo, ESPN, or Fantrax. PuckIQ never touches your league.';
