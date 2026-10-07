import type { GameLine } from '../../nhl/gamecenter';
import { DEFAULT_SCORING } from '../../fantasy/scoring';
import { boardGameIds, buildRoomBoard } from '../board';
import { busyNight, game, line, makeRoom, member, ME, player, slotsOf, snapshotOf, week } from './fixtures';

const MON = '2026-10-12';
const TODAY = '2026-10-14';
const FRI = '2026-10-16';

// Me: two centres playing tonight for one C slot — an overflow night.
const lowIdCentre = player(8470001, 'Low-id Centre', 'EDM', 'C');
const hatTrickCentre = player(8470002, 'Hat-trick Centre', 'TOR', 'C');
const dman = player(8470003, 'Dman', 'EDM', 'D');
const goalie = player(8470004, 'Goalie', 'BOS', 'G');
const onIr = player(8470005, 'On IR', 'SEA', 'C', { injuredReserve: true });
// Ben: one of each, no overflow.
const benCentre = player(8470101, 'Ben Centre', 'VAN', 'C');
const benDman = player(8470102, 'Ben Dman', 'VAN', 'D');
const benGoalie = player(8470103, 'Ben Goalie', 'CHI', 'G');

const edmTor = game(TODAY, 'EDM', 'TOR');
const vanChi = game(TODAY, 'VAN', 'CHI');
const bosNyr = game(TODAY, 'BOS', 'NYR');
const seaLak = game(TODAY, 'SEA', 'LAK');
const schedule = week(MON, {
  [MON]: [game(MON, 'EDM', 'VAN'), ...busyNight(MON)], // already played: never "left"
  [TODAY]: [edmTor, vanChi, bosNyr, seaLak, ...busyNight(TODAY)],
  [FRI]: [game(FRI, 'VAN', 'EDM'), ...busyNight(FRI)],
});

const snapshot = snapshotOf(
  [
    member(ME, 'Zach Attack', [lowIdCentre, hatTrickCentre, dman, goalie, onIr]),
    member('u-ben', 'Ben’s Bombers', [benCentre, benDman, benGoalie]),
    member('u-sam', 'Sam’s Snipers', []),
  ],
  { room: makeRoom({ slots: slotsOf({ C: 1, D: 1, G: 1 }) }) },
);

const lines = new Map<number, GameLine>([
  [lowIdCentre.playerId, line(lowIdCentre.playerId, { goals: 1, shots: 2 })], // 4.0 — but no slot
  [hatTrickCentre.playerId, line(hatTrickCentre.playerId, { goals: 3, shots: 4 })], // 11.0
  [dman.playerId, line(dman.playerId, { assists: 1, shots: 1, hits: 2, blocks: 3 })], // 5.0
  [goalie.playerId, line(goalie.playerId, { isGoalie: true, saves: 30, goalsAgainst: 2 })], // 4.0, 9.0 with the win
  [onIr.playerId, line(onIr.playerId, { goals: 2 })], // IR: never counts
  [benCentre.playerId, line(benCentre.playerId, { assists: 1, shots: 3 })], // 3.5
  [benDman.playerId, line(benDman.playerId, { hits: 1 })], // 0.5
  [benGoalie.playerId, line(benGoalie.playerId, { isGoalie: true, saves: 25, goalsAgainst: 4 })], // 1.0, lost
]);

const finals = [
  { ...bosNyr, state: 'FINAL', awayScore: 3, homeScore: 2 },
  { ...vanChi, state: 'FINAL', awayScore: 4, homeScore: 1 },
];

describe('buildRoomBoard', () => {
  it('ranks by games that count left before puck drop, with no live points yet', () => {
    expect(buildRoomBoard({ snapshot, schedule, today: TODAY, scoring: DEFAULT_SCORING })).toEqual([
      { userId: 'u-ben', teamName: 'Ben’s Bombers', isMe: false, playingToday: 3, startersToday: 3, gamesThatCountLeft: 5, livePoints: null },
      { userId: ME, teamName: 'Zach Attack', isMe: true, playingToday: 4, startersToday: 3, gamesThatCountLeft: 5, livePoints: null },
      { userId: 'u-sam', teamName: 'Sam’s Snipers', isMe: false, playingToday: 0, startersToday: 0, gamesThatCountLeft: 0, livePoints: null },
    ]);
  });

  it('counts the best lineup from tonight’s players, so overflow never benches a hat trick', () => {
    const rows = buildRoomBoard({ snapshot, schedule, today: TODAY, lines, finals, scoring: DEFAULT_SCORING });
    expect(rows.map((row) => [row.userId, row.livePoints])).toEqual([
      [ME, 25], // 11 + 5 + 9: the 4-point centre had no slot
      ['u-ben', 5],
      ['u-sam', 0],
    ]);
  });

  it('only counts a goalie’s win once his game is final', () => {
    const live = [{ ...bosNyr, state: 'LIVE', awayScore: 3, homeScore: 2 }];
    expect(buildRoomBoard({ snapshot, schedule, today: TODAY, lines, finals: live, scoring: DEFAULT_SCORING })[0].livePoints).toBe(20);
    expect(buildRoomBoard({ snapshot, schedule, today: TODAY, lines, scoring: DEFAULT_SCORING })[0].livePoints).toBe(20);
  });

  it('uses the league’s scoring weights', () => {
    const goalsOnly = { ...DEFAULT_SCORING, shots: 0, hits: 0, blocks: 0, assists: 0, saves: 0, goalsAgainst: 0, wins: 0 };
    const rows = buildRoomBoard({ snapshot, schedule, today: TODAY, lines, finals, scoring: goalsOnly });
    expect(rows[0]).toMatchObject({ userId: ME, livePoints: 9 });
  });

  it('treats an empty set of lines as no live data', () => {
    const rows = buildRoomBoard({ snapshot, schedule, today: TODAY, lines: new Map(), scoring: DEFAULT_SCORING });
    expect(rows.every((row) => row.livePoints === null)).toBe(true);
  });

  it('works for a room of one', () => {
    const alone = snapshotOf([member(ME, 'Zach Attack', [dman])]);
    expect(buildRoomBoard({ snapshot: alone, schedule, today: TODAY, scoring: DEFAULT_SCORING })).toEqual([
      { userId: ME, teamName: 'Zach Attack', isMe: true, playingToday: 1, startersToday: 1, gamesThatCountLeft: 2, livePoints: null },
    ]);
  });
});

describe('boardGameIds', () => {
  it('lists only today’s games with a room player in them, IR excluded', () => {
    expect(boardGameIds(snapshot, schedule, TODAY)).toEqual([edmTor.id, vanChi.id, bosNyr.id].sort((a, b) => a - b));
  });

  it('is empty on a date outside the schedule', () => {
    expect(boardGameIds(snapshot, schedule, '2026-11-01')).toEqual([]);
  });
});
