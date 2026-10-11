/** Date-scoped, local start/sit choices. Optimization remains a separate recommendation. */
import type { FantasyTeam } from '../../types/fantasy';
import type { DayPlan } from './weekPlan';
import { assignLineup } from './lineup';
import { eligibleSlots } from './positions';
import { daysBetween } from '../nhl/dates';
import { isGameStarted, type NhlGame } from '../nhl/schedule';

export type LineupChoice = 'start' | 'sit';
export type LineupChoices = Record<string, Record<string, LineupChoice>>;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HISTORY_DAYS = 7;
const FUTURE_DAYS = 14;
function validDate(date: string): boolean {
  return (
    DATE_PATTERN.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
  );
}

export function sanitizeLineupChoices(
  raw: unknown,
  rosterIds: ReadonlySet<number>,
): LineupChoices {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: LineupChoices = {};
  for (const [date, values] of Object.entries(raw).slice(-30)) {
    if (
      !validDate(date) ||
      !values ||
      typeof values !== 'object' ||
      Array.isArray(values)
    )
      continue;
    const choices: Record<string, LineupChoice> = {};
    for (const [id, value] of Object.entries(values)) {
      if (rosterIds.has(Number(id)) && (value === 'start' || value === 'sit'))
        choices[String(Number(id))] = value;
    }
    if (Object.keys(choices).length) out[date] = choices;
  }
  return out;
}

/** Pure updater; keeps bounded plan history and never writes to a fantasy platform. */
export function setLineupChoice(
  team: FantasyTeam,
  date: string,
  playerId: number,
  choice: LineupChoice | null,
  today = date,
): FantasyTeam {
  if (
    !validDate(date) ||
    !team.players.some((p) => p.playerId === playerId && !p.injuredReserve)
  )
    return team;
  const choices = sanitizeLineupChoices(
    team.lineupChoices,
    new Set(team.players.map((p) => p.playerId)),
  );
  const next = { ...(choices[date] ?? {}) };
  if (choice) next[playerId] = choice;
  else delete next[playerId];
  choices[date] = next;
  const retained = Object.fromEntries(
    Object.entries(choices).filter(([day, values]) => {
      const offset = daysBetween(today, day);
      return (
        offset >= -HISTORY_DAYS &&
        offset <= FUTURE_DAYS &&
        Object.keys(values).length > 0
      );
    }),
  );
  return { ...team, lineupChoices: retained };
}

/** Saved choices are reconciled with eligibility, IR, scratches and real playing days. */
export function buildPlannedDay(
  team: FantasyTeam,
  best: DayPlan,
  values: ReadonlyMap<number, number>,
  excluded: ReadonlySet<number> = new Set(),
): DayPlan {
  const choices = team.lineupChoices?.[best.date] ?? {};
  const available = team.players.filter(
    (p) =>
      best.playing.includes(p.playerId) &&
      !p.injuredReserve &&
      !excluded.has(p.playerId),
  );
  const lineup = assignLineup(
    available
      .filter((p) => choices[p.playerId] !== 'sit')
      .map((p) => ({
        playerId: p.playerId,
        slots: eligibleSlots(p),
        value: values.get(p.playerId) ?? 0,
      })),
    team.slots,
    new Set(
      available
        .filter((p) => choices[p.playerId] === 'start')
        .map((p) => p.playerId),
    ),
  );
  const seated = new Set(lineup.starters.map((s) => s.playerId));
  return {
    ...best,
    ...lineup,
    bench: available
      .filter((p) => !seated.has(p.playerId))
      .map((p) => p.playerId)
      .sort((a,b) => (values.get(b) ?? 0)-(values.get(a) ?? 0) || a-b),
  };
}

export function saveBestLineup(team: FantasyTeam, day: DayPlan, today = day.date): FantasyTeam {
  let next = team;
  for (const id of day.playing)
    next = setLineupChoice(
      next,
      day.date,
      id,
      day.starters.some((s) => s.playerId === id) ? 'start' : 'sit',
      today,
    );
  return next;
}

export function lineupValue(
  day: Pick<DayPlan, 'starters'>,
  values: ReadonlyMap<number, number>,
): number {
  return day.starters.reduce(
    (sum, seat) => sum + (values.get(seat.playerId) ?? 0),
    0,
  );
}

/** Conservative daily lock: the saved plan freezes at the day's first puck drop. */
export function lineupLocked(games: readonly NhlGame[], now: Date): boolean {
  return games.some(
    (game) =>
      isGameStarted(game) ||
      (!!game.startTimeUTC && Date.parse(game.startTimeUTC) <= now.getTime()),
  );
}

export function starterChoiceError(
  team: FantasyTeam,
  day: DayPlan,
  playerId: number,
  values: ReadonlyMap<number, number>,
): string | null {
  const player = team.players.find((p) => p.playerId === playerId);
  if (!player) return 'Add this player to your roster first.';
  if (player.injuredReserve)
    return 'Move this player off IR in roster settings first.';
  if (!day.playing.includes(playerId))
    return 'This player has no available game on this date.';
  const next = setLineupChoice(team, day.date, playerId, 'start');
  const proposed = buildPlannedDay(next, day, values);
  const starts = new Set(proposed.starters.map((s) => s.playerId));
  const pinned = Object.entries(next.lineupChoices?.[day.date] ?? {}).filter(
    ([id, choice]) => choice === 'start' && day.playing.includes(Number(id)),
  );
  return pinned.some(([id]) => !starts.has(Number(id)))
    ? 'Your saved starters fill his eligible slots. Bench one first, or apply the best lineup.'
    : null;
}

/** Valid one-player replacements for a full set of pinned starters, least value first. */
export function starterReplacements(
  team: FantasyTeam,
  day: DayPlan,
  playerId: number,
  values: ReadonlyMap<number, number>,
): number[] {
  return day.starters
    .map((seat) => seat.playerId)
    .filter(
      (id) =>
        id !== playerId &&
        team.lineupChoices?.[day.date]?.[id] === 'start' &&
        starterChoiceError(
          setLineupChoice(team, day.date, id, 'sit'),
          day,
          playerId,
          values,
        ) === null,
    )
    .sort((a, b) => (values.get(a) ?? 0) - (values.get(b) ?? 0));
}
