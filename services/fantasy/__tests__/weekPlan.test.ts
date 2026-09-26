import { buildWeekPlan, openSlotDays } from '../weekPlan';
import { busyNight, game, player, week } from './fixtures';
import type { LineupSlots } from '../../../types/fantasy';

const MON = '2026-10-12';
const slots: LineupSlots = { C: 1, LW: 0, RW: 0, F: 0, D: 1, UTIL: 0, G: 1 };

describe('buildWeekPlan', () => {
  const roster = [
    player(8470001, 'Center One', 'EDM', 'C'),
    player(8470002, 'Center Two', 'TOR', 'C'),
    player(8470003, 'Dman', 'EDM', 'D'),
    player(8470004, 'Goalie', 'BOS', 'G'),
    player(1_756_000_000_000_001, 'Typed Name', '', 'F'),
    player(8470005, 'On IR', 'EDM', 'C', { injuredReserve: true }),
  ];
  const values = new Map([
    [8470001, 3],
    [8470002, 2],
    [8470003, 1.5],
    [8470004, 4],
  ]);

  const schedule = week(MON, {
    '2026-10-12': [game('2026-10-12', 'EDM', 'TOR'), ...busyNight('2026-10-12')], // both centres play
    '2026-10-13': [game('2026-10-13', 'EDM', 'VAN')], // off-night, EDM only
    '2026-10-15': [game('2026-10-15', 'BOS', 'NYR'), ...busyNight('2026-10-15')],
  });

  const plan = buildWeekPlan({ schedule, players: roster, slots, values, today: '2026-10-13' });

  it('counts games, skipping unlinked and IR players', () => {
    expect(plan.players[8470001].games).toBe(2);
    expect(plan.players[8470002].games).toBe(1);
    expect(plan.players[8470005]).toBeUndefined();
    expect(plan.players[1_756_000_000_000_001]).toBeUndefined();
  });

  it('benches the lower-value centre when both play and only one C slot exists', () => {
    const monday = plan.days[0];
    expect(monday.starters.map((seat) => seat.playerId).sort()).toEqual([8470001, 8470003]);
    expect(monday.bench).toEqual([8470002]);
    expect(plan.players[8470002].benched).toBe(1);
  });

  it('flags off-nights and empty slots only on nights with games', () => {
    const tuesday = plan.days[1];
    expect(tuesday.offNight).toBe(true);
    expect(tuesday.empty).toEqual(['G']);
    expect(plan.days[2].empty).toEqual([]); // Wednesday: no NHL games at all
    expect(plan.players[8470001].offNightGames).toBe(1);
  });

  it('splits totals into whole week and remaining (today onward)', () => {
    expect(plan.days[0].isPast).toBe(true);
    expect(plan.days[1].isToday).toBe(true);
    expect(plan.week.games).toBe(3 + 2 + 1);
    expect(plan.remaining.games).toBe(2 + 1);
    expect(plan.week.benched).toBe(1);
    expect(plan.remaining.benched).toBe(0);
    expect(plan.remaining.starts).toBe(3);
  });

  it('lists remaining days with an open slot for a position', () => {
    expect(openSlotDays(plan, ['G'])).toEqual(['2026-10-13']);
    expect(openSlotDays(plan, ['C', 'F', 'UTIL'])).toEqual(['2026-10-15']);
  });
});

describe('expected goalie starts', () => {
  it('counts start share per night, capped at goalie slots', () => {
    const goalies = [player(8470100, 'G One', 'BOS', 'G'), player(8470101, 'G Two', 'NYR', 'G')];
    const schedule = week(MON, {
      '2026-10-12': [game('2026-10-12', 'BOS', 'NYR'), ...busyNight('2026-10-12')],
      '2026-10-14': [game('2026-10-14', 'BOS', 'TOR'), ...busyNight('2026-10-14')],
    });
    const plan = buildWeekPlan({
      schedule,
      players: goalies,
      slots: { C: 0, LW: 0, RW: 0, F: 0, D: 0, UTIL: 0, G: 1 },
      values: new Map(),
      today: MON,
      startShares: new Map([[8470100, 0.7], [8470101, 0.6]]),
    });
    // Monday both play (1.3) but only one G slot → 1. Wednesday only BOS → 0.7.
    expect(plan.week.goalieStarts).toBeCloseTo(1.7);
  });
});
