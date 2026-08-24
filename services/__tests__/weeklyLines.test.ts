import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LINES_STORAGE_KEY,
  assignPlayer,
  canCopyLastWeek,
  copyPreviousWeek,
  emptyWeek,
  getIsoWeekId,
  getMondayOfIsoWeek,
  getWeekRangeLabel,
  groupForPlayer,
  loadAndRollLines,
  persistLines,
  rollToCurrentWeek,
} from '../weeklyLines';
import type { LinesStore } from '../../types/lines';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

function storeForWeek(weekId: string, assignments: LinesStore['current']['assignments'] = []): LinesStore {
  return {
    current: { weekId, label: weekId, assignments },
    previous: null,
  };
}

describe('weeklyLines week math', () => {
  it('uses ISO Monday-start weeks', () => {
    // Wednesday 19 Aug 2026 is in the week of Mon 17 – Sun 23 Aug
    const weekId = getIsoWeekId(new Date(2026, 7, 19));
    const monday = getMondayOfIsoWeek(weekId);
    expect(monday.toISOString().startsWith('2026-08-17')).toBe(true);
    expect(getWeekRangeLabel(weekId)).toMatch(/Aug 17/);
    expect(getWeekRangeLabel(weekId)).toMatch(/23/);
  });

  it('keeps Sunday in the same week as the prior Monday', () => {
    expect(getIsoWeekId(new Date(2026, 7, 17))).toBe(getIsoWeekId(new Date(2026, 7, 23)));
  });
});

describe('rollToCurrentWeek', () => {
  it('creates an empty current week when nothing is stored', () => {
    const now = new Date(2026, 7, 19);
    const rolled = rollToCurrentWeek(null, now);
    expect(rolled.current.weekId).toBe(getIsoWeekId(now));
    expect(rolled.current.assignments).toEqual([]);
    expect(rolled.previous).toBeNull();
  });

  it('keeps the current week when it already matches', () => {
    const now = new Date(2026, 7, 19);
    const weekId = getIsoWeekId(now);
    const stored = storeForWeek(weekId, [{ playerId: 1, group: 'F' }]);
    const rolled = rollToCurrentWeek(stored, now);
    expect(rolled.current.assignments).toEqual([{ playerId: 1, group: 'F' }]);
    expect(rolled.previous).toBeNull();
  });

  it('moves the current week to the single previous snapshot on rollover', () => {
    const now = new Date(2026, 7, 19);
    const thisWeek = getIsoWeekId(now);
    const lastWeek = getIsoWeekId(new Date(2026, 7, 12));
    const stored: LinesStore = {
      current: { weekId: lastWeek, label: 'last', assignments: [{ playerId: 7, group: 'D' }] },
      previous: { weekId: '2026-W01', label: 'older', assignments: [{ playerId: 9, group: 'G' }] },
    };
    const rolled = rollToCurrentWeek(stored, now);
    expect(rolled.current.weekId).toBe(thisWeek);
    expect(rolled.current.assignments).toEqual([]);
    expect(rolled.previous?.weekId).toBe(lastWeek);
    expect(rolled.previous?.assignments).toEqual([{ playerId: 7, group: 'D' }]);
  });
});

describe('assign and copy', () => {
  it('taps a player into a new group and replaces any prior slot', () => {
    const store = storeForWeek('2026-W34', [{ playerId: 1, group: 'bench' }]);
    const next = assignPlayer(assignPlayer(store, 1, 'F'), 1, 'D');
    expect(next.current.assignments).toEqual([{ playerId: 1, group: 'D' }]);
  });

  it('copies last week onto this week for players still on the roster', () => {
    const store: LinesStore = {
      current: emptyWeek('2026-W34'),
      previous: {
        weekId: '2026-W33',
        label: 'last',
        assignments: [
          { playerId: 1, group: 'F' },
          { playerId: 2, group: 'G' },
          { playerId: 99, group: 'D' },
        ],
      },
    };
    const copied = copyPreviousWeek(store, [1, 2]);
    expect(copied.current.assignments).toEqual([
      { playerId: 1, group: 'F' },
      { playerId: 2, group: 'G' },
    ]);
  });

  it('does not copy when there is no previous snapshot', () => {
    const store = storeForWeek('2026-W34', [{ playerId: 1, group: 'F' }]);
    expect(copyPreviousWeek(store, [1])).toBe(store);
    expect(canCopyLastWeek(store)).toBe(false);
  });

  it('enables copy only when last week has assignments', () => {
    const emptyPrev: LinesStore = {
      current: emptyWeek('2026-W34'),
      previous: emptyWeek('2026-W33'),
    };
    const withPrev: LinesStore = {
      ...emptyPrev,
      previous: { ...emptyPrev.previous!, assignments: [{ playerId: 1, group: 'F' }] },
    };
    expect(canCopyLastWeek(emptyPrev)).toBe(false);
    expect(canCopyLastWeek(withPrev)).toBe(true);
  });

  it('defaults an unassigned player to bench', () => {
    expect(groupForPlayer([], 1)).toBe('bench');
    expect(groupForPlayer([{ playerId: 1, group: 'G' }], 1)).toBe('G');
  });
});

describe('weeklyLines persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetItem.mockResolvedValue(undefined);
  });

  it('loads and rolls a stale store, then persists the snapshot', async () => {
    const now = new Date(2026, 7, 19);
    const lastWeek = getIsoWeekId(new Date(2026, 7, 12));
    mockGetItem.mockResolvedValue(
      JSON.stringify({
        current: { weekId: lastWeek, label: 'last', assignments: [{ playerId: 3, group: 'F' }] },
        previous: null,
      }),
    );

    const loaded = await loadAndRollLines(now);
    expect(loaded.current.weekId).toBe(getIsoWeekId(now));
    expect(loaded.previous?.assignments).toEqual([{ playerId: 3, group: 'F' }]);
    expect(mockSetItem).toHaveBeenCalledWith(LINES_STORAGE_KEY, expect.any(String));
  });

  it('returns a fresh week when storage is empty', async () => {
    mockGetItem.mockResolvedValue(null);
    const now = new Date(2026, 7, 19);
    const loaded = await loadAndRollLines(now);
    expect(loaded.current.weekId).toBe(getIsoWeekId(now));
    expect(loaded.previous).toBeNull();
  });

  it('persists the store under the local key', async () => {
    const store = storeForWeek('2026-W34');
    await persistLines(store);
    expect(mockSetItem).toHaveBeenCalledWith(LINES_STORAGE_KEY, JSON.stringify(store));
  });
});
