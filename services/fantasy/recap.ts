/**
 * The morning recap: last night, scored, at the top of Tonight until lunch. Pure helpers for
 * when it shows and what it says, shared by the recap card and its share image.
 */

import type { FantasyPlayer } from '../../types/fantasy';
import { GAME_DAY_ROLLOVER_HOUR_ET, getEtHour } from '../nhlDate';
import type { GameLine } from '../nhl/gamecenter';
import { BIG_NIGHT_LABEL, lineText, type NightScore, type PlayerNight } from './nightScore';
import { formatValue } from './scoring';

/**
 * The recap leads Tonight from the 6 AM game-day rollover until noon Eastern. Mornings are
 * when people check how last night went; by lunch tonight's lock matters more.
 */
export const RECAP_UNTIL_HOUR_ET = 12;

/** How many performers a recap names (the share card fits four tiles in a row). */
export const RECAP_TOP_PLAYERS = 4;

export function recapWindowOpen(now: Date): boolean {
  const hour = getEtHour(now);
  return hour >= GAME_DAY_ROLLOVER_HOUR_ET && hour < RECAP_UNTIL_HOUR_ET;
}

/** A recap needs a finished night in which at least one of my players reached the box score. */
export function hasRecap(score: NightScore | null): score is NightScore {
  return !!score && score.phase === 'final' && score.players.some((row) => row.points !== null);
}

/** The night's best performers, highest first. */
export function recapLeaders(score: NightScore, limit = RECAP_TOP_PLAYERS): PlayerNight[] {
  return score.players.filter((row) => (row.points ?? 0) > 0).slice(0, limit);
}

/**
 * "McDavid · 2G · 1A · 4 SOG · HAT TRICK" — one line for the top performer. Pass
 * `withLabel: false` where a badge already shows the big night.
 */
export function performerLine(
  row: PlayerNight,
  player: FantasyPlayer | undefined,
  line: GameLine | undefined,
  { withLabel = true }: { withLabel?: boolean } = {},
): string {
  const name = player ? player.playerName.trim().split(/\s+/).slice(-1)[0] : 'Top player';
  const parts = [name];
  if (line) parts.push(lineText(line));
  if (withLabel && row.bigNight) parts.push(BIG_NIGHT_LABEL[row.bigNight]);
  return parts.join(' · ');
}

/** "92% of the best lineup" — hindsight as a whole percent, never over 100. */
export function hindsightText(score: NightScore): string | null {
  if (!score.hindsight) return null;
  return `${Math.round(score.hindsight.share * 100)}% of the best lineup`;
}

/** "31.5" — points as the recap and share card print them. */
export function recapPointsText(points: number): string {
  return formatValue(points);
}
