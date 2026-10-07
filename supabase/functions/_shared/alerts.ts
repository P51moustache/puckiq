/**
 * Player alerts: the pure core of the live-poller Edge Function (NHL parsing, game-day math, what to
 * read per game, diffing against what was already seen, device matching, push copy, Expo tickets).
 * Plain TypeScript with no imports so Deno and jest both load it as is. I/O lives in live-poller.
 *
 * NHL field paths, checked against real payloads (see __fixtures__):
 * - /v1/score/{date}: games[].{id, gameDate, startTimeUTC, gameState, gameScheduleState,
 *   awayTeam.{abbrev,score}, homeTeam.{abbrev,score}, goals[].periodDescriptor.periodType}
 * - /v1/gamecenter/{id}/right-rail: gameInfo.{awayTeam,homeTeam}.scratches[].{id, firstName.default, lastName.default}
 * - /v1/gamecenter/{id}/play-by-play: plays[] where typeDescKey === 'goal': eventId, timeInPeriod,
 *   periodDescriptor.{number, periodType, maxRegulationPeriods}, details.{scoringPlayerId,
 *   scoringPlayerTotal (season goals), assist1PlayerId, assist2PlayerId, awayScore, homeScore};
 *   rosterSpots[].{playerId, teamId, firstName.default, lastName.default}
 * Shootout attempts are 'goal' plays too (periodType 'SO'); they are not goals in any stat, so they
 * never alert. eventIds are not chronological, so "already seen" is always a set, never a max.
 */

export const NHL_WEB_API = 'https://api-web.nhle.com';
export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Tonight rolls over at 6 AM Eastern, so a 10:30 PM puck drop stays on the same game day until it ends. */
export const GAME_DAY_ROLLOVER_HOUR_ET = 6;
/** The NHL game report posts scratches about an hour before puck drop; start looking 90 minutes out. */
export const SCRATCH_LEAD_MINUTES = 90;
/** Late scratches can land right at puck drop; keep reading the report for the first 30 minutes. */
export const SCRATCH_TRAIL_MINUTES = 30;
/** A game that ended between polls gets one last read. Covers multi-overtime playoff nights. */
export const FINAL_RECONCILE_HOURS = 6;
/** Expo's limit per push request. */
export const EXPO_BATCH_SIZE = 100;
/** Both alerts are about tonight's game; Expo drops undelivered ones after two hours. */
export const ALERT_TTL_SECONDS = 2 * 60 * 60;

const MINUTE_MS = 60_000;
const SIREN = '\u{1F6A8}';
const EN_DASH = '\u2013';
const DOT = '\u00B7';
const UNKNOWN_PLAYER = 'Your player';

export type GamePhase = 'pregame' | 'live' | 'final' | 'other';

export interface ScoreGame {
  gameId: number;
  gameState: string;
  phase: GamePhase;
  /** False when the game is postponed, suspended or cancelled. */
  scheduled: boolean;
  startMs: number | null;
  gameDate: string | null;
  awayAbbrev: string;
  homeAbbrev: string;
  /** Goals so far excluding shootout attempts; null when the feed does not say. */
  goalCount: number | null;
}

export interface PlayerName {
  firstName: string;
  lastName: string;
}

export interface ScratchedPlayer extends PlayerName {
  playerId: number;
}

export interface GoalPlay {
  eventId: number;
  scorerId: number;
  scorerSeasonGoals: number | null;
  assistIds: number[];
  awayScore: number;
  homeScore: number;
  periodLabel: string;
  clock: string;
}

export interface PlayByPlay {
  awayAbbrev: string;
  homeAbbrev: string;
  goals: GoalPlay[];
  names: Map<number, PlayerName>;
}

/** One live_game_state row: what the poller already saw for a game. */
export interface GameMemory {
  gameId: number;
  gameDate: string;
  gameState: string;
  scratchIds: number[];
  goalEventIds: number[];
}

/** What to read for one game this minute. `silent` = remember what is there, alert nothing. */
export interface GamePlan {
  game: ScoreGame;
  memory: GameMemory | undefined;
  readScratches: boolean;
  readGoals: boolean;
  silent: boolean;
}

export interface GoalAlertEvent {
  kind: 'goal';
  key: string;
  gameId: number;
  scorer: { playerId: number; fullName: string; shortName: string };
  scorerSeasonGoals: number | null;
  assists: { playerId: number; shortName: string }[];
  scoreLine: string;
  clock: string;
}

export interface ScratchAlertEvent {
  kind: 'scratch';
  key: string;
  gameId: number;
  playerId: number;
  fullName: string;
  gameStarted: boolean;
}

export type AlertEvent = GoalAlertEvent | ScratchAlertEvent;

export interface AlertDevice {
  token: string;
  playerIds: number[];
  prefs: { scratches: boolean; goals: boolean };
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  ttl: number;
  data: { kind: AlertEvent['kind']; gameId: number; playerId: number };
}

export interface PendingAlert {
  token: string;
  eventKey: string;
  gameId: number;
  message: ExpoMessage;
}

// ---------------------------------------------------------------------------------------------
// Small readers for untrusted JSON
// ---------------------------------------------------------------------------------------------

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asPositiveInt(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}

function asNonNegativeInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** NHL localized strings look like { default: 'Connor', fr: '...' }. */
function localized(value: unknown): string {
  return asText(asRecord(value)?.default);
}

// ---------------------------------------------------------------------------------------------
// Game day and game phases
// ---------------------------------------------------------------------------------------------

const ET_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

const pad2 = (n: number) => String(n).padStart(2, '0');

/** The NHL game day (YYYY-MM-DD): the Eastern date, rolling over at 6:00 AM Eastern wall-clock time. */
export function nhlGameDay(now: Date): string {
  const parts: Record<string, number> = {};
  for (const part of ET_PARTS.formatToParts(now)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  const daysBack = parts.hour < GAME_DAY_ROLLOVER_HOUR_ET ? 1 : 0;
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - daysBack));
  return `${day.getUTCFullYear()}-${pad2(day.getUTCMonth() + 1)}-${pad2(day.getUTCDate())}`;
}

const PREGAME_STATES = new Set(['FUT', 'PRE']);
const LIVE_STATES = new Set(['LIVE', 'CRIT']);
const FINAL_STATES = new Set(['FINAL', 'OFF', 'OVER']);

export function phaseOf(gameState: string): GamePhase {
  const state = gameState.toUpperCase();
  if (PREGAME_STATES.has(state)) return 'pregame';
  if (LIVE_STATES.has(state)) return 'live';
  if (FINAL_STATES.has(state)) return 'final';
  return 'other';
}

function isShootout(descriptor: unknown): boolean {
  return asText(asRecord(descriptor)?.periodType).toUpperCase() === 'SO';
}

// ---------------------------------------------------------------------------------------------
// NHL parsing
// ---------------------------------------------------------------------------------------------

/** Games from /v1/score/{date}. Rows without an id are dropped. */
export function parseScoreGames(payload: unknown): ScoreGame[] {
  const games: ScoreGame[] = [];
  for (const raw of asArray(asRecord(payload)?.games)) {
    const game = asRecord(raw);
    const gameId = asPositiveInt(game?.id);
    if (!game || gameId === null) continue;
    const gameState = asText(game.gameState).toUpperCase() || 'FUT';
    const scheduleState = asText(game.gameScheduleState).toUpperCase();
    const startMs = Date.parse(asText(game.startTimeUTC));
    const away = asRecord(game.awayTeam);
    const home = asRecord(game.homeTeam);
    games.push({
      gameId,
      gameState,
      phase: phaseOf(gameState),
      scheduled: scheduleState === '' || scheduleState === 'OK',
      startMs: Number.isFinite(startMs) ? startMs : null,
      gameDate: /^\d{4}-\d{2}-\d{2}$/.test(asText(game.gameDate)) ? asText(game.gameDate) : null,
      awayAbbrev: asText(away?.abbrev),
      homeAbbrev: asText(home?.abbrev),
      goalCount: scoreFeedGoalCount(game, away, home),
    });
  }
  return games;
}

/** Non-shootout goals from the score feed's goals[], else the team scores (0-0 before the first goal). */
function scoreFeedGoalCount(game: Json, away: Json | null, home: Json | null): number | null {
  if (Array.isArray(game.goals)) {
    return game.goals.filter((goal) => !isShootout(asRecord(goal)?.periodDescriptor)).length;
  }
  const awayScore = asNonNegativeInt(away?.score);
  const homeScore = asNonNegativeInt(home?.score);
  return awayScore === null || homeScore === null ? null : awayScore + homeScore;
}

/** Official scratches (both teams) from /v1/gamecenter/{id}/right-rail. */
export function parseScratches(payload: unknown): ScratchedPlayer[] {
  const info = asRecord(asRecord(payload)?.gameInfo);
  const rows = [
    ...asArray(asRecord(info?.awayTeam)?.scratches),
    ...asArray(asRecord(info?.homeTeam)?.scratches),
  ];
  const seen = new Set<number>();
  const players: ScratchedPlayer[] = [];
  for (const raw of rows) {
    const row = asRecord(raw);
    const playerId = asPositiveInt(row?.id);
    if (playerId === null || seen.has(playerId)) continue;
    seen.add(playerId);
    players.push({ playerId, firstName: localized(row?.firstName), lastName: localized(row?.lastName) });
  }
  return players;
}

/** Goals (shootout attempts excluded) and player names from /v1/gamecenter/{id}/play-by-play. */
export function parsePlayByPlay(payload: unknown): PlayByPlay | null {
  const root = asRecord(payload);
  if (!root || !Array.isArray(root.plays)) return null;
  const names = new Map<number, PlayerName>();
  for (const raw of asArray(root.rosterSpots)) {
    const spot = asRecord(raw);
    const playerId = asPositiveInt(spot?.playerId);
    if (playerId !== null) names.set(playerId, { firstName: localized(spot?.firstName), lastName: localized(spot?.lastName) });
  }
  const goals: GoalPlay[] = [];
  for (const raw of root.plays) {
    const play = asRecord(raw);
    if (!play || play.typeDescKey !== 'goal' || isShootout(play.periodDescriptor)) continue;
    const details = asRecord(play.details);
    const eventId = asPositiveInt(play.eventId);
    const scorerId = asPositiveInt(details?.scoringPlayerId);
    if (eventId === null || scorerId === null) continue;
    goals.push({
      eventId,
      scorerId,
      scorerSeasonGoals: asPositiveInt(details?.scoringPlayerTotal),
      assistIds: [details?.assist1PlayerId, details?.assist2PlayerId]
        .map(asPositiveInt)
        .filter((id): id is number => id !== null),
      awayScore: asNonNegativeInt(details?.awayScore) ?? 0,
      homeScore: asNonNegativeInt(details?.homeScore) ?? 0,
      periodLabel: periodLabel(play.periodDescriptor),
      clock: formatClock(asText(play.timeInPeriod)),
    });
  }
  return {
    awayAbbrev: asText(asRecord(root.awayTeam)?.abbrev),
    homeAbbrev: asText(asRecord(root.homeTeam)?.abbrev),
    goals,
    names,
  };
}

/** P1-P3 in regulation, then OT, 2OT, ... (playoffs), SO. */
export function periodLabel(descriptor: unknown): string {
  const d = asRecord(descriptor);
  const number = asPositiveInt(d?.number) ?? 1;
  const regulation = asPositiveInt(d?.maxRegulationPeriods) ?? 3;
  const type = asText(d?.periodType).toUpperCase();
  if (type === 'SO') return 'SO';
  if (type === 'OT') {
    const overtime = number - regulation;
    return overtime <= 1 ? 'OT' : `${overtime}OT`;
  }
  return `P${number}`;
}

/** "04:14" -> "4:14"; the NHL pads minutes, a lock screen should not. */
export function formatClock(timeInPeriod: string): string {
  return timeInPeriod.replace(/^0(\d:\d\d)$/, '$1');
}

// ---------------------------------------------------------------------------------------------
// Planning and diffing
// ---------------------------------------------------------------------------------------------

function minutesToStart(game: ScoreGame, nowMs: number): number | null {
  return game.startMs === null ? null : (game.startMs - nowMs) / MINUTE_MS;
}

function inScratchWindow(game: ScoreGame, nowMs: number): boolean {
  const minutes = minutesToStart(game, nowMs);
  return minutes !== null && minutes <= SCRATCH_LEAD_MINUTES && minutes >= -SCRATCH_TRAIL_MINUTES;
}

/** Games worth any work right now; when none are, the poller stops before touching the database. */
export function isCandidate(game: ScoreGame, nowMs: number): boolean {
  if (!game.scheduled) return false;
  if (game.phase === 'live') return true;
  if (game.phase === 'pregame') return inScratchWindow(game, nowMs);
  if (game.phase === 'final') {
    const minutes = minutesToStart(game, nowMs);
    return minutes !== null && -minutes <= FINAL_RECONCILE_HOURS * 60;
  }
  return false;
}

/**
 * What to read for a candidate game, given what was seen before. Null = nothing to do.
 * - First sighting of a live game, or a final we never saw live: remember silently (old goals never alert).
 * - Play-by-play is read only when the score feed's goal count differs from what was seen.
 */
export function planGame(game: ScoreGame, memory: GameMemory | undefined, nowMs: number): GamePlan | null {
  if (!isCandidate(game, nowMs)) return null;
  const goalsChanged = !memory || game.goalCount === null || game.goalCount !== memory.goalEventIds.length;
  const plan = (readScratches: boolean, readGoals: boolean, silent: boolean): GamePlan =>
    ({ game, memory, readScratches, readGoals, silent });

  if (game.phase === 'pregame') return plan(true, false, false);
  if (game.phase === 'live') return plan(inScratchWindow(game, nowMs), goalsChanged, !memory);
  // Final.
  if (!memory) return plan(false, false, true);
  const seen = phaseOf(memory.gameState);
  if (seen === 'final') return null;
  if (seen !== 'live') return plan(false, false, true);
  return plan(false, goalsChanged, false);
}

/**
 * Applies what was read for one game. `undefined` = not read this minute; `null` = the read failed.
 * Returns the alerts to send and the row to store (null = leave the stored row alone).
 */
export function evaluateGame(
  plan: GamePlan,
  gameDay: string,
  scratches: ScratchedPlayer[] | null | undefined,
  playByPlay: PlayByPlay | null | undefined,
): { events: AlertEvent[]; memory: GameMemory | null } {
  const { game, memory, silent } = plan;
  const goalsFailed = plan.readGoals && !playByPlay;
  // Never store a first sighting without its goals: the next minute would announce them all.
  if (goalsFailed && !memory) return { events: [], memory: null };

  const events: AlertEvent[] = [];
  let scratchIds = memory?.scratchIds ?? [];
  if (scratches) {
    const known = new Set(scratchIds);
    if (!silent) {
      for (const player of scratches) {
        if (!known.has(player.playerId)) events.push(scratchEvent(game, player));
      }
    }
    scratchIds = scratches.map((player) => player.playerId);
  }

  let goalEventIds = memory?.goalEventIds ?? [];
  if (playByPlay) {
    const known = new Set(goalEventIds);
    if (!silent) {
      const shortNames = shortNamesFor(playByPlay.names);
      for (const goal of playByPlay.goals) {
        if (!known.has(goal.eventId)) events.push(goalEvent(game, playByPlay, goal, shortNames));
      }
    }
    goalEventIds = playByPlay.goals.map((goal) => goal.eventId);
  }

  const next: GameMemory = {
    gameId: game.gameId,
    gameDate: memory?.gameDate ?? game.gameDate ?? gameDay,
    // A failed final read keeps the old state so the next minute tries again.
    gameState: goalsFailed && memory ? memory.gameState : game.gameState,
    scratchIds,
    goalEventIds,
  };
  return { events, memory: memory && sameMemory(memory, next) ? null : next };
}

function sameMemory(a: GameMemory, b: GameMemory): boolean {
  const sameIds = (x: number[], y: number[]) => x.length === y.length && x.every((id, i) => id === y[i]);
  return a.gameState === b.gameState && sameIds(a.scratchIds, b.scratchIds) && sameIds(a.goalEventIds, b.goalEventIds);
}

// ---------------------------------------------------------------------------------------------
// Events and copy
// ---------------------------------------------------------------------------------------------

function fullName(name: PlayerName | undefined): string {
  const text = name ? `${name.firstName} ${name.lastName}`.trim() : '';
  return text || UNKNOWN_PLAYER;
}

/** Last names, with a first initial when two players in the same game share one (the Tkachuks). */
export function shortNamesFor(names: Map<number, PlayerName>): Map<number, string> {
  const counts = new Map<string, number>();
  for (const name of names.values()) counts.set(name.lastName, (counts.get(name.lastName) ?? 0) + 1);
  const short = new Map<number, string>();
  for (const [playerId, name] of names) {
    const shared = name.lastName !== '' && (counts.get(name.lastName) ?? 0) > 1;
    if (!name.lastName) short.set(playerId, fullName(name));
    else short.set(playerId, shared && name.firstName ? `${name.firstName[0]}. ${name.lastName}` : name.lastName);
  }
  return short;
}

function goalEvent(game: ScoreGame, pbp: PlayByPlay, goal: GoalPlay, shortNames: Map<number, string>): GoalAlertEvent {
  const away = pbp.awayAbbrev || game.awayAbbrev;
  const home = pbp.homeAbbrev || game.homeAbbrev;
  return {
    kind: 'goal',
    key: `goal:${game.gameId}:${goal.eventId}`,
    gameId: game.gameId,
    scorer: {
      playerId: goal.scorerId,
      fullName: fullName(pbp.names.get(goal.scorerId)),
      shortName: shortNames.get(goal.scorerId) ?? UNKNOWN_PLAYER,
    },
    scorerSeasonGoals: goal.scorerSeasonGoals,
    assists: goal.assistIds.map((playerId) => ({ playerId, shortName: shortNames.get(playerId) ?? UNKNOWN_PLAYER })),
    scoreLine: `${away} ${goal.awayScore}${EN_DASH}${goal.homeScore} ${home}`,
    clock: `${goal.periodLabel} ${goal.clock}`.trim(),
  };
}

function scratchEvent(game: ScoreGame, player: ScratchedPlayer): ScratchAlertEvent {
  return {
    kind: 'scratch',
    key: `scratch:${game.gameId}:${player.playerId}`,
    gameId: game.gameId,
    playerId: player.playerId,
    fullName: fullName(player),
    gameStarted: game.phase !== 'pregame',
  };
}

/** Goal copy for one device, or null when none of its players figure in the goal. */
export function formatGoalAlert(
  event: GoalAlertEvent,
  followed: ReadonlySet<number>,
): { title: string; body: string; playerId: number } | null {
  const scorerIsMine = followed.has(event.scorer.playerId);
  const myAssists = event.assists.filter((assist) => followed.has(assist.playerId));
  if (!scorerIsMine && myAssists.length === 0) return null;
  const tally = event.scorerSeasonGoals === null ? '' : ` (${event.scorerSeasonGoals})`;
  const title = scorerIsMine
    ? `${SIREN} ${event.scorer.shortName} scores${tally}`
    : `${SIREN} Goal: ${event.scorer.fullName}${tally}`;
  const assistNote = myAssists.length === 0
    ? ''
    : ` ${DOT} ${myAssists.length === 1 ? 'assist' : 'assists'}: ${myAssists.map((a) => a.shortName).join(', ')}`;
  return {
    title,
    body: `${event.scoreLine} ${DOT} ${event.clock}${assistNote}`,
    playerId: scorerIsMine ? event.scorer.playerId : myAssists[0].playerId,
  };
}

export function formatScratchAlert(event: ScratchAlertEvent): { title: string; body: string; playerId: number } {
  return {
    title: `Scratched: ${event.fullName}`,
    body: event.gameStarted
      ? 'Out tonight per the NHL game report.'
      : 'Out tonight per the NHL game report. Check your lineup before lock.',
    playerId: event.playerId,
  };
}

/** Every player id the events mention (for the && query on alert_devices.player_ids). */
export function eventPlayerIds(events: AlertEvent[]): number[] {
  const ids = new Set<number>();
  for (const event of events) {
    if (event.kind === 'scratch') ids.add(event.playerId);
    else [event.scorer.playerId, ...event.assists.map((a) => a.playerId)].forEach((id) => ids.add(id));
  }
  return [...ids];
}

/** One push per (device, event) the device follows and has turned on. */
export function buildAlerts(events: AlertEvent[], devices: AlertDevice[]): PendingAlert[] {
  const alerts: PendingAlert[] = [];
  for (const device of devices) {
    const followed = new Set(device.playerIds);
    for (const event of events) {
      let content: { title: string; body: string; playerId: number } | null = null;
      if (event.kind === 'goal' && device.prefs.goals) content = formatGoalAlert(event, followed);
      if (event.kind === 'scratch' && device.prefs.scratches && followed.has(event.playerId)) {
        content = formatScratchAlert(event);
      }
      if (!content) continue;
      alerts.push({
        token: device.token,
        eventKey: event.key,
        gameId: event.gameId,
        message: {
          to: device.token,
          title: content.title,
          body: content.body,
          sound: 'default',
          ttl: ALERT_TTL_SECONDS,
          data: { kind: event.kind, gameId: event.gameId, playerId: content.playerId },
        },
      });
    }
  }
  return alerts;
}

// ---------------------------------------------------------------------------------------------
// Database rows (snake_case) and Expo
// ---------------------------------------------------------------------------------------------

function idList(value: unknown): number[] {
  return asArray(value).map(asPositiveInt).filter((id): id is number => id !== null);
}

export function deviceFromRow(row: unknown): AlertDevice | null {
  const r = asRecord(row);
  const token = asText(r?.expo_push_token);
  if (!r || !token) return null;
  const prefs = asRecord(r.prefs);
  return { token, playerIds: idList(r.player_ids), prefs: { scratches: prefs?.scratches === true, goals: prefs?.goals === true } };
}

export function memoryFromRow(row: unknown): GameMemory | null {
  const r = asRecord(row);
  const gameId = asPositiveInt(r?.game_id);
  if (!r || gameId === null) return null;
  return {
    gameId,
    gameDate: asText(r.game_date),
    gameState: asText(r.game_state).toUpperCase(),
    scratchIds: idList(r.scratch_ids),
    goalEventIds: idList(r.goal_event_ids),
  };
}

export function memoryToRow(memory: GameMemory, nowIso: string) {
  return {
    game_id: memory.gameId,
    game_date: memory.gameDate,
    game_state: memory.gameState,
    scratch_ids: memory.scratchIds,
    goal_event_ids: memory.goalEventIds,
    updated_at: nowIso,
  };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Expo push tickets: how many were accepted and which tokens Expo says are gone for good. */
export function readExpoTickets(
  messages: Pick<ExpoMessage, 'to'>[],
  response: unknown,
): { ok: number; failed: number; deadTokens: string[] } {
  const tickets = asArray(asRecord(response)?.data);
  const dead = new Set<string>();
  let ok = 0;
  let failed = 0;
  tickets.forEach((raw, index) => {
    const ticket = asRecord(raw);
    if (ticket?.status === 'ok') {
      ok += 1;
      return;
    }
    failed += 1;
    const details = asRecord(ticket?.details);
    if (details?.error === 'DeviceNotRegistered') {
      const token = asText(details.expoPushToken) || messages[index]?.to;
      if (token) dead.add(token);
    }
  });
  failed += Math.max(0, messages.length - tickets.length);
  return { ok, failed, deadTokens: [...dead] };
}

/** Runs `task` over `items` with at most `limit` in flight; results keep input order. */
export async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * How long a cron ticket stays redeemable. pg_cron fires every minute and pg_net sends within
 * seconds, so two minutes covers a slow queue without leaving tickets lying around.
 */
export const TICKET_MAX_AGE_MS = 2 * 60 * 1000;

const TICKET_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The single-use ticket the cron job mints in Postgres (public.issue_poller_ticket) and sends in
 * the request body. Only something that can run SQL in the project can mint one, so the poller
 * needs no shared secret. Null unless the body carries a well-formed uuid.
 */
export function parseTicket(body: unknown): string | null {
  const ticket = asRecord(body)?.ticket;
  return typeof ticket === 'string' && TICKET_PATTERN.test(ticket) ? ticket.toLowerCase() : null;
}
