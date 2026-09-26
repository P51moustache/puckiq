/**
 * Invisible: when signed in, merge cloud teams on first load, then back up edits.
 */

import { useEffect, useRef } from 'react';
import { mergeTeamsStates, pullTeams, pushTeams } from '../services/cloudBackup';
import { useAuthContext } from './auth/AuthProvider';
import { useTeams } from './TeamsProvider';

const PUSH_DELAY_MS = 2500;

export default function CloudSync() {
  const { user } = useAuthContext();
  const { ready, teams, team, replaceAll } = useTeams();
  const syncedFor = useRef<string | null>(null);
  const skipNextPush = useRef(false);

  // Pull + merge once per signed-in user.
  useEffect(() => {
    if (!ready || !user?.id || syncedFor.current === user.id) return;
    const userId = user.id;
    let cancelled = false;
    (async () => {
      try {
        const remote = await pullTeams(userId);
        if (cancelled) return;
        const local = { activeTeamId: team?.id ?? null, teams };
        const merged = remote ? mergeTeamsStates(local, remote) : local;
        syncedFor.current = userId;
        if (remote) {
          skipNextPush.current = true;
          replaceAll(merged);
        }
        await pushTeams(userId, merged);
      } catch (error) {
        console.warn('[CLOUD_SYNC] Initial sync failed:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run when the signed-in user changes or teams first become available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.id]);

  // Debounced backup after edits.
  useEffect(() => {
    if (!ready || !user?.id || syncedFor.current !== user.id) return;
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }
    const userId = user.id;
    const state = { activeTeamId: team?.id ?? null, teams };
    const timer = setTimeout(() => {
      pushTeams(userId, state).catch((error) => console.warn('[CLOUD_SYNC] Backup failed:', error));
    }, PUSH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ready, user?.id, teams, team?.id]);

  return null;
}
