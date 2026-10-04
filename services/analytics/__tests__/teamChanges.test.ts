import { createTeam } from '../../teams';
import { teamChangeEvents } from '../teamChanges';
import type { FantasyPlayer, FantasyTeam, TeamsState } from '../../../types/fantasy';

const player: FantasyPlayer = { playerId: 123, playerName: 'Private imported name', position: 'C', rosterPosition: 'BN', teamAbbrev: 'EDM' };
const state = (team: FantasyTeam): TeamsState => ({ teams: [team], activeTeamId: team.id });

describe('anonymous team activity', () => {
  it('reports additions, removals and player settings without transmitting the roster', () => {
    const team = createTeam({ name: 'Private league name', players: [player] });
    const next = { ...team, players: [{ ...player, rosterPosition: 'C' as const }, { ...player, playerId: 456 }] };
    const events = teamChangeEvents(state(team), state(next));
    expect(events).toEqual([
      { event: 'roster_edit', properties: { list: 'players', added: 1, removed: 0, total: 2 } },
      { event: 'player_settings_edit', properties: { list: 'players', count: 1 } },
    ]);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain('Private');
    expect(serialized).not.toContain(team.id);
    expect(serialized).not.toContain('123');
    expect(teamChangeEvents(state(next), state(team))[0]).toMatchObject({ properties: { added: 0, removed: 1 } });
  });

  it('reports opponent, availability and league settings changes using fixed categories', () => {
    const team = createTeam({ players: [player] });
    const next = { ...team, leagueSize: 14, opponent: [player], opponentName: 'Private opponent', hiddenPickupIds: [456] };
    const events = teamChangeEvents(state(team), state(next));
    expect(events.map(event => event.event)).toEqual(['roster_edit', 'league_settings_edit', 'pickup_availability_edit', 'opponent_rename']);
    expect(JSON.stringify(events)).not.toContain('Private');
    expect(JSON.stringify(events)).not.toContain('456');
  });

  it('ignores initial team creation and unchanged data, and reports team removal and switching', () => {
    const a = createTeam({ name: 'A' });
    const b = createTeam({ name: 'B' });
    expect(teamChangeEvents({ teams: [], activeTeamId: null }, { teams: [a], activeTeamId: null })).toEqual([]);
    expect(teamChangeEvents(state(a), state(a))).toEqual([]);
    expect(teamChangeEvents({ teams: [a, b], activeTeamId: a.id }, state(b))).toEqual([
      { event: 'team_switch', properties: { teams: 1 } },
      { event: 'team_remove', properties: { count: 1, teams: 1 } },
    ]);
  });
});
