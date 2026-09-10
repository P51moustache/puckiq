import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addFavoriteTeam,
  getFavoriteTeams,
  readFavoriteTeams,
  removeFavoriteTeam,
  subscribeToFavoriteTeams,
  toggleFavoriteTeam,
} from '../teamFavorites';

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('teamFavorites', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('preserves the existing favorite record shape when adding', async () => {
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValueOnce('2026-09-09T12:00:00.000Z');
    await addFavoriteTeam('EDM', 'Edmonton Oilers');
    expect(JSON.parse(storage.setItem.mock.calls[0][1])).toEqual([
      { triCode: 'EDM', fullName: 'Edmonton Oilers', addedAt: '2026-09-09T12:00:00.000Z' },
    ]);
  });

  it('keeps malformed storage compatible with the existing empty fallback', async () => {
    storage.getItem.mockResolvedValue('{broken');
    await expect(getFavoriteTeams()).resolves.toEqual([]);
  });

  it('refuses corrective writes when stored favorites cannot be read', async () => {
    storage.getItem.mockRejectedValue(new Error('temporarily unavailable'));
    await expect(readFavoriteTeams()).rejects.toThrow('temporarily unavailable');
    await expect(addFavoriteTeam('EDM', 'Edmonton Oilers')).rejects.toThrow('temporarily unavailable');
    expect(storage.setItem).not.toHaveBeenCalled();
    storage.getItem.mockResolvedValue('{broken');
    await expect(removeFavoriteTeam('EDM')).rejects.toThrow();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('filters invalid records and accepts only arrays', async () => {
    for (const invalid of ['{}', 'null', '[null,{"triCode":null}]']) {
      storage.getItem.mockResolvedValue(invalid);
      expect(await getFavoriteTeams()).toEqual([]);
    }
    const legacy = { triCode: 'ARI', fullName: 'Arizona Coyotes', addedAt: '2024-01-01' };
    storage.getItem.mockResolvedValue(JSON.stringify([null, legacy]));
    expect(await getFavoriteTeams()).toEqual([legacy]);
  });

  it('serializes legacy and provider callers without losing a favorite', async () => {
    let value: string | null = null;
    storage.getItem.mockImplementation(async () => value);
    storage.setItem.mockImplementation(async (_key, next) => { await Promise.resolve(); value = next; });
    await Promise.all([addFavoriteTeam('EDM', 'Edmonton Oilers'), addFavoriteTeam('BOS', 'Boston Bruins')]);
    expect((await getFavoriteTeams()).map(team => team.triCode)).toEqual(['EDM', 'BOS']);
    await Promise.all([toggleFavoriteTeam('EDM', 'Edmonton Oilers'), addFavoriteTeam('TOR', 'Toronto Maple Leafs')]);
    expect((await getFavoriteTeams()).map(team => team.triCode)).toEqual(['BOS', 'TOR']);
  });

  it('does not rewrite an existing favorite', async () => {
    storage.getItem.mockResolvedValue(JSON.stringify([
      { triCode: 'EDM', fullName: 'Edmonton Oilers', addedAt: '2026-09-08T12:00:00.000Z' },
    ]));
    await addFavoriteTeam('EDM', 'Different Name');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('publishes successful favorite mutations to subscribers', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToFavoriteTeams(listener);

    await addFavoriteTeam('EDM', 'Edmonton Oilers');
    expect(listener).toHaveBeenCalledWith([
      expect.objectContaining({ triCode: 'EDM', fullName: 'Edmonton Oilers' }),
    ]);

    storage.getItem.mockResolvedValue(JSON.stringify([
      { triCode: 'EDM', fullName: 'Edmonton Oilers', addedAt: '2026-09-09T12:00:00.000Z' },
    ]));
    await removeFavoriteTeam('EDM');
    expect(listener).toHaveBeenLastCalledWith([]);

    unsubscribe();
  });

  it('does not publish or update state when persistence fails', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToFavoriteTeams(listener);
    storage.setItem.mockRejectedValue(new Error('disk full'));

    await expect(addFavoriteTeam('EDM', 'Edmonton Oilers')).rejects.toThrow('disk full');
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('retains toggle return values and removal behavior', async () => {
    storage.getItem.mockResolvedValueOnce(null);
    await expect(toggleFavoriteTeam('EDM', 'Edmonton Oilers')).resolves.toBe(true);

    storage.getItem.mockResolvedValueOnce(JSON.stringify([
      { triCode: 'EDM', fullName: 'Edmonton Oilers', addedAt: '2026-09-09T12:00:00.000Z' },
    ])).mockResolvedValueOnce(JSON.stringify([
      { triCode: 'EDM', fullName: 'Edmonton Oilers', addedAt: '2026-09-09T12:00:00.000Z' },
    ]));
    await expect(toggleFavoriteTeam('EDM', 'Edmonton Oilers')).resolves.toBe(false);
    expect(JSON.parse(storage.setItem.mock.calls.at(-1)?.[1] ?? 'null')).toEqual([]);
  });
});
