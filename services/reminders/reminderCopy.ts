/**
 * Words for game-night reminders. With lineup data, the lineup reminder names the moves ("Start
 * Hyman, Pesce · bench Kreider · G slot open"). Without it, or on a night with nothing to move or
 * fill, it falls back to how many of your players play.
 */

import type { SlotKey } from '../../types/fantasy';
import { SLOT_LABEL, SLOT_ORDER } from '../fantasy/positions';
import { lineupMoveCount, needsLineupMove, type LineupChange } from './lineupChanges';

/** One team's side of a game night. */
export interface TeamNight {
  name: string;
  /** My players with a game tonight (IR excluded). */
  playing: number;
  /** Tonight's lineup change; null without lineup data for this team and night. */
  change: LineupChange | null;
}

export interface ReminderCopy {
  title: string;
  body: string;
}

/** Names per list before "+N more". Three read at a glance on a lock screen. */
const NAMES_SHOWN = 3;
/** With several teams, two names per list keep each team's part to about a line. */
const NAMES_SHOWN_PER_TEAM = 2;
/**
 * Open slots worth naming. A pickup or two can fill one or two. Past that it's just a light night,
 * and listing most of the lineup would bury the moves.
 */
const MAX_OPEN_SLOTS_NAMED = 2;

const SET_YOUR_LINEUP = 'Set your lineup';

/** "7 of your players play tonight", or with several teams "Beauties: 4 · Bench Mob: 3". */
export function playingText(teams: TeamNight[]): string {
  return teams.length === 1
    ? `${teams[0].playing} of your players play tonight`
    : teams.map((team) => `${team.name}: ${team.playing}`).join(' · ');
}

/**
 * The lineup reminder for one night. Teams with nothing to move or fill drop out of the body; with
 * several teams, each part starts with the team's name.
 */
export function lineupReminderCopy(teams: TeamNight[], firstPuck: string): ReminderCopy {
  const tail = `First puck ${firstPuck}.`;
  if (!teams.some((team) => team.change && hasNews(team.change))) {
    return { title: SET_YOUR_LINEUP, body: `${playingText(teams)}. ${tail}` };
  }
  const several = teams.length > 1;
  const shown = teams.filter((team) => !team.change || hasNews(team.change));
  const parts = shown.map((team) => {
    const text = teamClauses(team, several).join(' · ');
    return several ? `${team.name}: ${text}` : capitalize(text);
  });
  return { title: titleOf(shown), body: `${parts.join('. ')}. ${tail}` };
}

export function liveReminderCopy(teams: TeamNight[]): ReminderCopy {
  return { title: 'Your night is live', body: `${playingText(teams)}. Follow your points live.` };
}

function namedOpenSlots(change: LineupChange): SlotKey[] {
  return change.emptySlots.length <= MAX_OPEN_SLOTS_NAMED ? change.emptySlots : [];
}

function hasNews(change: LineupChange): boolean {
  return needsLineupMove(change) || namedOpenSlots(change).length > 0;
}

function titleOf(shown: TeamNight[]): string {
  const moves = shown.reduce((sum, team) => sum + (team.change ? lineupMoveCount(team.change) : 0), 0);
  if (moves > 0) return moves === 1 ? 'Lineup change tonight' : `${moves} lineup changes tonight`;
  // A team without lineup data might still need a move.
  if (shown.some((team) => !team.change)) return SET_YOUR_LINEUP;
  return openSlotsTitle(shown.flatMap((team) => (team.change ? namedOpenSlots(team.change) : [])));
}

function teamClauses(team: TeamNight, several: boolean): string[] {
  const playing = several ? `${team.playing} play tonight` : `${team.playing} of your players play tonight`;
  const { change } = team;
  if (!change) return [playing];
  const cap = several ? NAMES_SHOWN_PER_TEAM : NAMES_SHOWN;
  const clauses: string[] = [];
  if (change.start.length > 0) clauses.push(`start ${nameList(change.start.map((row) => row.name), cap)}`);
  if (change.bench.length > 0) clauses.push(`bench ${nameList(change.bench.map((row) => row.name), cap)}`);
  if (clauses.length === 0) clauses.push(playing);
  const open = namedOpenSlots(change);
  if (open.length > 0) clauses.push(openSlotsText(open));
  return clauses;
}

/** "Hyman, Pesce, Kreider +2 more" */
function nameList(names: string[], cap: number): string {
  if (names.length <= cap) return names.join(', ');
  return `${names.slice(0, cap).join(', ')} +${names.length - cap} more`;
}

/** Slot counts in lineup order: ['G', 'D', 'D'] → D ×2, G ×1. */
function slotGroups(slots: SlotKey[]): { slot: SlotKey; count: number }[] {
  return SLOT_ORDER
    .map((slot) => ({ slot, count: slots.filter((open) => open === slot).length }))
    .filter((group) => group.count > 0);
}

/** "G slot open", "2 D slots open", "D and G slots open" */
function openSlotsText(slots: SlotKey[]): string {
  const labels = slotGroups(slots).map(({ slot, count }) => (count > 1 ? `${count} ${SLOT_LABEL[slot]}` : SLOT_LABEL[slot]));
  return `${joinWithAnd(labels)} slot${slots.length > 1 ? 's' : ''} open`;
}

/** "Open G slot tonight", "2 open D slots tonight", "2 open slots tonight" */
function openSlotsTitle(slots: SlotKey[]): string {
  const groups = slotGroups(slots);
  if (slots.length === 1) return `Open ${SLOT_LABEL[slots[0]]} slot tonight`;
  if (groups.length === 1) return `${slots.length} open ${SLOT_LABEL[groups[0].slot]} slots tonight`;
  return `${slots.length} open slots tonight`;
}

function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
