import * as fs from 'fs';
import * as path from 'path';
import {
  ALERT_TTL_SECONDS,
  AlertDevice,
  AlertEvent,
  GameMemory,
  GoalAlertEvent,
  ScoreGame,
  bearerRole,
  buildAlerts,
  chunk,
  deviceFromRow,
  evaluateGame,
  eventPlayerIds,
  formatClock,
  isCandidate,
  mapLimit,
  memoryFromRow,
  memoryToRow,
  nhlGameDay,
  parsePlayByPlay,
  parseScoreGames,
  parseScratches,
  periodLabel,
  planGame,
  readExpoTickets,
} from '../alerts';

// Real NHL payloads, trimmed (see __fixtures__). Live states are derived from them below by cutting
// a real final game's plays short and relabeling its state, since no game is live while writing this.
const fixture = (name: string): any =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', '__fixtures__', name), 'utf8'));

const scoreFinal = fixture('score-2026-10-04-final.json');
const scoreFuture = fixture('score-2026-10-06-future.json');
const scoreShootout = fixture('score-2026-03-28-shootout.json');
const pbpOvertime = fixture('pbp-2026020037-final-ot.json');
const pbpShootout = fixture('pbp-2025021159-final-shootout.json');
const rightRail = fixture('right-rail-2026020043.json');
const rightRailFuture = fixture('right-rail-2026020044-future.json');

const GAME_DAY = '2026-10-04';
const OT_GAME_ID = 2026020037; // FLA 2 @ ANA 3 (OT), puck drop 2026-10-05T00:00Z
const OT_START = Date.parse('2026-10-05T00:00:00Z');
const minutes = (n: number) => n * 60_000;

const PLAYERS = {
  gauthier: 8483445,
  carlsson: 8484153,
  lacombe: 8481605,
  verhaeghe: 8477409,
  bennett: 8477935,
  matthewTkachuk: 8479314,
  granlund: 8475798,
  celebrini: 8484801,
  blackwell: 8476278,
};

function overtimeGame(overrides: Partial<ScoreGame> = {}): ScoreGame {
  const game = parseScoreGames(scoreFinal).find((g) => g.gameId === OT_GAME_ID);
  if (!game) throw new Error('fixture game missing');
  return { ...game, ...overrides };
}

/** The OT game as if only its first `goalCount` goals had happened. */
function liveOvertime(goalCount: number) {
  const goals = pbpOvertime.plays.filter((p: any) => p.typeDescKey === 'goal').slice(0, goalCount);
  const plays = pbpOvertime.plays.filter(
    (p: any) => p.typeDescKey !== 'game-end' && (p.typeDescKey !== 'goal' || goals.includes(p)),
  );
  const game = overtimeGame({ gameState: 'LIVE', phase: 'live', goalCount });
  return { game, pbp: parsePlayByPlay({ ...pbpOvertime, gameState: 'LIVE', plays })! };
}

function memory(overrides: Partial<GameMemory> = {}): GameMemory {
  return { gameId: OT_GAME_ID, gameDate: GAME_DAY, gameState: 'PRE', scratchIds: [], goalEventIds: [], ...overrides };
}

function device(token: string, playerIds: number[], prefs = { scratches: true, goals: true }): AlertDevice {
  return { token, playerIds, prefs };
}

describe('nhlGameDay', () => {
  it.each([
    ['2026-10-06T03:59:00Z', '2026-10-05'], // 11:59 PM EDT
    ['2026-10-06T04:30:00Z', '2026-10-05'], // 12:30 AM EDT: late games still belong to last night
    ['2026-10-06T09:59:00Z', '2026-10-05'], // 5:59 AM EDT
    ['2026-10-06T10:00:00Z', '2026-10-06'], // 6:00 AM EDT rolls over
    ['2026-12-01T10:59:00Z', '2026-11-30'], // 5:59 AM EST
    ['2026-12-01T11:00:00Z', '2026-12-01'], // 6:00 AM EST
    ['2027-01-01T05:30:00Z', '2026-12-31'], // 12:30 AM EST on New Year's Day
    ['2026-11-01T10:59:00Z', '2026-10-31'], // 5:59 AM EST on the fall-back Sunday
    ['2026-11-01T11:00:00Z', '2026-11-01'],
    ['2027-03-14T09:59:00Z', '2027-03-13'], // 5:59 AM EDT on the spring-forward Sunday
    ['2027-03-14T10:00:00Z', '2027-03-14'],
  ])('%s is game day %s', (iso, day) => {
    expect(nhlGameDay(new Date(iso))).toBe(day);
  });
});

describe('parseScoreGames', () => {
  it('reads real final games, counting goals without shootout attempts', () => {
    const games = parseScoreGames(scoreFinal);
    expect(games.map((g) => g.gameId)).toEqual([2026020035, 2026020036, 2026020037, 2026020038, 2026020039]);
    expect(games.map((g) => g.goalCount)).toEqual([5, 6, 5, 7, 5]);
    expect(games.every((g) => g.phase === 'final' && g.scheduled)).toBe(true);
    expect(overtimeGame()).toMatchObject({ awayAbbrev: 'FLA', homeAbbrev: 'ANA', startMs: OT_START, gameDate: GAME_DAY, gameState: 'OFF' });
  });

  it('reads future games (no goals or scores in the feed yet)', () => {
    const games = parseScoreGames(scoreFuture);
    expect(games.map((g) => [g.gameId, g.phase, g.goalCount])).toEqual([
      [2026020044, 'pregame', null],
      [2026020050, 'pregame', null],
      [2026020051, 'pregame', null],
    ]);
    expect(games[2].startMs).toBe(Date.parse('2026-10-07T01:40:00Z'));
  });

  it('leaves the shootout winner out of the goal count', () => {
    const [game] = parseScoreGames(scoreShootout);
    expect(game.goalCount).toBe(4); // 2-2 after OT; the feed lists the SO winner as a fifth "goal"
  });

  it('falls back to team scores, skips postponed games and junk', () => {
    const games = parseScoreGames({
      games: [
        { id: 1, gameState: 'LIVE', awayTeam: { abbrev: 'EDM', score: 0 }, homeTeam: { abbrev: 'LAK', score: 0 } },
        { id: 2, gameState: 'FUT', gameScheduleState: 'PPD' },
        { gameState: 'LIVE' },
        null,
      ],
    });
    expect(games).toHaveLength(2);
    expect(games[0]).toMatchObject({ phase: 'live', goalCount: 0, startMs: null });
    expect(games[1].scheduled).toBe(false);
    expect(parseScoreGames(null)).toEqual([]);
    expect(parseScoreGames({ games: 'nope' })).toEqual([]);
  });
});

describe('parseScratches', () => {
  it('reads both teams from a real right-rail', () => {
    const scratches = parseScratches(rightRail);
    expect(scratches.map((s) => s.playerId)).toEqual([8481517, 8482700, 8484801, 8476278, 8478476]);
    expect(scratches[2]).toEqual({ playerId: PLAYERS.celebrini, firstName: 'Macklin', lastName: 'Celebrini' });
  });

  it('is empty before the report posts or on junk', () => {
    expect(parseScratches(rightRailFuture)).toEqual([]);
    expect(parseScratches({ gameInfo: { awayTeam: { scratches: [{ id: 'x' }, { id: 0 }, {}] } } })).toEqual([]);
    expect(parseScratches(undefined)).toEqual([]);
  });
});

describe('parsePlayByPlay', () => {
  it('reads goals, assists, score and clock from a real OT game', () => {
    const pbp = parsePlayByPlay(pbpOvertime)!;
    expect(pbp.awayAbbrev).toBe('FLA');
    expect(pbp.homeAbbrev).toBe('ANA');
    expect(pbp.goals.map((g) => g.eventId)).toEqual([382, 155, 445, 1056, 1128]); // not chronological ids
    expect(pbp.goals[2]).toEqual({
      eventId: 445,
      scorerId: PLAYERS.gauthier,
      scorerSeasonGoals: 2,
      assistIds: [8484762, PLAYERS.carlsson],
      awayScore: 1,
      homeScore: 2,
      periodLabel: 'P2',
      clock: '0:47',
    });
    expect(pbp.goals[3].assistIds).toEqual([8474189]); // one assist
    expect(pbp.goals[4]).toMatchObject({ scorerId: PLAYERS.granlund, periodLabel: 'OT', clock: '4:14', awayScore: 2, homeScore: 3 });
    expect(pbp.names.get(PLAYERS.gauthier)).toEqual({ firstName: 'Cutter', lastName: 'Gauthier' });
  });

  it('ignores shootout attempts', () => {
    const pbp = parsePlayByPlay(pbpShootout)!;
    expect(pbp.goals.map((g) => g.eventId)).toEqual([325, 752, 800, 1011]);
  });

  it('returns null without plays', () => {
    expect(parsePlayByPlay({})).toBeNull();
    expect(parsePlayByPlay('oops')).toBeNull();
  });

  it('labels periods and trims clocks', () => {
    expect(periodLabel({ number: 2, periodType: 'REG', maxRegulationPeriods: 3 })).toBe('P2');
    expect(periodLabel({ number: 4, periodType: 'OT', maxRegulationPeriods: 3 })).toBe('OT');
    expect(periodLabel({ number: 6, periodType: 'OT', maxRegulationPeriods: 3 })).toBe('3OT');
    expect(periodLabel({ number: 5, periodType: 'SO' })).toBe('SO');
    expect(formatClock('04:14')).toBe('4:14');
    expect(formatClock('10:15')).toBe('10:15');
  });
});

describe('planGame', () => {
  const [future] = parseScoreGames(scoreFuture); // 2026020044, puck drop 23:00Z
  const futureStart = future.startMs!;

  it('reads scratches from 90 minutes before puck drop to 30 after', () => {
    expect(planGame(future, undefined, futureStart - minutes(91))).toBeNull();
    expect(planGame(future, undefined, futureStart - minutes(90))).toMatchObject({ readScratches: true, readGoals: false, silent: false });
    expect(planGame({ ...future, gameState: 'PRE', phase: 'pregame' }, undefined, futureStart + minutes(5))).toMatchObject({ readScratches: true });
    const live = { ...future, gameState: 'LIVE', phase: 'live' as const, goalCount: 0 };
    expect(planGame(live, memory(), futureStart + minutes(30))!.readScratches).toBe(true);
    expect(planGame(live, memory(), futureStart + minutes(31))!.readScratches).toBe(false);
  });

  it('seeds a game first seen live, and skips play-by-play while the goal count matches', () => {
    const { game } = liveOvertime(2);
    expect(planGame(game, undefined, OT_START + minutes(40))).toMatchObject({ readGoals: true, silent: true });
    expect(planGame(game, memory({ gameState: 'LIVE', goalEventIds: [382, 155] }), OT_START + minutes(40))).toMatchObject({ readGoals: false, silent: false });
    expect(planGame(game, memory({ gameState: 'LIVE', goalEventIds: [382] }), OT_START + minutes(40))).toMatchObject({ readGoals: true, silent: false });
    expect(planGame({ ...game, goalCount: null }, memory({ gameState: 'LIVE', goalEventIds: [382, 155] }), OT_START + minutes(40))!.readGoals).toBe(true);
  });

  it('reconciles a game that went final between polls, once', () => {
    const final = overtimeGame();
    const now = OT_START + minutes(200);
    expect(planGame(final, memory({ gameState: 'LIVE', goalEventIds: [382, 155, 445, 1056] }), now)).toMatchObject({ readGoals: true, silent: false });
    expect(planGame(final, memory({ gameState: 'LIVE', goalEventIds: [382, 155, 445, 1056, 1128] }), now)).toMatchObject({ readGoals: false, silent: false });
    expect(planGame(final, memory({ gameState: 'OFF' }), now)).toBeNull();
    expect(planGame(final, memory({ gameState: 'PRE' }), now)).toMatchObject({ readGoals: false, silent: true });
    expect(planGame(final, undefined, now)).toMatchObject({ readGoals: false, readScratches: false, silent: true });
    expect(planGame(final, memory({ gameState: 'LIVE' }), OT_START + minutes(6 * 60 + 1))).toBeNull();
  });

  it('ignores postponed games and only calls live, upcoming or just-final games candidates', () => {
    const [future2] = parseScoreGames(scoreFuture);
    expect(isCandidate({ ...future2, scheduled: false }, future2.startMs! - minutes(10))).toBe(false);
    expect(parseScoreGames(scoreFinal).some((g) => isCandidate(g, Date.parse('2026-10-05T12:00:00Z')))).toBe(false);
    expect(isCandidate({ ...future2, phase: 'other', gameState: 'TBD' }, future2.startMs!)).toBe(false);
  });
});

describe('evaluateGame', () => {
  const now = OT_START + minutes(40);

  it('announces scratches once, before puck drop', () => {
    const [future] = parseScoreGames(scoreFuture);
    const plan = planGame(future, undefined, future.startMs! - minutes(60))!;
    const first = evaluateGame(plan, '2026-10-06', parseScratches(rightRail), undefined);
    expect(first.events.map((e) => e.key)).toEqual([
      'scratch:2026020044:8481517',
      'scratch:2026020044:8482700',
      'scratch:2026020044:8484801',
      'scratch:2026020044:8476278',
      'scratch:2026020044:8478476',
    ]);
    expect(first.memory).toMatchObject({ gameId: 2026020044, gameDate: '2026-10-06', gameState: 'FUT', goalEventIds: [] });
    const again = evaluateGame(planGame(future, first.memory!, future.startMs! - minutes(59))!, '2026-10-06', parseScratches(rightRail), undefined);
    expect(again).toEqual({ events: [], memory: null });
  });

  it('never announces goals from a game first seen live', () => {
    const { game, pbp } = liveOvertime(3);
    const result = evaluateGame(planGame(game, undefined, now)!, GAME_DAY, undefined, pbp);
    expect(result.events).toEqual([]);
    expect(result.memory).toMatchObject({ gameState: 'LIVE', goalEventIds: [382, 155, 445] });
  });

  it('announces only new goals, using a set of event ids', () => {
    const early = liveOvertime(2);
    const first = evaluateGame(planGame(early.game, memory(), now)!, GAME_DAY, undefined, early.pbp);
    expect(first.events.map((e) => e.key)).toEqual([`goal:${OT_GAME_ID}:382`, `goal:${OT_GAME_ID}:155`]);

    const late = liveOvertime(4);
    const second = evaluateGame(planGame(late.game, first.memory!, now)!, GAME_DAY, undefined, late.pbp);
    expect(second.events.map((e) => e.key)).toEqual([`goal:${OT_GAME_ID}:445`, `goal:${OT_GAME_ID}:1056`]);
    expect(second.memory!.goalEventIds).toEqual([382, 155, 445, 1056]);

    // The OT winner lands between polls and the game goes final: one last read catches it.
    const final = overtimeGame();
    const third = evaluateGame(planGame(final, second.memory!, OT_START + minutes(190))!, GAME_DAY, undefined, parsePlayByPlay(pbpOvertime)!);
    expect(third.events.map((e) => e.key)).toEqual([`goal:${OT_GAME_ID}:1128`]);
    expect(third.memory).toMatchObject({ gameState: 'OFF', goalEventIds: [382, 155, 445, 1056, 1128] });
    expect(planGame(final, third.memory!, OT_START + minutes(191))).toBeNull();
  });

  it('forgets a goal taken back on review, so the counts line up again', () => {
    const { game, pbp } = liveOvertime(2);
    const result = evaluateGame(planGame(game, memory({ gameState: 'LIVE', goalEventIds: [382, 155, 999] }), now)!, GAME_DAY, undefined, pbp);
    expect(result.events).toEqual([]);
    expect(result.memory!.goalEventIds).toEqual([382, 155]);
  });

  it('keeps what it knew when a read fails', () => {
    const { game } = liveOvertime(3);
    expect(evaluateGame(planGame(game, undefined, now)!, GAME_DAY, undefined, null)).toEqual({ events: [], memory: null });
    const known = memory({ gameState: 'LIVE', goalEventIds: [382] });
    expect(evaluateGame(planGame(game, known, now)!, GAME_DAY, undefined, null)).toEqual({ events: [], memory: null });
    const final = overtimeGame();
    const failedFinal = evaluateGame(planGame(final, known, OT_START + minutes(190))!, GAME_DAY, undefined, null);
    expect(failedFinal.memory).toBeNull(); // still LIVE in memory, so the next minute retries
  });

  it('records a state change even with nothing new', () => {
    const { game } = liveOvertime(0);
    const result = evaluateGame(planGame({ ...game, goalCount: 0 }, memory({ gameState: 'PRE' }), OT_START + minutes(45))!, GAME_DAY, undefined, undefined);
    expect(result).toEqual({ events: [], memory: memory({ gameState: 'LIVE' }) });
  });
});

describe('alert copy and matching', () => {
  const all = evaluateGame(planGame(liveOvertime(5).game, memory(), OT_START + minutes(40))!, GAME_DAY, undefined, parsePlayByPlay(pbpOvertime)!).events as GoalAlertEvent[];
  const byEvent = (eventId: number) => all.filter((e) => e.key === `goal:${OT_GAME_ID}:${eventId}`);

  it('titles my scorer by last name with the season tally', () => {
    const [alert] = buildAlerts(byEvent(445), [device('ExponentPushToken[a]', [PLAYERS.gauthier, PLAYERS.carlsson])]);
    expect(alert.message).toEqual({
      to: 'ExponentPushToken[a]',
      title: '\u{1F6A8} Gauthier scores (2)',
      body: 'FLA 1–2 ANA · P2 0:47 · assist: Carlsson',
      sound: 'default',
      ttl: ALERT_TTL_SECONDS,
      data: { kind: 'goal', gameId: OT_GAME_ID, playerId: PLAYERS.gauthier },
    });
    expect(alert.eventKey).toBe(`goal:${OT_GAME_ID}:445`);
  });

  it('uses "Goal: scorer" when only my assisters were on it, and disambiguates shared last names', () => {
    const [alert] = buildAlerts(byEvent(155), [device('ExpoPushToken[b]', [PLAYERS.bennett, PLAYERS.matthewTkachuk])]);
    expect(alert.message.title).toBe('\u{1F6A8} Goal: Carter Verhaeghe (1)');
    expect(alert.message.body).toBe('FLA 1–1 ANA · P1 17:09 · assists: Bennett, M. Tkachuk');
    expect(alert.message.data.playerId).toBe(PLAYERS.bennett);
  });

  it('formats an overtime winner', () => {
    const [alert] = buildAlerts(byEvent(1128), [device('ExponentPushToken[c]', [PLAYERS.granlund])]);
    expect(alert.message.title).toBe('\u{1F6A8} Granlund scores (1)');
    expect(alert.message.body).toBe('FLA 2–3 ANA · OT 4:14');
  });

  it('respects prefs and only matches followed players, one push per device and event', () => {
    const devices = [
      device('ExponentPushToken[goals-off]', [PLAYERS.gauthier], { scratches: true, goals: false }),
      device('ExponentPushToken[nobody]', [1, 2, 3]),
      device('ExponentPushToken[both]', [PLAYERS.gauthier, PLAYERS.carlsson, PLAYERS.lacombe]),
    ];
    const alerts = buildAlerts(all, devices);
    expect(alerts.every((a) => a.token === 'ExponentPushToken[both]')).toBe(true);
    // 382 (Gauthier goal, LaCombe + Carlsson assists), 445 (Gauthier goal), 1128 (Carlsson + Gauthier assists)
    expect(alerts.map((a) => a.eventKey)).toEqual([`goal:${OT_GAME_ID}:382`, `goal:${OT_GAME_ID}:445`, `goal:${OT_GAME_ID}:1128`]);
    expect(alerts[0].message.body).toBe('FLA 0–1 ANA · P1 16:18 · assists: LaCombe, Carlsson');
  });

  it('writes scratch copy, softer once the game has started', () => {
    const [future] = parseScoreGames(scoreFuture);
    const pregame = evaluateGame(planGame(future, undefined, future.startMs! - minutes(60))!, '2026-10-06', parseScratches(rightRail), undefined).events;
    const devices = [device('ExponentPushToken[d]', [PLAYERS.celebrini]), device('ExponentPushToken[e]', [PLAYERS.celebrini], { scratches: false, goals: true })];
    const [alert, ...rest] = buildAlerts(pregame, devices);
    expect(rest).toEqual([]);
    expect(alert.message).toMatchObject({
      title: 'Scratched: Macklin Celebrini',
      body: 'Out tonight per the NHL game report. Check your lineup before lock.',
      data: { kind: 'scratch', gameId: 2026020044, playerId: PLAYERS.celebrini },
    });
    const live = { ...future, gameState: 'LIVE', phase: 'live' as const, goalCount: 0 };
    const started = evaluateGame(planGame(live, memory({ gameId: future.gameId }), future.startMs! + minutes(5))!, '2026-10-06', parseScratches(rightRail), undefined).events;
    expect(buildAlerts(started, devices)[0].message.body).toBe('Out tonight per the NHL game report.');
  });

  it('lists every player an event mentions for the device query', () => {
    const events: AlertEvent[] = [...byEvent(445), { kind: 'scratch', key: 'scratch:1:5', gameId: 1, playerId: 5, fullName: 'X Y', gameStarted: false }];
    const numeric = (ids: number[]) => [...ids].sort((a, b) => a - b);
    expect(numeric(eventPlayerIds(events))).toEqual(numeric([5, PLAYERS.carlsson, 8484762, PLAYERS.gauthier]));
  });
});

describe('rows, Expo and plumbing', () => {
  it('maps database rows', () => {
    expect(deviceFromRow({ expo_push_token: 'ExpoPushToken[x]', player_ids: [1, 2], prefs: { scratches: true } })).toEqual({
      token: 'ExpoPushToken[x]', playerIds: [1, 2], prefs: { scratches: true, goals: false },
    });
    expect(deviceFromRow({})).toBeNull();
    const row = { game_id: '2026020037', game_date: '2026-10-04', game_state: 'live', scratch_ids: [1], goal_event_ids: [382, 155] };
    const mem = memoryFromRow(row)!;
    expect(mem).toEqual({ gameId: OT_GAME_ID, gameDate: '2026-10-04', gameState: 'LIVE', scratchIds: [1], goalEventIds: [382, 155] });
    expect(memoryToRow(mem, '2026-10-05T00:40:00.000Z')).toEqual({
      game_id: OT_GAME_ID, game_date: '2026-10-04', game_state: 'LIVE', scratch_ids: [1], goal_event_ids: [382, 155], updated_at: '2026-10-05T00:40:00.000Z',
    });
  });

  it('reads Expo tickets and finds dead tokens', () => {
    const messages = [{ to: 'ExpoPushToken[a]' }, { to: 'ExpoPushToken[b]' }, { to: 'ExpoPushToken[c]' }, { to: 'ExpoPushToken[d]' }];
    const result = readExpoTickets(messages, {
      data: [
        { status: 'ok', id: '1' },
        { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered', expoPushToken: 'ExpoPushToken[b]' } },
        { status: 'error', message: 'slow down', details: { error: 'MessageRateExceeded' } },
        { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
      ],
    });
    expect(result).toEqual({ ok: 1, failed: 3, deadTokens: ['ExpoPushToken[b]', 'ExpoPushToken[d]'] });
    expect(readExpoTickets(messages, { errors: [{ code: 'INTERNAL' }] })).toEqual({ ok: 0, failed: 4, deadTokens: [] });
  });

  it('chunks to Expo-sized batches', () => {
    expect(chunk(Array.from({ length: 250 }, (_, i) => i), 100).map((c) => c.length)).toEqual([100, 100, 50]);
    expect(chunk([], 100)).toEqual([]);
  });

  it('runs at most N tasks at once and keeps order', async () => {
    let running = 0;
    let peak = 0;
    const results = await mapLimit([5, 1, 4, 2, 3, 0], 4, async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, n));
      running -= 1;
      return n * 10;
    });
    expect(results).toEqual([50, 10, 40, 20, 30, 0]);
    expect(peak).toBe(4);
    expect(await mapLimit([], 4, async () => 1)).toEqual([]);
  });

  it('reads the role claim from a bearer token', () => {
    const jwt = (claims: object) =>
      `header.${Buffer.from(JSON.stringify(claims)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.sig`;
    expect(bearerRole(`Bearer ${jwt({ role: 'service_role', iss: 'supabase' })}`)).toBe('service_role');
    expect(bearerRole(`bearer ${jwt({ role: 'anon' })}`)).toBe('anon');
    expect(bearerRole('Bearer not-a-jwt')).toBeNull();
    expect(bearerRole('Bearer a.!!!.c')).toBeNull();
    expect(bearerRole(null)).toBeNull();
  });
});
