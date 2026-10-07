import { buildNightScore, headlinePoints } from '../fantasy/nightScore';
import { hasRecap, hindsightText, performerLine, recapLeaders, recapWindowOpen } from '../fantasy/recap';
import { DEFAULT_SCORING } from '../fantasy/scoring';
import { createTeam } from '../teams';
import { buildLiveActivityState, buildWidgetSnapshot } from '../widgets/snapshot';
import type { GameLine } from '../nhl/gamecenter';
import type { NightData } from '../fantasy/loaders';
import type { NhlGame } from '../nhl/schedule';

const DATE = '2026-10-13';

function nhlGame(id: number, away: string, home: string, extra: Partial<NhlGame> = {}): NhlGame {
  return {
    id, date: DATE, gameType: 2, startTimeUTC: `${DATE}T23:00:00Z`, state: 'FUT', scheduleState: 'OK', home, away,
    homeScore: null, awayScore: null, period: null, clock: null, inIntermission: false, ...extra,
  };
}

function skater(playerId: number, stats: Partial<GameLine> = {}): GameLine {
  return {
    playerId, isGoalie: false, goals: 0, assists: 0, points: 0, shots: 0, hits: 0, blocks: 0, plusMinus: 0,
    powerPlayGoals: 0, pim: 0, toi: '18:00', saves: 0, shotsAgainst: 0, goalsAgainst: 0, ...stats,
  };
}

const team = createTeam({
  name: 'Top Shelf',
  players: [
    { playerId: 8478402, playerName: 'Connor McDavid', teamAbbrev: 'EDM', position: 'C', rosterPosition: 'BN' },
    { playerId: 8477492, playerName: 'Nathan MacKinnon', teamAbbrev: 'COL', position: 'C', rosterPosition: 'BN' },
    { playerId: 8480012, playerName: 'Cale Makar', teamAbbrev: 'COL', position: 'D', rosterPosition: 'BN', injuredReserve: true },
    { playerId: 8476453, playerName: 'Nikita Kucherov', teamAbbrev: 'TBL', position: 'R', rosterPosition: 'BN' },
  ],
});

function night(games: NhlGame[], lines: Array<[number, GameLine]> = []): NightData {
  const byTeam = new Map<string, NhlGame>();
  for (const game of games) {
    byTeam.set(game.home, game);
    byTeam.set(game.away, game);
  }
  const playerGames: NightData['playerGames'] = {};
  for (const player of team.players) {
    const game = byTeam.get(player.teamAbbrev);
    if (!game) continue;
    const isHome = game.home === player.teamAbbrev;
    playerGames[player.playerId] = {
      date: DATE, gameId: game.id, opponent: isHome ? game.away : game.home, isHome,
      startTimeUTC: game.startTimeUTC, state: game.state, offNight: false,
    };
  }
  return {
    date: DATE, games, playerGames, statuses: new Map(), liveLines: new Map(lines), news: [], nextDate: null, preseasonGames: 0,
  };
}

function scoreOf(data: NightData) {
  return buildNightScore({
    players: team.players, playerGames: data.playerGames, games: data.games, lines: data.liveLines,
    scoring: DEFAULT_SCORING, slots: team.slots, day: null,
  });
}

describe('recap window', () => {
  it('opens at the 6 AM game-day rollover and closes at noon Eastern', () => {
    expect(recapWindowOpen(new Date('2026-10-14T09:59:00Z'))).toBe(false); // 5:59 AM ET
    expect(recapWindowOpen(new Date('2026-10-14T10:00:00Z'))).toBe(true); // 6:00 AM ET
    expect(recapWindowOpen(new Date('2026-10-14T15:59:00Z'))).toBe(true); // 11:59 AM ET
    expect(recapWindowOpen(new Date('2026-10-14T16:00:00Z'))).toBe(false); // noon ET
  });
});

describe('recap content', () => {
  const finals = night(
    [
      nhlGame(1, 'EDM', 'LAK', { state: 'OFF', homeScore: 1, awayScore: 4 }),
      nhlGame(2, 'COL', 'MIN', { state: 'OFF', homeScore: 2, awayScore: 3 }),
      nhlGame(3, 'TBL', 'FLA', { state: 'OFF', homeScore: 5, awayScore: 2 }),
    ],
    [
      [8478402, skater(8478402, { goals: 3, shots: 6 })], // 12
      [8477492, skater(8477492, { assists: 1, shots: 2 })], // 3
      [8476453, skater(8476453)], // 0
    ],
  );
  const score = scoreOf(finals);

  it('needs a finished night with box-score lines', () => {
    expect(hasRecap(score)).toBe(true);
    expect(hasRecap(scoreOf(night([nhlGame(1, 'EDM', 'LAK')])))).toBe(false);
    expect(hasRecap(null)).toBe(false);
  });

  it('leads with everyone’s points when there is no lineup to split by', () => {
    expect(headlinePoints(score, true)).toBe(15);
    expect(headlinePoints(score, false)).toBe(15);
  });

  it('names the leaders who actually scored, with the big-night label', () => {
    const leaders = recapLeaders(score);
    expect(leaders.map((row) => row.playerId)).toEqual([8478402, 8477492]);
    const line = performerLine(leaders[0], team.players[0], finals.liveLines.get(8478402));
    expect(line).toBe('McDavid · 3G · 6 SOG · HAT TRICK');
    expect(hindsightText(score)).toBeNull();
  });
});

describe('widget snapshot and Live Activity state', () => {
  const now = new Date('2026-10-13T22:00:00Z');

  it('lists who plays in puck-drop order with the first lock, skipping IR', () => {
    const data = night([
      nhlGame(1, 'EDM', 'LAK', { startTimeUTC: `${DATE}T02:30:00Z` }),
      nhlGame(2, 'COL', 'MIN', { startTimeUTC: `${DATE}T00:00:00Z` }),
    ]);
    const snapshot = buildWidgetSnapshot({ team, night: data, score: scoreOf(data), isPro: false, now });
    expect(snapshot).toMatchObject({ teamName: 'Top Shelf', date: DATE, playing: 2, total: 3, live: null });
    expect(snapshot.firstPuckUTC).toBe(`${DATE}T00:00:00Z`);
    expect(snapshot.players.map((row) => row.name)).toEqual(['Nathan MacKinnon', 'Connor McDavid']);
    expect(snapshot.players[0]).toMatchObject({ team: 'COL', opponent: 'MIN', home: false });
    expect(buildLiveActivityState({ team, night: data, score: scoreOf(data), isPro: false })).toBeNull();
  });

  it('switches to points, counts and the top performer once games start', () => {
    const data = night(
      [
        nhlGame(1, 'EDM', 'LAK', { state: 'LIVE', period: 2, clock: '10:15' }),
        nhlGame(2, 'COL', 'MIN'),
        nhlGame(3, 'TBL', 'FLA', { state: 'FINAL', homeScore: 1, awayScore: 3 }),
      ],
      [[8478402, skater(8478402, { goals: 1, assists: 1 })], [8476453, skater(8476453, { shots: 2 })]],
    );
    const score = scoreOf(data);
    const snapshot = buildWidgetSnapshot({ team, night: data, score, isPro: true, now });
    expect(snapshot.firstPuckUTC).toBe(`${DATE}T23:00:00Z`);
    expect(snapshot.live).toEqual({ points: 6, live: 1, final: 1, upcoming: 1, top: { name: 'McDavid', line: '1G · 1A · 0 SOG' } });
    expect(buildLiveActivityState({ team, night: data, score, isPro: true })).toEqual({
      points: 6, live: 1, final: 1, upcoming: 1, topName: 'McDavid', topLine: '1G · 1A · 0 SOG', clock: 'P2 10:15',
    });
  });
});
