/**
 * "Up next" at the end of Tonight: after the glance at who plays, the one most useful thing to
 * do next, as a single tap. Pure — Tonight gathers the inputs and renders the result.
 *
 * Order: a lineup hole to fill before lock, then a hot player of mine who plays tonight, then
 * tomorrow once tonight is underway (or empty), then the week's head-to-head, then the week.
 * Free users never see Pro numbers here: no head-to-head, and plain games left instead of
 * games that count.
 */

import type { SlotKey } from '../../types/fantasy';
import type { Trend } from './form';
import type { MatchupSummary } from './matchup';
import type { NightPhase } from './nightScore';
import { SLOT_LABEL } from './positions';

export type NextUpKind = 'fill_slot' | 'hot_player' | 'tomorrow' | 'matchup' | 'week';

export type NextUpAction =
  | { type: 'pickups'; date: string; slot: SlotKey }
  | { type: 'player'; playerId: number }
  | { type: 'tomorrow' }
  | { type: 'week' };

export interface NextUpItem {
  kind: NextUpKind;
  title: string;
  detail: string;
  action: NextUpAction;
}

export interface NextUpPlayer {
  playerId: number;
  name: string;
  trend: Trend | null;
  /** Tonight's opponent, e.g. "MTL" or "@MTL". */
  opponent: string;
  /** The same soft-matchup tag Tonight shows on his card. */
  softMatchup: boolean;
}

export interface NextUpInput {
  night: 'tonight' | 'tomorrow';
  date: string;
  /** The viewed night's scoreboard phase; 'pre' until a game starts (and on nights with none). */
  phase: NightPhase | null;
  emptySlots: SlotKey[];
  /** My players with a game on the viewed night. */
  playing: NextUpPlayer[];
  /** My players with a game tomorrow (0 when unknown). */
  tomorrowPlaying: number;
  /** What's left of this week for my players; null until the week plan loads. */
  weekLeft: { games: number; starts: number } | null;
  matchup: Pick<MatchupSummary, 'mine' | 'theirs' | 'verdict'> | null;
  isPro: boolean;
}

const MATCHUP_TITLE: Record<MatchupSummary['verdict'], string> = {
  ahead: 'You’re ahead this week',
  behind: 'You’re behind this week',
  even: 'Your week is neck and neck',
};

export function pickNextUp(input: NextUpInput): NextUpItem | null {
  const beforeLock = input.phase === 'pre' || input.phase === null;
  const hasGames = input.playing.length > 0;

  if (hasGames && beforeLock && input.emptySlots.length > 0) return fillSlot(input);
  if (input.night === 'tonight' && hasGames && beforeLock) {
    const hot = input.playing.find((player) => player.trend === 'hot');
    if (hot) return hotPlayer(hot);
  }
  if (input.night === 'tonight' && input.tomorrowPlaying > 0 && (!hasGames || !beforeLock)) {
    return {
      kind: 'tomorrow',
      title: `Tomorrow: ${input.tomorrowPlaying} of your players play`,
      detail: 'See who to start before lock',
      action: { type: 'tomorrow' },
    };
  }
  if (input.matchup && input.isPro) {
    const { mine, theirs, verdict } = input.matchup;
    return {
      kind: 'matchup',
      title: MATCHUP_TITLE[verdict],
      detail: `${mine.starts} games that count left for you, ${theirs.starts} for them`,
      action: { type: 'week' },
    };
  }
  const left = input.weekLeft ? (input.isPro ? input.weekLeft.starts : input.weekLeft.games) : 0;
  if (left > 0) {
    return {
      kind: 'week',
      title: 'Plan the rest of your week',
      detail: input.isPro ? `${left} games that count left for your lineup` : `${left} games left for your players this week`,
      action: { type: 'week' },
    };
  }
  return null;
}

function fillSlot(input: NextUpInput): NextUpItem {
  const when = input.night === 'tonight' ? 'tonight' : 'tomorrow';
  const slots = input.emptySlots.map((slot) => SLOT_LABEL[slot]);
  return {
    kind: 'fill_slot',
    title: slots.length === 1 ? `Fill your empty ${slots[0]} slot` : `Fill ${slots.length} empty slots`,
    detail: slots.length === 1 ? `Find a pickup who plays ${when}` : `${slots.join(' · ')} — find pickups who play ${when}`,
    action: { type: 'pickups', date: input.date, slot: input.emptySlots[0] },
  };
}

function hotPlayer(player: NextUpPlayer): NextUpItem {
  return {
    kind: 'hot_player',
    title: `${player.name} is hot`,
    detail: `Plays ${player.opponent} tonight${player.softMatchup ? ' · soft matchup' : ''} — see his last games`,
    action: { type: 'player', playerId: player.playerId },
  };
}
