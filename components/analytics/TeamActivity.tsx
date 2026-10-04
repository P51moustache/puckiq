import { useEffect, useRef } from 'react';
import type { TeamsState } from '../../types/fantasy';
import { teamChangeEvents } from '../../services/analytics/teamChanges';
import { track } from '../../services/analytics/track';
import { useTeams } from '../TeamsProvider';

/** Observe committed state, keeping side effects out of React state updaters. */
export function TeamActivity() {
  const { ready, teams, team } = useTeams();
  const previous = useRef<TeamsState | null>(null);
  useEffect(() => {
    if (!ready) return;
    const next = { teams, activeTeamId: team?.id ?? null };
    if (previous.current) {
      for (const { event, properties } of teamChangeEvents(previous.current, next)) track(event, properties);
    }
    previous.current = next;
  }, [ready, teams, team?.id]);
  return null;
}
