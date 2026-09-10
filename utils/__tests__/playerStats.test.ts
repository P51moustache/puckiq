import { aggregateSeasonRows, normalizeCareerTotals, scopedGames, seasonTotalsConflict } from '../playerStats';
import { getCurrentSeason, formatSeasonLabel, isValidSeason } from '../season';
const row = (extra = {}) => ({ player_id: 1, season: 20252026, team_abbrev: 'AAA', games_played: 10, goals: 2, assists: 4, points: 6, shots: 20, ...extra });
test('known game subsets detect conflicting totals without turning missing data into zero', () => {
  expect(seasonTotalsConflict({ gamesPlayed: 1 }, [{}, {}])).toBe(true);
  expect(seasonTotalsConflict({ points: 3 }, [{ points: 4 }, { points: null }])).toBe(true);
  expect(seasonTotalsConflict({ saves: 4 }, [{ saves: 5 }])).toBe(true);
  expect(seasonTotalsConflict({ points: null }, [{ points: 4 }])).toBe(false);
  expect(seasonTotalsConflict({ points: 0, gamesPlayed: 1 }, [{ points: 0 }])).toBe(false);
});
test('season rolls over July 1 UTC and validates consecutive years', () => {
  expect(getCurrentSeason(new Date('2026-06-30T23:59:59Z'))).toBe(20252026);
  expect(getCurrentSeason(new Date('2026-07-01T00:00:00Z'))).toBe(20262027);
  expect(formatSeasonLabel(20252026)).toBe('2025–26');
  expect(isValidSeason(20252027)).toBe(false);
});
test('aggregates team splits only in the requested season without duplicating totals', () => {
  const rows = [row(), row({ team_abbrev: 'BBB', games_played: 5, goals: 1, assists: 2, points: 3, shots: 10 }), row({ season: 20242025, points: 90 }), row({ season: null, points: 500 })];
  expect(aggregateSeasonRows(rows, 20252026)[0]).toMatchObject({ games_played: 15, points: 9, shots: 30, shooting_pctg: 0.1 });
  expect(aggregateSeasonRows([...rows, row({ team_abbrev: 'TOT', games_played: 15, goals: 3, assists: 6, points: 9, shots: 30 })], 20252026)[0].points).toBe(9);
});
test('preserves zero and missing counts; ambiguous duplicate team rows are rejected', () => {
  expect(aggregateSeasonRows([row({ shots: 0, goals: 0 })], 20252026)[0].shots).toBe(0);
  expect(aggregateSeasonRows([row({ shots: null })], 20252026)[0].shots).toBeNull();
  expect(aggregateSeasonRows([row(), row({ points: 500 })], 20252026)).toEqual([]);
});
test('career totals selects NHL regular season and drops nested objects', () => {
  expect(normalizeCareerTotals({ regularSeason: { gamesPlayed: 100, points: 80, team: { default: 'EDM' } }, playoffs: { points: 10 } })).toEqual({ gamesPlayed: 100, points: 80 });
});
test('recent games reject cross season, playoffs, future and missing dates and deduplicate games', () => {
  const game = (id: number, extra = {}) => ({ game_id: id, points: 0, games: { season: 20252026, game_type: 2, game_date: '2026-01-01', game_state: 'OFF', ...extra } });
  expect(scopedGames([game(1), game(1), game(2, { season: 20242025 }), game(3, { game_type: 3 }), game(4, { game_date: '2026-09-01' }), game(5, { game_date: null })], 20252026, '2026-02-01').map(g => g.game_id)).toEqual([1]);
});
