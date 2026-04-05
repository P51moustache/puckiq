import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadRoster,
  saveRoster,
  updateRoster,
  addPlayerToRoster,
  removePlayerFromRoster,
  clearRoster,
  getScoringFormat,
} from '../fantasyRoster';
import type { FantasyRoster, FantasyPlayer } from '../../types/fantasy';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRemoveItem = AsyncStorage.removeItem as jest.Mock;

const STORAGE_KEY = 'puckiq_fantasy_roster';

function makePlayer(overrides: Partial<FantasyPlayer> = {}): FantasyPlayer {
  return {
    playerId: 8478402,
    playerName: 'Connor McDavid',
    teamAbbrev: 'EDM',
    position: 'C',
    rosterPosition: 'C',
    ...overrides,
  };
}

function makeRoster(overrides: Partial<FantasyRoster> = {}): FantasyRoster {
  return {
    id: '123456',
    name: 'My Team',
    scoringFormat: 'yahoo',
    players: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('fantasyRoster service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
  });

  describe('loadRoster', () => {
    it('returns null when no roster is saved', async () => {
      mockGetItem.mockResolvedValue(null);
      const result = await loadRoster();
      expect(result).toBeNull();
      expect(mockGetItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('returns the saved roster', async () => {
      const roster = makeRoster({ players: [makePlayer()] });
      mockGetItem.mockResolvedValue(JSON.stringify(roster));

      const result = await loadRoster();
      expect(result).toEqual(roster);
    });

    it('returns null on storage error', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage error'));
      const result = await loadRoster();
      expect(result).toBeNull();
    });
  });

  describe('saveRoster', () => {
    it('creates a new roster with generated id and timestamps', async () => {
      const result = await saveRoster({
        name: 'My Team',
        scoringFormat: 'yahoo',
        players: [],
      });

      expect(result.id).toBeTruthy();
      expect(result.name).toBe('My Team');
      expect(result.scoringFormat).toBe('yahoo');
      expect(result.players).toEqual([]);
      expect(result.createdAt).toBeTruthy();
      expect(result.updatedAt).toBeTruthy();
      expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(result));
    });

    it('saves roster with players', async () => {
      const player = makePlayer();
      const result = await saveRoster({
        name: 'Stacked Team',
        scoringFormat: 'espn',
        players: [player],
      });

      expect(result.players).toHaveLength(1);
      expect(result.players[0].playerName).toBe('Connor McDavid');
      expect(result.scoringFormat).toBe('espn');
    });

    it('throws on storage error', async () => {
      mockSetItem.mockRejectedValue(new Error('Storage error'));
      await expect(saveRoster({ name: 'Team', scoringFormat: 'yahoo', players: [] }))
        .rejects.toThrow('Storage error');
    });
  });

  describe('updateRoster', () => {
    it('updates the roster and refreshes updatedAt', async () => {
      const roster = makeRoster({ name: 'Old Name' });
      const result = await updateRoster({ ...roster, name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(result.updatedAt).not.toBe(roster.updatedAt);
      expect(result.createdAt).toBe(roster.createdAt);
      expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(result));
    });

    it('throws on storage error', async () => {
      mockSetItem.mockRejectedValue(new Error('Storage error'));
      await expect(updateRoster(makeRoster())).rejects.toThrow('Storage error');
    });
  });

  describe('addPlayerToRoster', () => {
    it('adds a player to an existing roster', async () => {
      const roster = makeRoster();
      mockGetItem.mockResolvedValue(JSON.stringify(roster));

      const player = makePlayer();
      const result = await addPlayerToRoster(player);

      expect(result.players).toHaveLength(1);
      expect(result.players[0].playerId).toBe(8478402);
      expect(result.updatedAt).not.toBe(roster.updatedAt);
    });

    it('throws when no roster exists', async () => {
      mockGetItem.mockResolvedValue(null);
      await expect(addPlayerToRoster(makePlayer()))
        .rejects.toThrow('No roster found. Create a roster first.');
    });

    it('prevents duplicate players', async () => {
      const roster = makeRoster({ players: [makePlayer()] });
      mockGetItem.mockResolvedValue(JSON.stringify(roster));

      await expect(addPlayerToRoster(makePlayer()))
        .rejects.toThrow('already on the roster');
    });

    it('enforces max roster size of 20', async () => {
      const players = Array.from({ length: 20 }, (_, i) =>
        makePlayer({ playerId: i + 1, playerName: `Player ${i + 1}` })
      );
      const roster = makeRoster({ players });
      mockGetItem.mockResolvedValue(JSON.stringify(roster));

      await expect(addPlayerToRoster(makePlayer({ playerId: 999 })))
        .rejects.toThrow('Roster is full (max 20 players)');
    });

    it('allows adding up to the 20th player', async () => {
      const players = Array.from({ length: 19 }, (_, i) =>
        makePlayer({ playerId: i + 1, playerName: `Player ${i + 1}` })
      );
      const roster = makeRoster({ players });
      mockGetItem.mockResolvedValue(JSON.stringify(roster));

      const result = await addPlayerToRoster(makePlayer({ playerId: 999 }));
      expect(result.players).toHaveLength(20);
    });
  });

  describe('removePlayerFromRoster', () => {
    it('removes a player by ID', async () => {
      const roster = makeRoster({
        players: [
          makePlayer({ playerId: 1, playerName: 'Player 1' }),
          makePlayer({ playerId: 2, playerName: 'Player 2' }),
        ],
      });
      mockGetItem.mockResolvedValue(JSON.stringify(roster));

      const result = await removePlayerFromRoster(1);
      expect(result.players).toHaveLength(1);
      expect(result.players[0].playerId).toBe(2);
    });

    it('throws when no roster exists', async () => {
      mockGetItem.mockResolvedValue(null);
      await expect(removePlayerFromRoster(1))
        .rejects.toThrow('No roster found.');
    });

    it('throws when player is not on roster', async () => {
      const roster = makeRoster({ players: [makePlayer()] });
      mockGetItem.mockResolvedValue(JSON.stringify(roster));

      await expect(removePlayerFromRoster(99999))
        .rejects.toThrow('not found on roster');
    });
  });

  describe('clearRoster', () => {
    it('removes the roster from storage', async () => {
      await clearRoster();
      expect(mockRemoveItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('throws on storage error', async () => {
      mockRemoveItem.mockRejectedValue(new Error('Storage error'));
      await expect(clearRoster()).rejects.toThrow('Storage error');
    });
  });

  describe('getScoringFormat', () => {
    it('returns the scoring format from saved roster', async () => {
      const roster = makeRoster({ scoringFormat: 'espn' });
      mockGetItem.mockResolvedValue(JSON.stringify(roster));

      const result = await getScoringFormat();
      expect(result).toBe('espn');
    });

    it('returns null when no roster exists', async () => {
      mockGetItem.mockResolvedValue(null);
      const result = await getScoringFormat();
      expect(result).toBeNull();
    });

    it('returns null on storage error', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage error'));
      const result = await getScoringFormat();
      expect(result).toBeNull();
    });
  });
});
