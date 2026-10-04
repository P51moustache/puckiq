import type { FantasyTeam, TeamsState } from '../../types/fantasy';
import type { UsageProperties } from './usageJourney';

export interface TeamChangeEvent { event: string; properties: UsageProperties }

/** Only counts and settings categories leave the device; never IDs, names, or rosters. */
export function teamChangeEvents(before: TeamsState, after: TeamsState): TeamChangeEvent[] {
  const events: TeamChangeEvent[] = [];
  const add = (event: string, properties: UsageProperties = {}) => events.push({ event, properties });
  if (before.activeTeamId !== after.activeTeamId && after.activeTeamId) add('team_switch', { teams: after.teams.length });
  const removed = before.teams.filter(team => !after.teams.some(next => next.id === team.id)).length;
  if (removed) add('team_remove', { count: removed, teams: after.teams.length });
  for (const next of after.teams) {
    const previous = before.teams.find(team => team.id === next.id);
    if (!previous) continue;
    for (const list of ['players', 'opponent'] as const) {
      const oldIds = new Set(previous[list].map(player => player.playerId));
      const newIds = new Set(next[list].map(player => player.playerId));
      const added = [...newIds].filter(id => !oldIds.has(id)).length;
      const removed = [...oldIds].filter(id => !newIds.has(id)).length;
      if (added || removed) add('roster_edit', { list, added, removed, total: next[list].length });
      const settingsChanged = next[list].filter(player => {
        const old = previous[list].find(row => row.playerId === player.playerId);
        return old && (old.rosterPosition !== player.rosterPosition || old.injuredReserve !== player.injuredReserve || JSON.stringify(old.eligible) !== JSON.stringify(player.eligible));
      }).length;
      if (settingsChanged) add('player_settings_edit', { list, count: settingsChanged });
    }
    for (const field of ['platform', 'leagueSize', 'minGoalieStarts', 'slots', 'scoring'] as const) {
      if (changed(previous, next, field)) add('league_settings_edit', { field });
    }
    if (changed(previous, next, 'hiddenPickupIds')) add('pickup_availability_edit', { hidden: next.hiddenPickupIds.length });
    if (previous.name !== next.name) add('team_rename');
    if (previous.opponentName !== next.opponentName) add('opponent_rename');
  }
  return events;
}

function changed(before: FantasyTeam, after: FantasyTeam, field: keyof FantasyTeam): boolean {
  return JSON.stringify(before[field]) !== JSON.stringify(after[field]);
}
