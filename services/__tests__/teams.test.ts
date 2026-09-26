import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  activeTeamOf,
  addPlayers,
  createTeam,
  deleteTeam,
  hidePickup,
  LEGACY_ROSTER_KEY,
  loadTeamsState,
  migrateLegacy,
  parseTeamsState,
  removePlayer,
  replacePlayer,
  TEAMS_STORAGE_KEY,
  teamLimit,
  upsertTeam,
} from '../teams';
import type { FantasyPlayer } from '../../types/fantasy';

const mcdavid: FantasyPlayer = { playerId: 8478402, playerName: 'Connor McDavid', teamAbbrev: 'EDM', position: 'C', rosterPosition: 'BN' };
const typed: FantasyPlayer = { playerId: 1_756_000_000_000_001, playerName: 'Jimmy Beer League', teamAbbrev: '', position: 'F', rosterPosition: 'BN' };

describe('teams store', () => {
  beforeEach(() => {
    (AsyncStorage.getItem as jest.Mock).mockReset();
    (AsyncStorage.setItem as jest.Mock).mockReset();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('migrates the 2.x roster and opponent, keeping typed names for linking', () => {
    const state = migrateLegacy(
      { id: '1', name: 'Beauties', scoringFormat: 'espn', players: [mcdavid, typed], createdAt: '', updatedAt: '' },
      [mcdavid],
    );
    const team = activeTeamOf(state!);
    expect(team?.name).toBe('Beauties');
    expect(team?.platform).toBe('espn');
    expect(team?.players.map((p) => p.playerName)).toEqual(['Connor McDavid', 'Jimmy Beer League']);
    expect(team?.opponent).toHaveLength(1);
  });

  it('loads v3 state first, falls back to migrating the legacy key, and persists the result', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === LEGACY_ROSTER_KEY) {
        return JSON.stringify({ id: '1', name: 'Old', scoringFormat: 'yahoo', players: [mcdavid] });
      }
      return null;
    });
    const state = await loadTeamsState();
    expect(state.teams).toHaveLength(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(TEAMS_STORAGE_KEY, expect.any(String));
  });

  it('sanitizes junk from storage', () => {
    const state = parseTeamsState({
      activeTeamId: 'missing',
      teams: [{ id: 'a', name: '', players: [mcdavid, mcdavid, { playerId: 'x' }], slots: { C: 99 } }, 'garbage'],
    });
    expect(state.activeTeamId).toBe('a');
    expect(state.teams[0].name).toBe('My Team');
    expect(state.teams[0].players).toHaveLength(1);
    expect(state.teams[0].slots.C).toBe(8);
  });

  it('adds without duplicates, removes, links a typed name, and hides pickups', () => {
    let team = createTeam({ players: [typed] });
    team = addPlayers(team, [mcdavid, mcdavid]);
    expect(team.players).toHaveLength(2);
    team = replacePlayer(team, typed.playerId, { ...mcdavid, playerId: 8479318, playerName: 'Auston Matthews', teamAbbrev: 'TOR' });
    expect(team.players.map((p) => p.playerId)).toEqual([8479318, 8478402]);
    team = removePlayer(team, 8478402);
    expect(team.players).toHaveLength(1);
    team = hidePickup(hidePickup(team, 1), 1);
    expect(team.hiddenPickupIds).toEqual([1]);
  });

  it('switches teams and enforces the free / pro team limits', () => {
    const a = createTeam({ name: 'A' });
    const b = createTeam({ name: 'B' });
    let state = upsertTeam(upsertTeam({ activeTeamId: null, teams: [] }, a), b);
    expect(activeTeamOf(state)?.name).toBe('A');
    state = deleteTeam(state, a.id);
    expect(activeTeamOf(state)?.name).toBe('B');
    expect(teamLimit(false)).toBe(1);
    expect(teamLimit(true)).toBe(5);
  });
});
