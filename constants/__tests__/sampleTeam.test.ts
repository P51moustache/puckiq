import { hasSamplePlayers, SAMPLE_PLAYERS, SAMPLE_TEAM_NAME, sampleCount, withoutSample } from '../sampleTeam';
import type { FantasyPlayer, FantasyTeam } from '../../types/fantasy';

const own: FantasyPlayer = { playerId: 8478882, playerName: 'Vladislav Gavrikov', teamAbbrev: 'NYR', position: 'D', rosterPosition: 'BN' };

const team = (players: FantasyPlayer[], name = 'Oilers') => ({ id: 't1', name, players, updatedAt: '2026-09-26T00:00:00Z' }) as unknown as FantasyTeam;

describe('sample team', () => {
  it('spots the sample roster even under a name the user typed', () => {
    const mixed = team([...SAMPLE_PLAYERS, own]);
    expect(sampleCount(mixed.players)).toBe(16);
    expect(hasSamplePlayers(mixed)).toBe(true);
  });

  it('leaves a real roster with a few of the same stars alone', () => {
    expect(hasSamplePlayers(team([...SAMPLE_PLAYERS.slice(0, 3), own]))).toBe(false);
    expect(hasSamplePlayers(null)).toBe(false);
  });

  it('removes only the sample players and keeps the user’s own', () => {
    const cleared = withoutSample(team([...SAMPLE_PLAYERS, own]));
    expect(cleared.players).toEqual([own]);
    expect(cleared.name).toBe('Oilers');
  });

  it('drops the sample name so the team reads as the user’s', () => {
    expect(withoutSample(team(SAMPLE_PLAYERS, SAMPLE_TEAM_NAME)).name).toBe('My Team');
  });
});
