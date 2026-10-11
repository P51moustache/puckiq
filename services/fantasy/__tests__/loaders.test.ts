jest.mock('../../nhl/stats', () => ({ fetchSkaterLines: jest.fn(), fetchGoalieLines: jest.fn(), fetchPlayerBios: jest.fn() }));
jest.mock('../../nhl/teams', () => ({ fetchTeamStrength: jest.fn(async () => new Map()) }));
import { fetchSkaterLines, type SkaterLine } from '../../nhl/stats';
import { loadPlayerForms, valuesOf } from '../loaders';
import { DEFAULT_SCORING } from '../scoring';
import { player } from './fixtures';
const roster = [player(8478402, 'Connor McDavid', 'EDM', 'C')];
const fetchStats = jest.mocked(fetchSkaterLines);
const line: SkaterLine = { playerId: 8478402, name: 'Connor McDavid', position: 'C', team: 'EDM', gp: 10,
  goals: 0, assists: 0, points: 0, ppp: 0, shots: 0, hits: 0, blocks: 0, plusMinus: 0, toiPerGame: 1000 };
beforeEach(() => { fetchStats.mockReset(); jest.spyOn(console, 'warn').mockImplementation(() => undefined); });
afterEach(() => jest.restoreAllMocks());
it('reports a stats outage instead of a loaded zero-value lineup', async () => {
  fetchStats.mockRejectedValue(new Error('Offline'));
  await expect(loadPlayerForms(roster, DEFAULT_SCORING, '2026-10-13')).rejects.toThrow('Player stats are unavailable');
});
it('retains a real previous-season estimate when current data fails', async () => {
  fetchStats.mockImplementation(async (query) => {
    if (query.seasonId === 20252026) return [{ ...line, goals: 4, assists: 10 }];
    throw new Error('Offline');
  });
  const result = await loadPlayerForms(roster, DEFAULT_SCORING, '2026-10-13');
  expect(result.forms.get(8478402)?.basis).toBe('previous');
  expect(valuesOf(result.forms).get(8478402)).toBeGreaterThan(0);
});
it('distinguishes a real zero-point season from missing data', async () => {
  fetchStats.mockResolvedValue([line]);
  const result = await loadPlayerForms(roster, DEFAULT_SCORING, '2026-10-13');
  expect(valuesOf(result.forms).get(8478402)).toBe(0);
  fetchStats.mockResolvedValue([]);
  const missing = await loadPlayerForms(roster, DEFAULT_SCORING, '2026-10-13');
  expect(valuesOf(missing.forms).has(8478402)).toBe(false);
});
