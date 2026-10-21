/**
 * Words for game-night reminders, laid out as a checklist (docs/design/notifications, concept B): a short
 * title with the puck-drop time, then one fact per line with a label, so the lock screen never wraps a
 * fact in half.
 *
 *   Set your lineup by 7:00 PM
 *   Start: Hyman, Pesce
 *   Sit: Kreider
 *   Open: G slot
 *
 * With several teams, each fact still gets its own line, led by the team ("Beauties: Start Hyman, Pesce",
 * "Beauties: Sit Kreider"). Without lineup data, or on a night with nothing to move or fill, a line says
 * how many of your players play.
 */

import type { SlotKey } from '../../types/fantasy';
import { SLOT_LABEL, SLOT_ORDER } from '../fantasy/positions';
import { needsLineupMove, type LineupChange } from './lineupChanges';

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

/** Names per list before "+N more". Three fit one lock-screen line after "Start: ". */
const NAMES_SHOWN = 3;
/** With several teams the team name leads each line, so two names per list keep it to one line. */
const NAMES_SHOWN_PER_TEAM = 2;
/**
 * Open slots worth naming. A pickup or two can fill one or two. Past that it's just a light night,
 * and listing most of the lineup would bury the moves.
 */
const MAX_OPEN_SLOTS_NAMED = 2;

/** Between lines: one fact per line. */
const LINE_BREAK = '\n';
const PLAYING = 'Playing';

/**
 * The lineup reminder for one night. Teams with nothing to move or fill drop out of the body, unless
 * no team has anything; then every team's player count shows.
 */
export function lineupReminderCopy(teams: TeamNight[], firstPuck: string): ReminderCopy {
  const anyNews = teams.some((team) => team.change && hasNews(team.change));
  const listed = anyNews ? teams.filter((team) => !team.change || hasNews(team.change)) : teams;
  const title = `Set your lineup${listed.length > 1 ? 's' : ''} by ${firstPuck}`;
  const lines = listed.length === 1 ? teamLines(listed[0]) : listed.flatMap(severalTeamLines);
  return { title, body: lines.join(LINE_BREAK) };
}

/** "7 of your players are playing", or with several teams one "Beauties: 4 playing" line each. */
export function liveReminderCopy(teams: TeamNight[]): ReminderCopy {
  const body = teams.length === 1
    ? `${teams[0].playing} of your players ${teams[0].playing === 1 ? 'is' : 'are'} playing`
    : teams.map((team) => `${team.name}: ${team.playing} playing`).join(LINE_BREAK);
  return { title: 'Your night is live', body };
}

function namedOpenSlots(change: LineupChange): SlotKey[] {
  return change.emptySlots.length <= MAX_OPEN_SLOTS_NAMED ? change.emptySlots : [];
}

function hasNews(change: LineupChange): boolean {
  return needsLineupMove(change) || namedOpenSlots(change).length > 0;
}

/** One team alone: "Start: Hyman, Pesce" / "Sit: Kreider" / "Open: G slot". */
function teamLines(team: TeamNight): string[] {
  return factsOf(team, NAMES_SHOWN).map(({ label, text }) => `${label}: ${text}`);
}

/**
 * One of several teams: "Beauties: Start Hyman, Pesce", "Bench Mob: Fill G slot", or "Bench Mob: 4 playing"
 * when there's nothing else to say. Lines are scarce (the lock screen shows four), so a count beside a
 * slot to fill is dropped.
 */
function severalTeamLines(team: TeamNight): string[] {
  const facts = factsOf(team, NAMES_SHOWN_PER_TEAM);
  const shown = facts.length > 1 ? facts.filter((fact) => fact.label !== PLAYING) : facts;
  return shown.map(({ label, text, several }) => `${team.name}: ${several ?? `${label} ${text}`}`);
}

interface Fact {
  label: string;
  text: string;
  /** The wording after the team's name when it differs from "label text". */
  several?: string;
}

/** What one team needs tonight, most urgent first: starts, sits, then open slots. */
function factsOf(team: TeamNight, cap: number): Fact[] {
  const { change } = team;
  const facts: Fact[] = [];
  if (change && change.start.length > 0) facts.push({ label: 'Start', text: nameList(change.start.map((row) => row.name), cap) });
  if (change && change.bench.length > 0) facts.push({ label: 'Sit', text: nameList(change.bench.map((row) => row.name), cap) });
  if (facts.length === 0) facts.push({ label: PLAYING, text: `${team.playing} of your players`, several: `${team.playing} playing` });
  const open = change ? namedOpenSlots(change) : [];
  if (open.length > 0) facts.push({ label: 'Open', text: slotsText(open), several: `Fill ${slotsText(open)}` });
  return facts;
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

/** "G slot", "2 D slots", "D and G slots" */
function slotsText(slots: SlotKey[]): string {
  const labels = slotGroups(slots).map(({ slot, count }) => (count > 1 ? `${count} ${SLOT_LABEL[slot]}` : SLOT_LABEL[slot]));
  return `${joinWithAnd(labels)} slot${slots.length > 1 ? 's' : ''}`;
}

function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
