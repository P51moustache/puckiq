import React from 'react';
// @ts-expect-error no declaration for react-test-renderer
import { act, create } from 'react-test-renderer';
import { useNight } from '../useCoach';
import { createTeam } from '../../services/teams';
import type { NightData } from '../../services/fantasy/loadNight';

const mockRefresh = jest.fn(async () => undefined);
let mockNight: NightData;
jest.mock('react-native', () => ({ AppState: { currentState: 'active' } }));
jest.mock('../useResource', () => ({ useResource: () => ({ data: mockNight, refresh: mockRefresh, error: null, loading: false, refreshing: false }) }));
jest.mock('../useTeamData', () => ({
  useNhlToday: () => '2026-10-13', rosterKey: () => 'roster',
  useTeamForms: () => ({ data: null }), useWeekSchedule: () => ({ data: null }),
}));
jest.mock('../useGoalieOutlook', () => ({ useGoalieOutlook: () => new Map() }));

const team = createTeam({});
let result: ReturnType<typeof useNight>;
function Probe() { result = useNight(team); return null; }

it('expires confirmation without postponing the existing one-minute game refresh', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-13T16:00:00Z'));
  mockRefresh.mockClear();
  const check = { source: 'test', fetchedAt: Date.now(), maxAgeMs: 60_000, state: 'fresh' as const };
  mockNight = {
    date: '2026-10-13', games: [], checks: { schedule: check, scratches: [check], news: null },
    playerGames: { 1: { date: '2026-10-13', gameId: 12, opponent: 'TOR', isHome: true, state: 'PRE', offNight: false, startTimeUTC: '2026-10-13T16:30:00Z' } },
    statuses: new Map([[1, { playerId: 1, signal: 'scratch', confidence: 'confirmed', note: null, check }]]),
    liveLines: new Map(), news: [], nextDate: null, preseasonGames: 0,
  };
  let tree: any;
  try {
    await act(async () => { tree = create(<Probe />); });
    expect(result.night.data?.statuses.get(1)?.confidence).toBe('confirmed');
    await act(async () => { jest.advanceTimersByTime(30_000); tree.update(<Probe />); });
    await act(async () => { jest.advanceTimersByTime(30_000); tree.update(<Probe />); });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(result.night.data?.statuses.get(1)?.confidence).toBe('likely');
    expect(mockNight.statuses.get(1)?.confidence).toBe('confirmed');
  } finally {
    if (tree) await act(async () => tree.unmount());
    jest.useRealTimers();
  }
});
