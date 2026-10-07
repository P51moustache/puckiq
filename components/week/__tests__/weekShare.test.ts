import { weekShareContent } from '../weekShare';
import { scheduleRows } from '../stints';
import { MCDAVID, DRAISAITL, MONDAY, NEXT_MONDAY, ROSTER, nextWeekSchedule, planFor, thisWeekSchedule } from './support/weekFixtures';
import { week } from '../../../services/fantasy/__tests__/fixtures';

function share(choice: 'this' | 'next', schedule = choice === 'this' ? thisWeekSchedule() : nextWeekSchedule()) {
  const plan = planFor(ROSTER, schedule);
  return weekShareContent({ plan, rows: scheduleRows(ROSTER, plan), choice, monday: schedule.monday, teamName: 'Beauties' });
}

describe('weekShareContent', () => {
  it('counts the games left this week', () => {
    expect(share('this')).toMatchObject({ kind: 'week', count: 8, caption: 'games left this week', kicker: 'OCT 12 – OCT 18' });
  });

  it('counts every game next week, with games played as GP', () => {
    const content = share('next');
    expect(content).toMatchObject({ count: 4, caption: 'games next week', kicker: 'OCT 19 – OCT 25' });
    expect(content?.players.map((row) => [row.playerId, row.detail])).toEqual([
      [MCDAVID, '2 GP'],
      [DRAISAITL, '2 GP'],
    ]);
    expect(NEXT_MONDAY).toBe('2026-10-19');
  });

  it('has nothing to share without games', () => {
    expect(share('this', week(MONDAY, {}))).toBeNull();
  });
});
