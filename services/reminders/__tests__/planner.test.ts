import type { FantasyTeam, SlotKey } from '../../../types/fantasy';
import { busyNight, game, player, week } from '../../fantasy/__tests__/fixtures';
import { formatPuckDrop } from '../../nhl/dates';
import { createTeam } from '../../teams';
import type { LineupChange } from '../lineupChanges';
import { planReminders, type ReminderLineups } from '../planner';

const MONDAY = '2026-10-12';
const TUESDAY = '2026-10-13';
const MON_PUCK = '2026-10-12T23:00:00Z';
const TUE_PUCK = '2026-10-13T23:30:00Z';
const MORNING = new Date('2026-10-12T12:00:00Z');

const schedule = week(MONDAY, {
  [MONDAY]: [game(MONDAY, 'MTL', 'EDM', { startTimeUTC: MON_PUCK }), ...busyNight(MONDAY)],
  [TUESDAY]: [game(TUESDAY, 'TOR', 'BOS', { startTimeUTC: TUE_PUCK }), ...busyNight(TUESDAY)],
});
const beauties = createTeam({
  name: 'Beauties',
  players: [player(8478402, 'Connor McDavid', 'EDM', 'C'), player(8480018, 'Nick Suzuki', 'MTL', 'C'), player(8479318, 'Auston Matthews', 'TOR', 'C')],
});

const NEEDED = { minutesBefore: 60, liveStart: false, onlyWhenNeeded: true };
const EVERY_NIGHT = { ...NEEDED, onlyWhenNeeded: false };

function change(start: string[], bench: string[] = [], emptySlots: SlotKey[] = []): LineupChange {
  return {
    start: start.map((name, index) => ({ playerId: 8_400_000 + index, name, slot: 'LW' })),
    bench: bench.map((name, index) => ({ playerId: 8_500_000 + index, name })),
    emptySlots,
  };
}
const SET = change([]);

function lineups(...teams: [FantasyTeam, Record<string, LineupChange | null>][]): ReminderLineups {
  return new Map(teams.map(([team, nights]) => [team.id, new Map(Object.entries(nights))]));
}

describe('planReminders with lineup data', () => {
  it('names the moves, and skips nights the lineup already works when only-when-needed is on', () => {
    const data = lineups([beauties, { [MONDAY]: change(['Hyman', 'Pesce'], ['Kreider'], ['G']), [TUESDAY]: SET }]);
    const planned = planReminders([beauties], [schedule], NEEDED, MORNING, data);
    expect(planned).toHaveLength(1);
    expect(planned[0]).toMatchObject({
      kind: 'lineup',
      date: MONDAY,
      title: '2 lineup changes tonight',
      body: `Start Hyman, Pesce · bench Kreider · G slot open. First puck ${formatPuckDrop(MON_PUCK)}.`,
    });
  });

  it('says "Lineup change" for a single move', () => {
    const data = lineups([beauties, { [MONDAY]: change(['Hyman'], ['Kreider']) }]);
    const [monday] = planReminders([beauties], [schedule], NEEDED, MORNING, data);
    expect(monday).toMatchObject({ title: 'Lineup change tonight', body: `Start Hyman · bench Kreider. First puck ${formatPuckDrop(MON_PUCK)}.` });
  });

  it('keeps every night, with the player count where nothing needs moving, when only-when-needed is off', () => {
    const data = lineups([beauties, { [MONDAY]: change(['Hyman'], ['Kreider']), [TUESDAY]: SET }]);
    const planned = planReminders([beauties], [schedule], EVERY_NIGHT, MORNING, data);
    expect(planned.map((row) => row.date)).toEqual([MONDAY, TUESDAY]);
    expect(planned[1]).toMatchObject({ title: 'Set your lineup', body: `1 of your players play tonight. First puck ${formatPuckDrop(TUE_PUCK)}.` });
  });

  it('treats open slots alone as a pickup, not a lineup move', () => {
    const data = lineups([beauties, { [MONDAY]: change([], [], ['G']) }]);
    expect(planReminders([beauties], [schedule], NEEDED, MORNING, data).map((row) => row.date)).toEqual([TUESDAY]);
    const [monday] = planReminders([beauties], [schedule], EVERY_NIGHT, MORNING, data);
    expect(monday).toMatchObject({ title: 'Open G slot tonight', body: `2 of your players play tonight · G slot open. First puck ${formatPuckDrop(MON_PUCK)}.` });
  });

  it('falls back to the count without lineup data, even when only-when-needed is on', () => {
    // Tuesday has no data for this team; Monday has no carried lineup to compare with (null).
    const planned = planReminders([beauties], [schedule], NEEDED, MORNING, lineups([beauties, { [MONDAY]: null }]));
    expect(planned.map((row) => [row.date, row.title, row.body])).toEqual([
      [MONDAY, 'Set your lineup', `2 of your players play tonight. First puck ${formatPuckDrop(MON_PUCK)}.`],
      [TUESDAY, 'Set your lineup', `1 of your players play tonight. First puck ${formatPuckDrop(TUE_PUCK)}.`],
    ]);
    expect(planReminders([beauties], [schedule], NEEDED, MORNING, new Map())).toHaveLength(2);
  });

  it('names each team, leaves out teams with nothing to do, and counts teams without data', () => {
    const benchMob = createTeam({ name: 'Bench Mob', players: [player(8473419, 'Brad Marchand', 'BOS', 'LW')] });
    const thirdLine = createTeam({ name: 'Third Line', players: [player(8477939, 'William Nylander', 'TOR', 'RW')] });
    const data = lineups(
      [beauties, { [TUESDAY]: change(['Hyman', 'Pesce', 'Tavares'], ['Kreider']) }],
      [benchMob, { [TUESDAY]: SET }],
    );
    const tuesday = planReminders([beauties, benchMob, thirdLine], [schedule], NEEDED, MORNING, data).find((row) => row.date === TUESDAY);
    expect(tuesday).toMatchObject({
      title: '3 lineup changes tonight',
      body: `Beauties: start Hyman, Pesce +1 more · bench Kreider. Third Line: 1 play tonight. First puck ${formatPuckDrop(TUE_PUCK)}.`,
    });
  });

  it('caps a long list of names', () => {
    const data = lineups([beauties, { [MONDAY]: change(['Hyman', 'Pesce', 'Tavares', 'Knies', 'Rielly']) }]);
    const [monday] = planReminders([beauties], [schedule], NEEDED, MORNING, data);
    expect(monday.body).toBe(`Start Hyman, Pesce, Tavares +2 more. First puck ${formatPuckDrop(MON_PUCK)}.`);
  });

  it('leaves "your night is live" unchanged, even on a night the lineup reminder skips', () => {
    const data = lineups([beauties, { [MONDAY]: SET, [TUESDAY]: change(['Hyman'], ['Kreider']) }]);
    const planned = planReminders([beauties], [schedule], { ...NEEDED, liveStart: true }, MORNING, data);
    expect(planned.map((row) => [row.kind, row.date])).toEqual([
      ['live', MONDAY],
      ['lineup', TUESDAY],
      ['live', TUESDAY],
    ]);
    expect(planned[0]).toMatchObject({ title: 'Your night is live', body: '2 of your players play tonight. Follow your points live.' });
    expect(planned[2]).toMatchObject({ title: 'Your night is live', body: '1 of your players play tonight. Follow your points live.' });
  });
});
