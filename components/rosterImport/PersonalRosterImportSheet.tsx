import React from 'react';
import { hasSamplePlayers, withoutSample } from '../../constants/sampleTeam';
import { track } from '../../services/analytics/track';
import { useTeams } from '../TeamsProvider';
import { RosterImportSheet, type RosterImportSource } from './RosterImportSheet';

/** Importing over a demo keeps matched sample stars and removes the remaining demo roster. */
export function PersonalRosterImportSheet({ visible, onClose, source = 'roster' }: { visible: boolean; onClose: () => void; source?: RosterImportSource }) {
  const { team, updateTeam } = useTeams();
  const sample = hasSamplePlayers(team);
  return (
    <RosterImportSheet key={team?.id} visible={visible} source={sample ? 'sample' : source} mode={!sample && team?.players.length ? 'reconcile' : 'add'} onClose={onClose} onAdded={sample ? (ids) => {
      track('sample_team_cleared', { kept: ids.length, via: 'import' });
      updateTeam((current) => current.id === team?.id ? withoutSample(current, new Set(ids)) : current);
    } : undefined} />
  );
}
