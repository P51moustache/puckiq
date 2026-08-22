import { emptyMyWeek, fetchMyWeek, mapScheduleToMyWeek } from '../myWeek';
import type { FantasyPlayer } from '../../types/fantasy';

const mcdavid: FantasyPlayer = {
  playerId: 8478402,
  playerName: 'Connor McDavid',
  teamAbbrev: 'EDM',
  position: 'C',
  rosterPosition: 'C',
};

const matthews: FantasyPlayer = {
  playerId: 8479318,
  playerName: 'Auston Matthews',
  teamAbbrev: 'TOR',
  position: 'C',
  rosterPosition: 'C',
};

const payload = {
  gameWeek: [
    {
      date: '2026-09-19',
      dayAbbrev: 'SAT',
      games: [{
        id: 1,
        homeTeam: { abbrev: 'EDM' },
        awayTeam: { abbrev: 'CGY' },
      }],
    },
    {
      date: '2026-09-20',
      dayAbbrev: 'SUN',
      games: [{
        id: 2,
        homeTeam: { abbrev: 'BOS' },
        awayTeam: { abbrev: 'NYR' },
      }],
    },
    {
      date: '2026-09-21',
      dayAbbrev: 'MON',
      games: [{
        id: 3,
        homeTeam: { abbrev: 'TOR' },
        awayTeam: { abbrev: 'MTL' },
      }],
    },
  ],
};

describe('mapScheduleToMyWeek', () => {
  it('counts only MY players, not the whole slate', () => {
    const week = mapScheduleToMyWeek(payload, [mcdavid, matthews]);
    expect(week.days.map((d) => d.playerCount)).toEqual([1, 0, 1]);
    expect(week.days[0].games[0].opponentAbbrev).toBe('CGY');
    expect(week.days[2].games[0].playerName).toBe('Auston Matthews');
  });

  it('returns an empty week when the schedule is missing', () => {
    expect(mapScheduleToMyWeek({}, [mcdavid]).days).toEqual([]);
  });
});

describe('fetchMyWeek', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('does not fetch when the roster is empty', async () => {
    global.fetch = jest.fn();
    const week = await fetchMyWeek([], '2026-08-22');
    expect(week).toEqual(emptyMyWeek('2026-08-22'));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses the calendar schedule endpoint, not /now', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    const week = await fetchMyWeek([mcdavid], '2026-09-19');
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toBe(
      'https://api-web.nhle.com/v1/schedule/2026-09-19',
    );
    expect(week.days[0].playerCount).toBe(1);
  });

  it('fails quiet — never throws on a bad schedule response', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    await expect(fetchMyWeek([mcdavid], '2026-08-22')).resolves.toEqual(emptyMyWeek('2026-08-22'));
  });
});
