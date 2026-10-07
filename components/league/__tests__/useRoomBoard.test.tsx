jest.mock('react-native', () => require('./support/reactNative').reactNativeMock());
jest.mock('../../../hooks/useCoach', () => ({
  useNhlToday: () => '2026-10-14',
  useWeekSchedule: () => ({ data: mockSchedule, loading: false, refreshing: false, error: null, refresh: jest.fn(async () => undefined) }),
}));
jest.mock('../../../services/nhl/schedule', () => ({
  ...jest.requireActual('../../../services/nhl/schedule'),
  fetchDaySlate: (...args: unknown[]) => mockFetchDaySlate(...args),
}));
jest.mock('../../../services/nhl/gamecenter', () => ({
  ...jest.requireActual('../../../services/nhl/gamecenter'),
  fetchGameLines: (...args: unknown[]) => mockFetchGameLines(...args),
}));

import React from 'react';
import type { GameLine } from '../../../services/nhl/gamecenter';
import type { NhlGame } from '../../../services/nhl/schedule';
import type { RoomSnapshot } from '../../../types/league';
import { BOARD_POLL_MS, useRoomBoard, type RoomBoardView } from '../useRoomBoard';
import { appState } from './support/reactNative';
import { render, settle, unmountAll } from './support/tree';
import { BEN, edmCol, game, hughes, line, makar, mcdavid, ME, njdVan, roomSnapshot, thisWeek, TODAY } from './support/fixtures';

let mockSchedule = thisWeek;
const mockFetchDaySlate = jest.fn();
const mockFetchGameLines = jest.fn();

/** Before puck drop: a room game at 23:00Z and another league game nobody in the room cares about. */
const otherGame = game(TODAY, 'BOS', 'NYR');
const MORNING = new Date(`${TODAY}T12:00:00.000Z`);

let view: RoomBoardView;
function Probe({ snapshot, focused, now }: { snapshot: RoomSnapshot | null; focused: boolean; now: Date }) {
  view = useRoomBoard(snapshot, focused, now);
  return null;
}

function slate(states: Partial<Record<number, string>>): NhlGame[] {
  return [edmCol, njdVan, otherGame].map((entry) => ({ ...entry, state: states[entry.id] ?? 'FUT' }));
}

const boxes = new Map<number, Map<number, GameLine>>([
  [edmCol.id, new Map([[mcdavid.playerId, line(mcdavid.playerId, { goals: 1, shots: 3 })], [makar.playerId, line(makar.playerId, { assists: 2 })]])],
  [njdVan.id, new Map([[hughes.playerId, line(hughes.playerId, { shots: 2 })]])],
]);

describe('useRoomBoard', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    mockSchedule = thisWeek;
    mockFetchDaySlate.mockReset();
    mockFetchGameLines.mockReset();
    mockFetchGameLines.mockImplementation(async (gameId: number) => boxes.get(gameId) ?? new Map());
    appState.reset();
  });

  afterEach(() => {
    unmountAll();
    jest.useRealTimers();
  });

  it('ranks by games that count left before puck drop, without fetching any box score', async () => {
    mockFetchDaySlate.mockResolvedValue(slate({}));
    render(<Probe snapshot={roomSnapshot()} focused now={MORNING} />);
    await settle();
    expect(mockFetchGameLines).not.toHaveBeenCalled();
    expect(view.rows.every((row) => row.livePoints === null)).toBe(true);
    expect(view.summary).toMatchObject({ games: 2, live: 0, upcoming: 2, firstPuck: edmCol.startTimeUTC });
    // Hours before the first puck drop there's nothing to poll for.
    await settle(() => jest.advanceTimersByTime(BOARD_POLL_MS * 3));
    expect(mockFetchDaySlate).toHaveBeenCalledTimes(1);
  });

  it('fetches box scores only for started games the room has players in, and scores the board', async () => {
    mockFetchDaySlate.mockResolvedValue(slate({ [edmCol.id]: 'LIVE', [otherGame.id]: 'LIVE' }));
    render(<Probe snapshot={roomSnapshot()} focused now={MORNING} />);
    await settle();
    expect(mockFetchGameLines.mock.calls.map(([gameId]) => gameId)).toEqual([edmCol.id]);
    expect(view.summary.live).toBe(1);
    const mine = view.rows.find((row) => row.userId === ME)!;
    const ben = view.rows.find((row) => row.userId === BEN)!;
    expect(mine.livePoints).toBeGreaterThan(0);
    expect(ben.livePoints).toBe(0); // NJD–VAN hasn't started
    expect(view.rows[0].userId).toBe(ME);
  });

  it('polls each minute while the board is on screen and a game is live, and not when it isn’t', async () => {
    mockFetchDaySlate.mockResolvedValue(slate({ [edmCol.id]: 'LIVE' }));
    const tree = render(<Probe snapshot={roomSnapshot()} focused now={MORNING} />);
    await settle();
    await settle(() => jest.advanceTimersByTime(BOARD_POLL_MS));
    expect(mockFetchDaySlate).toHaveBeenCalledTimes(2);
    expect(mockFetchDaySlate.mock.calls[1][1]).toEqual({ force: true });
    expect(mockFetchGameLines.mock.calls[1][1]).toEqual({ final: false, force: true });

    await settle(() => tree.update(<Probe snapshot={roomSnapshot()} focused={false} now={MORNING} />));
    await settle(() => jest.advanceTimersByTime(BOARD_POLL_MS * 3));
    expect(mockFetchDaySlate).toHaveBeenCalledTimes(2);
  });

  it('re-reads a game’s box score fresh once when it goes final, then trusts the cache', async () => {
    mockFetchDaySlate.mockResolvedValueOnce(slate({ [edmCol.id]: 'LIVE' })).mockResolvedValue(slate({ [edmCol.id]: 'FINAL' }));
    render(<Probe snapshot={roomSnapshot()} focused now={MORNING} />);
    await settle();
    await settle(() => jest.advanceTimersByTime(BOARD_POLL_MS));
    const finalCall = mockFetchGameLines.mock.calls[mockFetchGameLines.mock.calls.length - 1];
    expect(finalCall).toEqual([edmCol.id, { final: true, force: true }]);
    // All room games final or not started for hours: polling stops on its own.
    expect(view.summary).toMatchObject({ live: 0, final: 1 });
    await settle(() => view.refresh());
    expect(mockFetchGameLines.mock.calls[mockFetchGameLines.mock.calls.length - 1]).toEqual([edmCol.id, { final: true, force: false }]);
  });

  it('starts polling shortly before the first puck drop so the board turns live by itself', async () => {
    mockFetchDaySlate.mockResolvedValue(slate({}));
    const soon = new Date(Date.parse(edmCol.startTimeUTC!) - 10 * 60 * 1000);
    render(<Probe snapshot={roomSnapshot()} focused now={soon} />);
    await settle();
    await settle(() => jest.advanceTimersByTime(BOARD_POLL_MS));
    expect(mockFetchDaySlate).toHaveBeenCalledTimes(2);
  });

  it('has nothing to fetch without a room', async () => {
    render(<Probe snapshot={null} focused now={MORNING} />);
    await settle();
    expect(mockFetchDaySlate).not.toHaveBeenCalled();
    expect(view.rows).toEqual([]);
  });
});
