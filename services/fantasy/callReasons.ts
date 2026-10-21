/**
 * Why the lineup call says what it says: a few short reasons, the most telling first.
 *
 * Built only from signals Tonight already shows (matchup tags, hot/cold, the goalie start
 * outlook) plus the per-game value the call was ranked on, so the "why" never claims more than
 * the call knows. No odds, no betting language, nothing "confirmed" that isn't.
 */

import type { FantasyPlayer } from '../../types/fantasy';
import type { TeamStrength } from '../nhl/teams';
import type { FreeLineupCall } from './freeLineupCall';
import type { PlayerForm } from './form';
import type { GoalieOutlook } from './goalieOutlook';
import { matchupTagFor } from './matchupTag';
import { lastNameOf } from './names';
import { formReason, matchupReason } from './playerVerdict';
import { formatValue } from './scoring';
import type { PlayerGameDay } from './weekPlan';

/** Enough to explain the call; more would turn the card back into a stat sheet. */
export const MAX_CALL_REASONS = 3;

/** What the reason says about the call: picks its icon (up arrow, flame, down arrow, dot). */
export type CallReasonTone = 'good' | 'hot' | 'bad' | 'neutral';

export interface CallReason {
  text: string;
  tone: CallReasonTone;
}

export interface CallReasonInput {
  call: Pick<FreeLineupCall, 'startId' | 'benchId'>;
  players: FantasyPlayer[];
  /** Tonight's game per player: the opponent each reason names. */
  games: Record<number, PlayerGameDay | undefined>;
  /** The per-game values the call was ranked on (Tonight's lineup values). */
  values: ReadonlyMap<number, number>;
  forms?: ReadonlyMap<number, PlayerForm>;
  /** Opponent strength by team. Missing: no matchup reasons. */
  strength?: Map<string, TeamStrength>;
  goalieOutlooks?: ReadonlyMap<number, GoalieOutlook>;
}

/**
 * At most MAX_CALL_REASONS lines, in this order: what backs the starter (a soft matchup, a hot
 * streak), his start outlook (goalies), what holds back the player he replaces, any caution about
 * the starter (a tough matchup, a cold stretch), and last the value gap. Always at least one line
 * while the starter is on the roster, so the card never says "trust me".
 */
export function lineupCallReasons(input: CallReasonInput): CallReason[] {
  const { call, players, games, values, forms, strength, goalieOutlooks } = input;
  const start = players.find((player) => player.playerId === call.startId);
  if (!start) return [];
  const bench = call.benchId === null ? undefined : players.find((player) => player.playerId === call.benchId);
  const startForm = forms?.get(start.playerId);
  const goalie = startForm?.isGoalie ?? start.position === 'G';
  const startGame = games[start.playerId];

  const matchup = reason(startGame ? matchupReason(startGame.opponent, goalie, strength) : null,
    startGame && matchupTagFor(startForm ?? { isGoalie: goalie }, strength?.get(startGame.opponent))?.tone === 'bad' ? 'bad' : 'good');
  const form = reason(formReason(startForm ?? null, [], goalie), startForm?.trend === 'cold' ? 'bad' : 'hot');
  const starterNotes = [matchup, form];
  const reasons = [
    // What backs the call leads; a caution about the starter follows, ahead of the value line.
    ...starterNotes.filter((entry) => entry?.tone !== 'bad'),
    reason(goalie ? goalieOutlooks?.get(start.playerId)?.reason ?? null : null, 'neutral'),
    reason(bench ? benchReason(bench, games, forms, strength) : null, 'bad'),
    ...starterNotes.filter((entry) => entry?.tone === 'bad'),
    reason(valueReason(start, bench, values), 'neutral'),
  ];
  return reasons.filter((entry): entry is CallReason => entry !== null).slice(0, MAX_CALL_REASONS);
}

function reason(text: string | null, tone: CallReasonTone): CallReason | null {
  return text ? { text, tone } : null;
}

/** What makes the replaced player the one to sit: a tough matchup or a cold stretch. */
function benchReason(
  bench: FantasyPlayer,
  games: Record<number, PlayerGameDay | undefined>,
  forms: ReadonlyMap<number, PlayerForm> | undefined,
  strength: Map<string, TeamStrength> | undefined,
): string | null {
  const name = lastNameOf(bench.playerName);
  const form = forms?.get(bench.playerId);
  const game = games[bench.playerId];
  const tag = game ? matchupTagFor(form ?? { isGoalie: bench.position === 'G' }, strength?.get(game.opponent)) : null;
  if (game && tag?.tone === 'bad') return `${name} has a tough matchup ${game.isHome ? 'vs' : '@'} ${game.opponent}`;
  if (form?.trend === 'cold') return `${name} is cold lately`;
  return null;
}

/** "3.2 a game in your scoring, vs 2.1 for Nylander" — the gap the call was ranked on. */
function valueReason(start: FantasyPlayer, bench: FantasyPlayer | undefined, values: ReadonlyMap<number, number>): string | null {
  const mine = values.get(start.playerId);
  if (mine === undefined) return null;
  const theirs = bench ? values.get(bench.playerId) : undefined;
  if (bench && theirs !== undefined) {
    return `${formatValue(mine)} a game in your scoring, vs ${formatValue(theirs)} for ${lastNameOf(bench.playerName)}`;
  }
  return `${formatValue(mine)} a game in your scoring, your best fit for this slot`;
}
