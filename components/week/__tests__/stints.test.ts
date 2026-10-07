import type { PlayerWeek } from '../../../services/fantasy/weekPlan';
import { busyNight, game, player, week } from '../../../services/fantasy/__tests__/fixtures';
import {
  barKind,
  barLabel,
  dayTotals,
  nowColumn,
  rowAccessibilityLabel,
  scheduleRows,
  stintCells,
  type StintCell,
} from '../stints';
import {
  DRAISAITL,
  MAKAR,
  MATTHEWS,
  MCDAVID,
  MONDAY,
  ON_IR,
  ROSTER,
  SHESTERKIN,
  TODAY,
  nextWeekSchedule,
  planFor,
} from './support/weekFixtures';

const plan = planFor(ROSTER);
const kinds = (cells: StintCell[]) => cells.map((cell) => cell.kind);
const joins = (cells: StintCell[]) => cells.map((cell) => `${cell.joinsPrev ? '<' : '.'}${cell.joinsNext ? '>' : '.'}`);

describe('stintCells — Pro', () => {
  it('marks games that count, games lost to the bench, and days off', () => {
    expect(kinds(stintCells(plan, MCDAVID, true))).toEqual(['count', 'count', 'none', 'none', 'none', 'count', 'none']);
    expect(kinds(stintCells(plan, DRAISAITL, true))).toEqual(['bench', 'bench', 'none', 'none', 'none', 'bench', 'none']);
    expect(kinds(stintCells(plan, MATTHEWS, true))).toEqual(['bench', 'none', 'none', 'count', 'none', 'bench', 'none']);
  });

  it('joins back-to-back bars of the same kind into one stint', () => {
    expect(joins(stintCells(plan, MCDAVID, true))).toEqual(['.>', '<.', '..', '..', '..', '..', '..']);
    expect(joins(stintCells(plan, DRAISAITL, true))).toEqual(['.>', '<.', '..', '..', '..', '..', '..']);
  });

  it('keeps a counting game and a bench game on consecutive days as separate stints', () => {
    // Friday Matthews plays alone and counts; Saturday Draisaitl takes the only C slot.
    const schedule = week(MONDAY, {
      '2026-10-16': [game('2026-10-16', 'TOR', 'OTT'), ...busyNight('2026-10-16')],
      '2026-10-17': [game('2026-10-17', 'TOR', 'MTL'), game('2026-10-17', 'EDM', 'CGY'), ...busyNight('2026-10-17')],
    });
    const twoCentres = [player(MATTHEWS, 'Auston Matthews', 'TOR', 'C'), player(DRAISAITL, 'Leon Draisaitl', 'EDM', 'C')];
    const cells = stintCells(planFor(twoCentres, schedule), MATTHEWS, true);
    expect(kinds(cells).slice(4, 6)).toEqual(['count', 'bench']);
    expect(joins(cells).slice(4, 6)).toEqual(['..', '..']);
  });

  it('carries the opponent, home or away, and the day flags', () => {
    const [monday, tuesday, wednesday] = stintCells(plan, MCDAVID, true);
    expect(monday).toMatchObject({ date: '2026-10-12', opponent: 'TOR', isHome: false, past: true, today: false, offNight: false });
    expect(tuesday).toMatchObject({ opponent: 'VAN', isHome: true, past: true, offNight: true });
    expect(wednesday).toMatchObject({ date: TODAY, opponent: null, past: false, today: true });
  });
});

describe('stintCells — free', () => {
  it('shows every game as a plain bar, with no count or bench call', () => {
    expect(kinds(stintCells(plan, DRAISAITL, false))).toEqual(['game', 'game', 'none', 'none', 'none', 'game', 'none']);
    expect(kinds(stintCells(plan, MATTHEWS, false))).toEqual(['game', 'none', 'none', 'game', 'none', 'game', 'none']);
  });

  it('still joins back-to-backs', () => {
    expect(joins(stintCells(plan, MCDAVID, false)).slice(0, 2)).toEqual(['.>', '<.']);
  });

  it('gives a player without a plan an empty strip', () => {
    expect(kinds(stintCells(plan, ON_IR, false))).toEqual(Array(7).fill('none'));
  });
});

describe('barKind', () => {
  const monday = plan.days[0];
  it('is none without a game, whatever the tier', () => {
    expect(barKind(monday, MAKAR, false, true)).toBe('none');
    expect(barKind(monday, MAKAR, false, false)).toBe('none');
  });
  it('splits count from bench only for Pro', () => {
    expect(barKind(monday, MCDAVID, true, true)).toBe('count');
    expect(barKind(monday, DRAISAITL, true, true)).toBe('bench');
    expect(barKind(monday, DRAISAITL, true, false)).toBe('game');
  });
});

describe('nowColumn', () => {
  it('is today’s column in the current week', () => {
    expect(nowColumn(plan)).toBe(2);
  });
  it('is null for next week', () => {
    expect(nowColumn(planFor(ROSTER, nextWeekSchedule()))).toBeNull();
  });
});

describe('barLabel', () => {
  const [monday, tuesday, wednesday] = stintCells(plan, MCDAVID, true);
  it('is the opponent on phones', () => {
    expect(barLabel(monday, false)).toBe('TOR');
  });
  it('says home or away when the bar is long', () => {
    expect(barLabel(monday, true)).toBe('@ TOR');
    expect(barLabel(tuesday, true)).toBe('vs VAN');
  });
  it('is empty without a game', () => {
    expect(barLabel(wednesday, true)).toBe('');
  });
});

describe('dayTotals', () => {
  it('counts who plays and the empty slots', () => {
    expect(dayTotals(plan.days[0])).toEqual({ playing: 3, empty: 2 });
    expect(dayTotals(plan.days[2])).toEqual({ playing: 2, empty: 1 });
  });
  it('is blank on a night with no NHL games', () => {
    expect(dayTotals(plan.days[4])).toEqual({ playing: null, empty: null });
  });
});

describe('rowAccessibilityLabel', () => {
  const summary = (games: number, starts: number, benched: number) =>
    ({ playerId: MCDAVID, games, remainingGames: games, offNightGames: 0, starts, remainingStarts: starts, benched, byDate: {} }) as PlayerWeek;

  it('reads games, games that count and bench losses for Pro', () => {
    expect(rowAccessibilityLabel('Connor McDavid', summary(4, 3, 1), true)).toBe('Connor McDavid: 4 games, 3 count, 1 on the bench');
    expect(rowAccessibilityLabel('Auston Matthews', plan.players[MATTHEWS], true)).toBe('Auston Matthews: 3 games, 1 counts, 2 on the bench');
    expect(rowAccessibilityLabel('Igor Shesterkin', plan.players[SHESTERKIN], true)).toBe('Igor Shesterkin: 2 games, 2 count');
  });

  it('reads only games for free', () => {
    expect(rowAccessibilityLabel('Auston Matthews', plan.players[MATTHEWS], false)).toBe('Auston Matthews: 3 games');
    expect(rowAccessibilityLabel('Solo', summary(1, 1, 0), false)).toBe('Solo: 1 game');
  });

  it('says when there are no games', () => {
    expect(rowAccessibilityLabel('Idle', undefined, true)).toBe('Idle: no games');
    expect(rowAccessibilityLabel('Idle', summary(0, 0, 0), true)).toBe('Idle: no games');
  });
});

describe('scheduleRows', () => {
  it('lists linked, active players by games, then name', () => {
    expect(scheduleRows(ROSTER, plan).map((row) => row.playerId)).toEqual([MATTHEWS, MCDAVID, DRAISAITL, MAKAR, SHESTERKIN]);
  });

  it('leaves the roster order alone', () => {
    const before = ROSTER.map((row) => row.playerId);
    scheduleRows(ROSTER, plan);
    expect(ROSTER.map((row) => row.playerId)).toEqual(before);
  });
});
