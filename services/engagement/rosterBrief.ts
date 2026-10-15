import type { FantasyTeam, InjuryConfidence, InjurySignal, SlotKey } from '../../types/fantasy';
import type { PlayerStatus } from '../fantasy/coach';
import type { GoalieOutlook, StartOutlook } from '../fantasy/goalieOutlook';
import { SLOT_ORDER } from '../fantasy/positions';
import { isCalendarDate, shortDate } from '../nhl/dates';

interface BriefPlayer { id: number; signal: InjurySignal; confidence: InjuryConfidence; goalie: StartOutlook | null }
export interface RosterSnapshot {
  schema: 1;
  date: string;
  checkedAt: number;
  players: BriefPlayer[];
  empty: Partial<Record<SlotKey, number>>;
}
export interface RosterBriefItem {
  kind: 'scratch' | 'injury_report' | 'goalie_outlook' | 'slot_gap';
  title: string;
  detail: string;
  playerId?: number;
  slot?: SlotKey;
}
const MAX_COMPARE_AGE = 14 * 24 * 60 * 60 * 1000;
// Bound persisted observations independently of arbitrary storage contents.
const MAX_SNAPSHOT_CHARACTERS = 20_000;
const MAX_ROSTER_PLAYERS = 50;
const SIGNALS = new Set<InjurySignal>(['ok', 'scratch', 'dtd', 'out', 'unknown']);
const CONFIDENCE = new Set<InjuryConfidence>(['confirmed', 'likely', 'unknown']);
const OUTLOOKS = new Set<StartOutlook>(['likely', 'split', 'unlikely']);

/** Local-only observations. Counts, NHL IDs and categorical signals; never stored in analytics. */
export function rosterSnapshot(input: { team: FantasyTeam; date: string; checkedAt: number; statuses: ReadonlyMap<number, PlayerStatus>; goalies: ReadonlyMap<number, GoalieOutlook>; empty: readonly SlotKey[] }): RosterSnapshot {
  return {
    schema: 1, date: input.date, checkedAt: input.checkedAt,
    players: input.team.players.filter((player) => !player.injuredReserve).map((player) => ({
      id: player.playerId, signal: input.statuses.get(player.playerId)?.signal ?? 'unknown',
      confidence: input.statuses.get(player.playerId)?.confidence ?? 'unknown',
      goalie: input.goalies.get(player.playerId)?.outlook ?? null,
    })),
    empty: Object.fromEntries(SLOT_ORDER.map((slot) => [slot, input.empty.filter((value) => value === slot).length])),
  };
}

/** Discard malformed, oversized or future local snapshots instead of showing false changes. */
export function parseRosterSnapshot(raw: string | null, now: number): RosterSnapshot | null {
  if (!raw || raw.length > MAX_SNAPSHOT_CHARACTERS) return null;
  try {
    const value = JSON.parse(raw);
    if (value.schema !== 1 || !isCalendarDate(value.date) || !Number.isFinite(value.checkedAt) || value.checkedAt < 0 || value.checkedAt > now || !Array.isArray(value.players) || value.players.length > MAX_ROSTER_PLAYERS) return null;
    if (!value.empty || typeof value.empty !== 'object' || Array.isArray(value.empty)) return null;
    const players: BriefPlayer[] = [];
    const seen = new Set<number>();
    for (const p of value.players) {
      if (!p || !Number.isInteger(p.id) || p.id <= 0 || seen.has(p.id) || !SIGNALS.has(p.signal) || !CONFIDENCE.has(p.confidence) || p.goalie !== null && !OUTLOOKS.has(p.goalie)) return null;
      seen.add(p.id); players.push({ id: p.id, signal: p.signal, confidence: p.confidence, goalie: p.goalie });
    }
    const empty: Partial<Record<SlotKey, number>> = {};
    for (const slot of SLOT_ORDER) {
      const count = value.empty[slot] ?? 0;
      if (!Number.isInteger(count) || count < 0 || count > MAX_ROSTER_PLAYERS) return null;
      empty[slot] = count;
    }
    return { schema: 1, date: value.date, checkedAt: value.checkedAt, players, empty };
  } catch { return null; }
}

/** Changes in observed data, not a claim of recovery or a confirmed goalie starter. */
export function rosterBrief(previous: RosterSnapshot | null, current: RosterSnapshot, team: FantasyTeam): RosterBriefItem[] {
  if (!previous || current.checkedAt < previous.checkedAt || current.checkedAt - previous.checkedAt > MAX_COMPARE_AGE) return [];
  const old = new Map(previous.players.map((p) => [p.id, p]));
  const names = new Map(team.players.map((p) => [p.playerId, p.playerName]));
  const items: RosterBriefItem[] = [];
  for (const player of current.players) {
    const before = old.get(player.id);
    const name = names.get(player.id);
    if (!before || !name) continue;
    if (player.signal === 'scratch' && player.confidence === 'confirmed' && (before.signal !== 'scratch' || before.confidence !== 'confirmed' || previous.date !== current.date)) {
      items.push({ kind: 'scratch', playerId: player.id, title: `${name} is on the NHL scratch list`, detail: `Confirmed for ${shortDate(current.date)}. Review your starters before lock.` });
    } else if ((player.signal === 'out' || player.signal === 'dtd') && player.confidence === 'likely' && player.signal !== before.signal) {
      items.push({ kind: 'injury_report', playerId: player.id, title: `New injury report for ${name}`, detail: `Recent news flags ${player.signal === 'out' ? 'an absence' : 'day-to-day status'}. Verify before lineup lock; this is not an NHL confirmation.` });
    }
    if (previous.date === current.date && before.goalie && player.goalie && before.goalie !== player.goalie) {
      items.push({ kind: 'goalie_outlook', playerId: player.id, title: `${name}: start outlook now ${player.goalie}`, detail: `Earlier estimate: ${before.goalie}. This is a probability-based outlook, not a confirmed starter.` });
    }
  }
  for (const slot of SLOT_ORDER) {
    const count = current.empty[slot] ?? 0;
    const increased = previous.date === current.date ? count > (previous.empty[slot] ?? 0) : count > 0;
    if (increased) items.push({ kind: 'slot_gap', slot, title: `${count} open ${slot} ${count === 1 ? 'slot' : 'slots'} on ${shortDate(current.date)}`, detail: previous.date === current.date ? 'Your latest lineup has more room at this position. Find one pickup who can play.' : 'A new game night has new lineup gaps. Check one pickup for this date.' });
  }
  return items;
}
