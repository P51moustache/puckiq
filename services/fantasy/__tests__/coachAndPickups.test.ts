import { buildCoachMoves, visibleMoves, type PlayerStatus } from '../coach';
import { buildSkaterForm, type PlayerForm } from '../form';
import { filterPickups, rankPickups } from '../pickups';
import { buildWeekPlan } from '../weekPlan';
import { compareWeeks } from '../matchup';
import { busyNight, game, player, week } from './fixtures';
import type { LineupSlots } from '../../../types/fantasy';
import type { SkaterLine } from '../../nhl/stats';

const MON = '2026-10-12';
const TODAY = '2026-10-12';
const slots: LineupSlots = { C: 1, LW: 0, RW: 0, F: 0, D: 1, UTIL: 0, G: 1 };

function formWithValue(id: number, value: number, isGoalie = false): PlayerForm {
  return {
    ...buildSkaterForm(id, {}),
    isGoalie,
    value,
    startShare: isGoalie ? 0.6 : 1,
  };
}

function line(id: number, gp: number, points: number): SkaterLine {
  return {
    playerId: id, name: `P${id}`, position: 'C', team: 'NSH', gp, goals: 0, assists: points, points,
    ppp: 0, shots: 0, hits: 0, blocks: 0, plusMinus: 0, toiPerGame: 900,
  };
}

const roster = [
  player(8470001, 'Connor Star', 'EDM', 'C'),
  player(8470002, 'Depth Center', 'TOR', 'C'),
  player(8470003, 'Scratch Dman', 'EDM', 'D'),
  player(8470004, 'Starter Goalie', 'BOS', 'G'),
  player(8470006, 'Off Winger', 'SEA', 'R'),
];

const schedule = week(MON, {
  '2026-10-12': [game('2026-10-12', 'EDM', 'TOR'), game('2026-10-12', 'BOS', 'NSH'), ...busyNight('2026-10-12')],
  '2026-10-14': [game('2026-10-14', 'NSH', 'CHI'), ...busyNight('2026-10-14')],
});

const forms = new Map<number, PlayerForm>([
  [8470001, formWithValue(8470001, 3)],
  [8470002, formWithValue(8470002, 1)],
  [8470003, formWithValue(8470003, 1.5)],
  [8470004, formWithValue(8470004, 4, true)],
  [8470006, formWithValue(8470006, 2)],
]);
const values = new Map([...forms].map(([id, form]) => [id, form.value]));
const plan = buildWeekPlan({ schedule, players: roster, slots, values, today: TODAY });

describe('buildCoachMoves', () => {
  const day = plan.days[0];
  const games = Object.fromEntries(roster.map((p) => [p.playerId, plan.players[p.playerId]?.byDate[TODAY]]));
  const statuses = new Map<number, PlayerStatus>([
    [8470003, { playerId: 8470003, signal: 'scratch', confidence: 'confirmed', note: null }],
  ]);
  const moves = buildCoachMoves({ day, players: roster, games, statuses, forms });

  it('leads with the confirmed scratch', () => {
    expect(moves[0]).toMatchObject({ kind: 'scratch', title: 'Bench Scratch Dman' });
  });

  it('sits the lower-value centre on overflow and names who blocks him', () => {
    const overflow = moves.find((move) => move.kind === 'overflow');
    expect(overflow?.title).toBe('Sit Depth Center');
    expect(overflow?.detail).toContain('Star');
  });

  it('never claims a goalie starter and lists players with no game', () => {
    expect(moves.find((move) => move.kind === 'goalie')?.detail).toContain('~60%');
    expect(moves.find((move) => move.kind === 'off')?.detail).toContain('Off Winger');
  });

  it('shows free users only the first move', () => {
    expect(visibleMoves(moves, false)).toHaveLength(1);
    expect(visibleMoves(moves, true)).toHaveLength(moves.length);
  });
});

describe('rankPickups', () => {
  const candidates = [
    { playerId: 9000001, name: 'Nash Center', team: 'NSH', position: 'C', form: buildSkaterForm(9000001, { current: line(9000001, 20, 20) }) },
    { playerId: 9000002, name: 'Idle Center', team: 'XXX', position: 'C', form: buildSkaterForm(9000002, { current: line(9000002, 20, 40) }) },
    { playerId: 8470001, name: 'Connor Star', team: 'EDM', position: 'C', form: buildSkaterForm(8470001, { current: line(8470001, 20, 60) }) },
  ];
  const rows = rankPickups({ schedule, plan, roster, slots, values, candidates, today: TODAY });

  it('skips rostered players and players with no games left', () => {
    expect(rows.map((row) => row.playerId)).toEqual([9000001]);
  });

  it('counts nights he would start, including empty-slot fills', () => {
    const [row] = rows;
    expect(row.remainingGames).toBe(2);
    // Monday: C slot held by a 3.0 player, candidate is 2.0/G → not usable. Wednesday: C slot empty.
    expect(row.days.map((day) => [day.dayAbbrev, day.usable, day.fillsEmpty])).toEqual([
      ['MON', false, false],
      ['WED', true, true],
    ]);
    expect(row.gain).toBeCloseTo(row.form.value);
    expect(filterPickups(rows, 'D')).toEqual([]);
    expect(filterPickups(rows, 'F')).toHaveLength(1);
  });
});

describe('compareWeeks', () => {
  it('calls the matchup from remaining starts and value', () => {
    const theirs = buildWeekPlan({ schedule, players: roster.slice(0, 1), slots, values, today: TODAY });
    const summary = compareWeeks(plan, theirs);
    expect(summary.startEdge).toBeGreaterThan(0);
    expect(summary.verdict).toBe('ahead');
  });
});

describe('likelyRosteredIds', () => {
  const { likelyRosteredIds } = require('../pickups') as typeof import('../pickups');
  const skater = (id: number, rate: number) => ({
    playerId: id, name: `S${id}`, team: 'AAA', position: 'C',
    form: { ...buildSkaterForm(id, {}), seasonRate: rate, value: rate },
  });
  const goalie = (id: number, share: number) => ({
    playerId: id, name: `G${id}`, team: 'AAA', position: 'G',
    form: { ...buildSkaterForm(id, {}), isGoalie: true, startShare: share, seasonRate: 5, value: 5 * share },
  });

  it('hides the top skaters and starting goalies a league of this size would own', () => {
    const tiny: LineupSlots = { C: 1, LW: 0, RW: 0, F: 0, D: 0, UTIL: 0, G: 1 };
    // 2 teams × (1 skater slot + 3 bench) = 8 skaters; 2 × (1 + 1) = 4 goalies.
    const pool = [
      ...Array.from({ length: 10 }, (_, i) => skater(100 + i, 10 - i)),
      ...Array.from({ length: 6 }, (_, i) => goalie(200 + i, 0.9 - i * 0.1)),
    ];
    const owned = likelyRosteredIds(pool, 2, tiny);
    expect(owned.has(100)).toBe(true);
    expect(owned.has(107)).toBe(true);
    expect(owned.has(108)).toBe(false);
    expect(owned.has(203)).toBe(true);
    expect(owned.has(204)).toBe(false);
  });
});
