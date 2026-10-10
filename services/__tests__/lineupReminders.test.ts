jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { formatPuckDrop } from '../nhl/dates';
import { createTeam } from '../teams';
import { MAX_SCHEDULED_REMINDERS, planReminders } from '../lineupReminders';
import { busyNight, game, player, week } from '../fantasy/__tests__/fixtures';

const MONDAY = '2026-10-12';
const MON_PUCK = '2026-10-12T23:00:00Z';
const TUE_PUCK = '2026-10-13T23:30:00Z';

const schedule = week(MONDAY, {
  '2026-10-12': [game('2026-10-12', 'MTL', 'EDM', { startTimeUTC: MON_PUCK }), ...busyNight('2026-10-12')],
  '2026-10-13': [game('2026-10-13', 'TOR', 'BOS', { startTimeUTC: TUE_PUCK }), ...busyNight('2026-10-13')],
});
const team = createTeam({
  name: 'Beauties',
  players: [player(8478402, 'Connor McDavid', 'EDM', 'C'), player(8480018, 'Nick Suzuki', 'MTL', 'C'), player(8479318, 'Auston Matthews', 'TOR', 'C')],
});
const MORNING = new Date('2026-10-12T12:00:00Z');

describe('planReminders', () => {
  it('plans one lineup reminder per game night by default', () => {
    const planned = planReminders([team], [schedule], { minutesBefore: 60, liveStart: false }, MORNING);
    expect(planned.map((row) => [row.kind, row.date, row.fireAt.toISOString()])).toEqual([
      ['lineup', '2026-10-12', '2026-10-12T22:00:00.000Z'],
      ['lineup', '2026-10-13', '2026-10-13T22:30:00.000Z'],
    ]);
    expect(planned[0].title).toBe('Set your lineup');
    expect(planned[0].body).toBe(`2 of your players play tonight. First puck ${formatPuckDrop(MON_PUCK)}.`);
  });

  it('adds "your night is live" at the first puck drop when asked', () => {
    const planned = planReminders([team], [schedule], { minutesBefore: 30, liveStart: true }, MORNING);
    expect(planned.map((row) => [row.kind, row.fireAt.toISOString()])).toEqual([
      ['lineup', '2026-10-12T22:30:00.000Z'],
      ['live', '2026-10-12T23:00:00.000Z'],
      ['lineup', '2026-10-13T23:00:00.000Z'],
      ['live', '2026-10-13T23:30:00.000Z'],
    ]);
    expect(planned[1]).toMatchObject({ title: 'Your night is live', body: '2 of your players play tonight. Follow your points live.' });
  });

  it('skips moments that already passed, separately for each kind', () => {
    const justBeforePuck = new Date('2026-10-12T22:45:00Z');
    const planned = planReminders([team], [schedule], { minutesBefore: 60, liveStart: true }, justBeforePuck);
    expect(planned.filter((row) => row.date === '2026-10-12').map((row) => row.kind)).toEqual(['live']);
  });

  it('names each team when more than one has players playing', () => {
    const other = createTeam({ name: 'Bench Mob', players: [player(8473419, 'Brad Marchand', 'BOS', 'LW')] });
    const planned = planReminders([team, other], [schedule], { minutesBefore: 60, liveStart: false }, MORNING);
    expect(planned.find((row) => row.date === '2026-10-13')?.body).toBe(`Beauties: 1 · Bench Mob: 1. First puck ${formatPuckDrop(TUE_PUCK)}.`);
  });

  it(`keeps at most ${MAX_SCHEDULED_REMINDERS} pending`, () => {
    const nextWeek = week('2026-10-19', Object.fromEntries(
      ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map((date) => [date, [game(date, 'MTL', 'EDM'), ...busyNight(date)]]),
    ));
    const busyWeek = week(MONDAY, Object.fromEntries(
      ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'].map((date) => [date, [game(date, 'MTL', 'EDM'), ...busyNight(date)]]),
    ));
    const planned = planReminders([team], [busyWeek, nextWeek], { minutesBefore: 60, liveStart: true }, MORNING);
    expect(planned).toHaveLength(MAX_SCHEDULED_REMINDERS);
    expect(planned[planned.length - 1].date).toBe('2026-10-18');
  });
});
