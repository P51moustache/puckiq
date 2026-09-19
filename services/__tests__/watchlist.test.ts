import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addWatchedPlayer,
  readWatchlist,
  removeWatchedPlayer,
  subscribeToWatchlist,
  toggleWatchedPlayer,
} from '../watchlist';

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const connor = { playerId: 8478402, fullName: 'Connor McDavid', teamAbbrev: 'EDM', position: 'C', headshotUrl: 'connor.png' };

describe('watchlist', () => {
  let values: Record<string, string | null>;
  beforeEach(() => {
    jest.clearAllMocks();
    values = { puckiq_watchlist: null, puckiq_watchlist_metadata_v1: null };
    storage.getItem.mockImplementation(async key => values[key] ?? null);
    storage.multiSet.mockImplementation(async pairs => { pairs.forEach(([key, value]) => { values[key] = value; }); });
  });

  it('migrates legacy player ids into readable entries without overwriting storage', async () => {
    values.puckiq_watchlist = '[8478402]';
    await expect(readWatchlist()).resolves.toEqual([{ playerId: 8478402, fullName: 'Player #8478402', teamAbbrev: '', position: '' }]);
    expect(storage.multiSet).not.toHaveBeenCalled();
  });

  it('keeps valid numeric ids readable when optional metadata is malformed', async () => {
    values.puckiq_watchlist = '[8478402]';
    values.puckiq_watchlist_metadata_v1 = '{broken';
    await expect(readWatchlist()).resolves.toEqual([{ playerId: 8478402, fullName: 'Player #8478402', teamAbbrev: '', position: '' }]);
  });

  it('publishes only after a successful persisted write', async () => {
    storage.multiSet.mockRejectedValueOnce(new Error('disk full'));
    const listener = jest.fn();
    const unsubscribe = subscribeToWatchlist(listener);
    await expect(addWatchedPlayer(connor)).rejects.toThrow('disk full');
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('serializes concurrent toggles against the latest persisted collection', async () => {
    await Promise.all([toggleWatchedPlayer(connor), toggleWatchedPlayer(connor)]);
    expect(JSON.parse(values.puckiq_watchlist!)).toEqual([]);
  });

  it('returns the exact removed entry so an undo can restore it', async () => {
    values.puckiq_watchlist = JSON.stringify([connor.playerId]);
    values.puckiq_watchlist_metadata_v1 = JSON.stringify([connor]);
    await expect(removeWatchedPlayer(connor.playerId)).resolves.toEqual(connor);
  });

  it('keeps the shipped watchlist key as a numeric id array', async () => {
    await addWatchedPlayer(connor);
    expect(JSON.parse(values.puckiq_watchlist!)).toEqual([8478402]);
    expect(JSON.parse(values.puckiq_watchlist_metadata_v1!)).toEqual([connor]);
  });

  it('orders a refresh before a newer mutation so its late result cannot overwrite the publish', async () => {
    let releaseIds!: (value: string | null) => void;
    storage.getItem.mockImplementationOnce(() => new Promise(resolve => { releaseIds = resolve; }));
    const refresh = readWatchlist();
    const listener = jest.fn();
    const unsubscribe = subscribeToWatchlist(listener);
    const mutation = addWatchedPlayer(connor);
    await Promise.resolve();
    await Promise.resolve();
    releaseIds('[]');
    await refresh;
    await mutation;
    expect(listener).toHaveBeenLastCalledWith([connor]);
    unsubscribe();
  });
});
