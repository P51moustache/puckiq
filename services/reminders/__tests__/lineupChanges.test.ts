import type { FantasyPlayer, LineupSlots } from '../../../types/fantasy';
import { buildWeekPlan } from '../../fantasy/weekPlan';
import { game, player, week } from '../../fantasy/__tests__/fixtures';
import type { WeekSchedule } from '../../nhl/schedule';
import { lineupChangesByDate, lineupMoveCount, needsLineupMove, type LineupChange } from '../lineupChanges';

const MON = '2026-10-12';
const NEXT_MON = '2026-10-19';

function slots(partial: Partial<LineupSlots>): LineupSlots {
  return { C: 0, LW: 0, RW: 0, F: 0, D: 0, UTIL: 0, G: 0, ...partial };
}

function changesFor(players: FantasyPlayer[], lineupSlots: LineupSlots, schedules: WeekSchedule[], values: Map<number, number>) {
  const plans = schedules.map((schedule) => buildWeekPlan({ schedule, players, slots: lineupSlots, values, today: MON }));
  return lineupChangesByDate({ plans, players, slots: lineupSlots, values });
}

/** "start Name@slot … | bench Name …" — compact enough to read a whole night in one assertion. */
function summary(change: LineupChange | null | undefined): string | null | undefined {
  if (!change) return change;
  const start = change.start.map((row) => `${row.name}@${row.slot}`).join(' ');
  const bench = change.bench.map((row) => row.name).join(' ');
  return `start ${start} | bench ${bench} | open ${change.emptySlots.join(' ')}`.replace(/\s+/g, ' ').trim();
}

const mcdavid = player(8478402, 'Connor McDavid', 'EDM', 'C');
const suzuki = player(8480018, 'Nick Suzuki', 'MTL', 'C');
const bouchard = player(8480803, 'Evan Bouchard', 'EDM', 'D');
const matheson = player(8476875, 'Mike Matheson', 'MTL', 'D');
const skinner = player(8479973, 'Stuart Skinner', 'EDM', 'G');
const montembeault = player(8478470, 'Samuel Montembeault', 'MTL', 'G');
const values = new Map([
  [mcdavid.playerId, 5],
  [suzuki.playerId, 3],
  [bouchard.playerId, 3],
  [matheson.playerId, 2],
  [skinner.playerId, 4],
  [montembeault.playerId, 3],
]);

describe('lineupChangesByDate', () => {
  it('has no baseline on and before the first night with a starter', () => {
    const schedule = week(MON, {
      '2026-10-12': [game('2026-10-12', 'TOR', 'BOS')], // games, none of mine
      '2026-10-13': [game('2026-10-13', 'EDM', 'VAN')],
      '2026-10-14': [game('2026-10-14', 'MTL', 'OTT')],
    });
    const changes = changesFor([mcdavid, suzuki], slots({ C: 1 }), [schedule], values);
    expect(changes.get('2026-10-12')).toBeNull();
    expect(changes.get('2026-10-13')).toBeNull();
    expect(summary(changes.get('2026-10-14'))).toBe('start Suzuki@C | bench McDavid | open');
  });

  it('needs no move on a night the carried lineup already works', () => {
    const schedule = week(MON, {
      '2026-10-12': [game('2026-10-12', 'EDM', 'VAN')],
      '2026-10-13': [game('2026-10-13', 'EDM', 'CGY')], // back-to-back: the same three play
    });
    const change = changesFor([mcdavid, bouchard, skinner], slots({ C: 1, D: 1, G: 1 }), [schedule], values).get('2026-10-13')!;
    expect(summary(change)).toBe('start | bench | open');
    expect(needsLineupMove(change)).toBe(false);
  });

  it('keeps an idle player seated until someone needs his seat, so he never has to be started again', () => {
    const schedule = week(MON, {
      '2026-10-12': [game('2026-10-12', 'EDM', 'VAN')],
      '2026-10-13': [game('2026-10-13', 'MTL', 'OTT')],
      '2026-10-14': [game('2026-10-14', 'EDM', 'CGY')],
    });
    const changes = changesFor([mcdavid, suzuki, bouchard, matheson, skinner, montembeault], slots({ C: 2, D: 1, G: 1 }), [schedule], values);
    // Suzuki takes the free C seat, so McDavid stays in his; the D and G seats change hands.
    expect(summary(changes.get('2026-10-13'))).toBe('start Montembeault@G Suzuki@C Matheson@D | bench Skinner Bouchard | open C');
    // McDavid was never benched: no "start McDavid". Suzuki keeps his seat too.
    expect(summary(changes.get('2026-10-14'))).toBe('start Skinner@G Bouchard@D | bench Montembeault Matheson | open C');
  });

  it('benches a carried player who plays but is outranked, ahead of idle ones', () => {
    const mcavoy = player(8479325, 'Charlie McAvoy', 'BOS', 'D');
    const schedule = week(MON, {
      '2026-10-12': [game('2026-10-12', 'MTL', 'BOS')],
      '2026-10-13': [game('2026-10-13', 'MTL', 'OTT'), game('2026-10-13', 'EDM', 'VAN')],
    });
    const withMcAvoy = new Map([...values, [mcavoy.playerId, 4]]);
    const change = changesFor([mcdavid, suzuki, bouchard, mcavoy], slots({ C: 1, D: 1 }), [schedule], withMcAvoy).get('2026-10-13')!;
    // Suzuki plays tonight but McDavid outranks him; McAvoy is idle and Bouchard needs his seat.
    expect(summary(change)).toBe('start McDavid@C Bouchard@D | bench Suzuki McAvoy | open');
    expect(lineupMoveCount(change)).toBe(2);
  });

  it('frees the seat of the idle player whose next start is furthest off, then the lower value', () => {
    const early = player(8470001, 'Plays Wednesday', 'TOR', 'D');
    const late = player(8470002, 'Plays Friday', 'BOS', 'D');
    const newcomer = player(8470003, 'New Starter', 'MTL', 'D');
    const dValues = new Map([[early.playerId, 1], [late.playerId, 3], [newcomer.playerId, 2]]);
    const schedule = week(MON, {
      '2026-10-12': [game('2026-10-12', 'TOR', 'BOS')],
      '2026-10-13': [game('2026-10-13', 'MTL', 'OTT')],
      '2026-10-14': [game('2026-10-14', 'TOR', 'VAN')],
      '2026-10-16': [game('2026-10-16', 'BOS', 'CGY')],
    });
    const changes = changesFor([early, late, newcomer], slots({ D: 2 }), [schedule], dValues);
    // Friday is further off than Wednesday, so the better player gives up his seat tonight...
    expect(summary(changes.get('2026-10-13'))).toBe('start Starter@D | bench Friday | open D');
    // ...and Wednesday needs nothing: the Wednesday player kept his seat.
    expect(needsLineupMove(changes.get('2026-10-14')!)).toBe(false);

    const sameNight = week(MON, {
      '2026-10-12': [game('2026-10-12', 'TOR', 'BOS')],
      '2026-10-13': [game('2026-10-13', 'MTL', 'OTT')],
      '2026-10-15': [game('2026-10-15', 'TOR', 'BOS')],
    });
    // Both idle players play Thursday: the lower-value one sits.
    expect(summary(changesFor([early, late, newcomer], slots({ D: 2 }), [sameNight], dValues).get('2026-10-13'))).toBe('start Starter@D | bench Wednesday | open D');
  });

  it('carries the lineup across the week boundary, whatever order the plans come in', () => {
    const thisWeek = week(MON, { '2026-10-18': [game('2026-10-18', 'EDM', 'VAN')] });
    const nextWeek = week(NEXT_MON, { '2026-10-19': [game('2026-10-19', 'MTL', 'OTT')] });
    const changes = changesFor([mcdavid, suzuki], slots({ C: 1 }), [nextWeek, thisWeek], values);
    expect(changes.get('2026-10-18')).toBeNull();
    expect(summary(changes.get('2026-10-19'))).toBe('start Suzuki@C | bench McDavid | open');
    expect([...changes.keys()][0]).toBe(MON);
  });

  it('lists slots the best lineup still can’t fill, only on nights with NHL games', () => {
    const bostonGoalie = player(8479973, 'Stuart Skinner', 'BOS', 'G');
    const schedule = week(MON, {
      '2026-10-12': [game('2026-10-12', 'EDM', 'BOS')],
      '2026-10-13': [game('2026-10-13', 'EDM', 'VAN')], // Boston is off: no goalie of mine plays
    });
    const changes = changesFor([mcdavid, bouchard, bostonGoalie], slots({ C: 1, D: 1, G: 1 }), [schedule], values);
    const tuesday = changes.get('2026-10-13')!;
    expect(summary(tuesday)).toBe('start | bench | open G');
    expect(needsLineupMove(tuesday)).toBe(false);
    expect(changes.get('2026-10-14')).toEqual({ start: [], bench: [], emptySlots: [] }); // no NHL games at all
  });

  it('uses last names, with a first initial when two players share one', () => {
    const jack = player(8481559, 'Jack Hughes', 'NJD', 'D');
    const quinn = player(8480800, 'Quinn Hughes', 'VAN', 'D');
    const schedule = week(MON, {
      '2026-10-12': [game('2026-10-12', 'NJD', 'BOS')],
      '2026-10-13': [game('2026-10-13', 'VAN', 'EDM')],
    });
    const change = changesFor([jack, quinn, mcdavid], slots({ D: 1 }), [schedule], new Map()).get('2026-10-13')!;
    expect(change.start).toEqual([{ playerId: quinn.playerId, name: 'Q. Hughes', slot: 'D' }]);
    expect(change.bench).toEqual([{ playerId: jack.playerId, name: 'J. Hughes' }]);
  });
});
