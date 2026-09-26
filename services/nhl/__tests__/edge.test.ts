import { clearNhlMemoryCache } from '../client';
import { edgeTier, fetchPlayerEdge, mapGoalieEdge, mapSkaterEdge, percentileLabel } from '../edge';

const SKATER = {
  skatingSpeed: {
    speedMax: { imperial: 24.6119, percentile: 0.9967, leagueAvg: { imperial: 22.1684 } },
    burstsOver20: { value: 681, percentile: 1.0, leagueAvg: { value: 75.2 } },
  },
  topShotSpeed: { imperial: 82.05, percentile: 0.3098, leagueAvg: { imperial: 83.6208 } },
  totalDistanceSkated: { imperial: 330.2671, percentile: 1.0, leagueAvg: { imperial: 123.5454 } },
  sogSummary: [
    { locationCode: 'all', shots: 306, shotsPercentile: 0.9984 },
    { locationCode: 'high', shots: 120, shotsPercentile: 0.9984, shotsLeagueAvg: 31.6244 },
  ],
  zoneTimeDetails: { offensiveZonePctg: 0.47687929, offensiveZonePercentile: 0.9788, offensiveZoneLeagueAvg: 0.43087924 },
};

const GOALIE = {
  stats: {
    goalsAgainstAvg: { value: 2.49982, percentile: 0.8983, leagueAvg: 2.9917 },
    gamesAbove900: { value: 0.6275, percentile: 0.8983, leagueAvg: 0.4901 },
    goalSupportAvg: { value: 2.91646, percentile: 0.4576, leagueAvg: 2.9917 },
  },
  shotLocationSummary: [
    { locationCode: 'all', savePctg: 0.911579, savePctgPercentile: 0.9322, savePctgLeagueAvg: 0.89585 },
    { locationCode: 'high', savePctg: 0.8427, savePctgPercentile: 0.71, savePctgLeagueAvg: 0.82 },
  ],
};

describe('edge mapping', () => {
  it('maps skater tracking with top speed first', () => {
    const edge = mapSkaterEdge(SKATER, 8478402, 20252026)!;
    expect(edge.isGoalie).toBe(false);
    expect(edge.metrics.map((m) => m.key)).toEqual(['topSpeed', 'bursts', 'shotSpeed', 'highDanger', 'ozTime', 'distance']);
    expect(edge.metrics[0]).toEqual({ key: 'topSpeed', label: 'Top speed', value: '24.6', unit: 'mph', percentile: 0.9967, leagueAvg: '22.2' });
    expect(edge.metrics.find((m) => m.key === 'ozTime')?.value).toBe('47.7');
    expect(edge.metrics.find((m) => m.key === 'bursts')?.percentile).toBe(1);
  });

  it('maps goalie save % in hockey format and skips missing fields', () => {
    const edge = mapGoalieEdge(GOALIE, 8478048, 20252026)!;
    expect(edge.metrics[0].value).toBe('.912');
    expect(edge.metrics[0].leagueAvg).toBe('.896');
    expect(edge.metrics.find((m) => m.key === 'gaa')?.value).toBe('2.50');
    const sparse = mapGoalieEdge({ stats: {}, shotLocationSummary: [{ locationCode: 'all', savePctg: 0.9 }] }, 1, 20252026)!;
    expect(sparse.metrics).toHaveLength(1);
    expect(sparse.metrics[0].percentile).toBeNull();
  });

  it('returns null when there is nothing to show', () => {
    expect(mapSkaterEdge({}, 1, 20252026)).toBeNull();
    expect(mapGoalieEdge(null, 1, 20252026)).toBeNull();
  });

  it('labels percentiles and tiers like F1 timing', () => {
    expect(percentileLabel(0.9967)).toBe('99th');
    expect(percentileLabel(1)).toBe('99th');
    expect(percentileLabel(0.01)).toBe('1st');
    expect(percentileLabel(0.22)).toBe('22nd');
    expect(percentileLabel(0.113)).toBe('11th');
    expect(percentileLabel(0.43)).toBe('43rd');
    expect(edgeTier(0.95)).toBe('elite');
    expect(edgeTier(0.6)).toBe('good');
    expect(edgeTier(0.2)).toBe('below');
    expect(edgeTier(0.899)).toBe('elite'); // shown as "90th"
    expect(edgeTier(0.494)).toBe('below'); // shown as "49th"
  });
});

describe('fetchPlayerEdge', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    clearNhlMemoryCache();
  });

  it('falls back to last season when this season has no Edge yet', async () => {
    const fetchMock = jest.fn(async (url: string) => (url.includes('/20262027/')
      ? { ok: false, status: 404, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => SKATER }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const edge = await fetchPlayerEdge(8478402, false, 20262027);
    expect(edge?.seasonId).toBe(20252026);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://api-web.nhle.com/v1/edge/skater-detail/8478402/20262027/2',
      'https://api-web.nhle.com/v1/edge/skater-detail/8478402/20252026/2',
    ]);
  });

  it('returns null when neither season exists and surfaces real failures', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(fetchPlayerEdge(1, true, 20262027)).resolves.toBeNull();

    clearNhlMemoryCache();
    global.fetch = jest.fn(async () => ({ ok: false, status: 400, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(fetchPlayerEdge(2, true, 20262027)).rejects.toThrow('400');
  });
});
