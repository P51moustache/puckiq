import { mapTeamSchedule } from '../teamSchedule';
it('accepts the season schedule shape and excludes malformed, duplicate, preseason and postponed games', () => {
  const raw = (id: number, date: string, extra: object = {}) => ({
    id,
    gameDate: date,
    gameType: 2,
    gameScheduleState: 'OK',
    homeTeam: { abbrev: 'EDM' },
    awayTeam: { abbrev: 'LAK' },
    ...extra,
  });
  const rows = mapTeamSchedule({
    games: [
      raw(2, '2026-10-14'),
      null,
      raw(1, '2026-10-13'),
      raw(1, '2026-10-13'),
      raw(3, '2026-10-15', { gameType: 1 }),
      raw(4, '2026-10-16', { gameScheduleState: 'PPD' }),
      { id: 5 },
    ],
  });
  expect(rows.map((g) => g.id)).toEqual([1, 2]);
  expect(mapTeamSchedule({})).toEqual([]);
});
