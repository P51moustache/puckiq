const mockFetchJson = jest.fn();
jest.mock('../client', () => ({ fetchJson: (...args: unknown[]) => mockFetchJson(...args), HOUR: 3_600_000, MINUTE: 60_000 }));

import { extractPowerPlayPoints, fetchPowerPlayPoints } from '../powerPlay';

/** SEA @ DET, 2026-10-09 (game 2026020066): two power-play goals, both with two assists. */
const summary = {
  summary: {
    scoring: [
      { goals: [
        { strength: 'pp', playerId: 8478042, assists: [{ playerId: 8482078 }, { playerId: 8481542 }] },
        { strength: 'ev', playerId: 8484800, assists: [{ playerId: 8481554 }, { playerId: 8479372 }] },
      ] },
      { goals: [{ strength: 'sh', playerId: 8477919, assists: [] }] },
      { goals: [{ strength: 'pp', playerId: 8478407, assists: [{ playerId: 8476905 }, { playerId: 8478042 }] }] },
    ],
  },
};

describe('power-play points', () => {
  it('credits the scorer and both assists on power-play goals only', () => {
    const points = extractPowerPlayPoints(summary);
    expect(points.get(8478042)).toBe(2); // a PP goal and a PP assist
    expect(points.get(8482078)).toBe(1);
    expect(points.get(8476905)).toBe(1);
    expect(points.has(8484800)).toBe(false); // even strength
    expect(points.has(8477919)).toBe(false); // shorthanded
  });

  it('reads nothing from an empty or missing summary', () => {
    expect(extractPowerPlayPoints(null).size).toBe(0);
    expect(extractPowerPlayPoints({ summary: {} }).size).toBe(0);
  });

  it('fetches the game summary, cached like the box score, and gives up quietly', async () => {
    mockFetchJson.mockResolvedValueOnce(summary);
    expect((await fetchPowerPlayPoints(2026020066, { final: true }))?.get(8478407)).toBe(1);
    expect(mockFetchJson).toHaveBeenCalledWith('https://api-web.nhle.com/v1/gamecenter/2026020066/landing', expect.objectContaining({ persist: true }));
    mockFetchJson.mockRejectedValueOnce(new Error('offline'));
    expect(await fetchPowerPlayPoints(2026020066, { final: false })).toBeNull();
  });
});

describe('scoring lines', () => {
  const skater = (playerId: number, powerPlayGoals = 0) => ({
    playerId, isGoalie: false, goals: powerPlayGoals, assists: 0, points: powerPlayGoals, shots: 0, hits: 0, blocks: 0,
    plusMinus: 0, powerPlayGoals, pim: 0, toi: '18:00', saves: 0, shotsAgainst: 0, goalsAgainst: 0,
  });

  it('fills in power-play points, never fewer than the box score’s power-play goals', () => {
    const { withPowerPlayPoints } = jest.requireActual('../powerPlay');
    const lines = new Map([[1, skater(1)], [2, skater(2, 1)], [3, { ...skater(3), isGoalie: true }]]);
    const merged = withPowerPlayPoints(lines, new Map([[1, 2]]));
    expect(merged.get(1).powerPlayPoints).toBe(2); // two power-play assists
    expect(merged.get(2).powerPlayPoints).toBe(1); // the summary lags: keep his goal
    expect(merged.get(3).powerPlayPoints).toBeUndefined();
  });
});
