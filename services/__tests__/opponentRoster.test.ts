import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addOpponentPlayer,
  clearOpponentRoster,
  loadOpponentRoster,
  removeOpponentPlayer,
} from '../opponentRoster';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;

const player = {
  playerId: 1,
  playerName: 'Auston Matthews',
  teamAbbrev: 'TOR',
  position: 'C',
  rosterPosition: 'C' as const,
};

describe('opponentRoster', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setItem.mockResolvedValue(undefined);
  });

  it('returns [] when empty', async () => {
    getItem.mockResolvedValue(null);
    expect(await loadOpponentRoster()).toEqual([]);
  });

  it('adds a player and rejects duplicates', async () => {
    getItem.mockResolvedValue(JSON.stringify([]));
    const next = await addOpponentPlayer(player);
    expect(next).toHaveLength(1);
    getItem.mockResolvedValue(JSON.stringify(next));
    await expect(addOpponentPlayer(player)).rejects.toThrow('already on the opponent roster');
  });

  it('removes a player', async () => {
    getItem.mockResolvedValue(JSON.stringify([player]));
    const next = await removeOpponentPlayer(1);
    expect(next).toEqual([]);
  });

  it('clears storage', async () => {
    await clearOpponentRoster();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('puckiq_opponent_roster');
  });
});
