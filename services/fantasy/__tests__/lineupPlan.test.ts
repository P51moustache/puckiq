import {
  buildPlannedDay,
  lineupLocked,
  lineupValue,
  sanitizeLineupChoices,
  saveBestLineup,
  setLineupChoice,
  starterChoiceError,
} from '../lineupPlan';
import { buildWeekPlan } from '../weekPlan';
import { createTeam, parseTeamsState, removePlayer } from '../../teams';
import { game, player, week } from './fixtures';
const date = '2026-10-13';
const players = [
  player(8478402, 'High center', 'EDM', 'C'),
  player(8481559, 'Low center', 'NJD', 'C'),
  player(8480069, 'Defense', 'COL', 'D'),
];
const slots = { C: 1, LW: 0, RW: 0, D: 1, F: 0, UTIL: 0, G: 0 };
const team = createTeam({ players, slots });
const values = new Map([
  [8478402, 10],
  [8481559, 3],
  [8480069, 5],
]);
const games = [game(date, 'EDM', 'NJD'), game(date, 'COL', 'BOS')];
const best = buildWeekPlan({
  players,
  slots,
  values,
  today: date,
  schedule: week('2026-10-12', { [date]: games }),
}).days.find((d) => d.date === date)!;

describe('saved lineup plans', () => {
  it('honors a lower-value pinned starter without changing the optimum recommendation', () => {
    const planned = buildPlannedDay(
      setLineupChoice(team, date, 8481559, 'start'),
      best,
      values,
    );
    expect(planned.starters.map((p) => p.playerId)).toEqual([8481559, 8480069]);
    expect(planned.bench).toContain(8478402);
    expect(best.starters.map((p) => p.playerId)).toEqual([8478402, 8480069]);
    expect(lineupValue(best, values) - lineupValue(planned, values)).toBe(7);
  });
  it('prevents two pinned centers competing for one center slot', () => {
    const pinned = setLineupChoice(team, date, 8481559, 'start');
    expect(starterChoiceError(pinned, best, 8478402, values)).toContain(
      'Bench one first',
    );
    expect(starterChoiceError(pinned, best, 8480069, values)).toBeNull();
  });
  it('keeps a sit choice out even when it leaves a slot empty', () => {
    const planned = buildPlannedDay(
      setLineupChoice(team, date, 8480069, 'sit'),
      best,
      values,
    );
    expect(planned.empty).toContain('D');
    expect(planned.bench).toContain(8480069);
  });
  it('reconciles IR, scratches and removed players without ghost starters', () => {
    const pinned = setLineupChoice(team, date, 8481559, 'start');
    const ir = {
      ...pinned,
      players: pinned.players.map((p) =>
        p.playerId === 8481559 ? { ...p, injuredReserve: true } : p,
      ),
    };
    expect(
      buildPlannedDay(ir, best, values).starters.map((p) => p.playerId),
    ).not.toContain(8481559);
    expect(
      buildPlannedDay(pinned, best, values, new Set([8481559])).starters.map(
        (p) => p.playerId,
      ),
    ).not.toContain(8481559);
    expect(
      buildPlannedDay(removePlayer(pinned, 8481559), best, values).starters.map(
        (p) => p.playerId,
      ),
    ).not.toContain(8481559);
    expect(starterChoiceError(ir, best, 8481559, values)).toContain('off IR');
  });
  it('persists exact start/sit choices through the team parser, isolated by date', () => {
    const saved = saveBestLineup(team, best);
    const restored = parseTeamsState(
      JSON.parse(JSON.stringify({ teams: [saved], activeTeamId: saved.id })),
    ).teams[0];
    expect(restored.lineupChoices?.[date]).toEqual({
      '8478402': 'start',
      '8481559': 'sit',
      '8480069': 'start',
    });
    expect(
      buildPlannedDay(restored, { ...best, date: '2026-10-14' }, values)
        .starters,
    ).toEqual(best.starters);
  });
  it('rejects corrupt dates, unknown player IDs and choices', () => {
    expect(
      sanitizeLineupChoices(
        {
          '2026-02-30': { '8478402': 'start' },
          [date]: { '8478402': 'start', '4': 'sit', '8480069': 'invented' },
        },
        new Set(players.map((p) => p.playerId)),
      ),
    ).toEqual({ [date]: { '8478402': 'start' } });
  });
  it('locks before stale game state can allow edits at puck drop', () => {
    expect(lineupLocked(games, new Date(`${date}T22:59:59Z`))).toBe(false);
    expect(lineupLocked(games, new Date(`${date}T23:00:00Z`))).toBe(true);
    expect(
      lineupLocked(
        [game(date, 'EDM', 'LAK', { state: 'LIVE' })],
        new Date(`${date}T20:00:00Z`),
      ),
    ).toBe(true);
  });
  it('bounds saved history without mutating the input', () => {
    const many = {
      ...team,
      lineupChoices: {
        '2026-09-01': { '8478402': 'start' as const },
        '2026-10-14': { '8478402': 'sit' as const },
      },
    };
    const next = setLineupChoice(many, date, 8478402, 'start');
    expect(next.lineupChoices?.['2026-09-01']).toBeUndefined();
    expect(next.lineupChoices?.['2026-10-14']).toBeDefined();
    expect(many.lineupChoices['2026-09-01']).toBeDefined();
  });
  it('preserves today’s plan when saving a date at the end of the planning horizon', () => {
    const current = setLineupChoice(team, date, 8478402, 'sit', date);
    const future = setLineupChoice(current, '2026-10-26', 8478402, 'start', date);
    expect(future.lineupChoices?.[date]?.[8478402]).toBe('sit');
    expect(future.lineupChoices?.['2026-10-26']?.[8478402]).toBe('start');
    expect(saveBestLineup(future, { ...best, date: '2026-10-26' }, date).lineupChoices?.[date]).toEqual(current.lineupChoices?.[date]);
  });
});
