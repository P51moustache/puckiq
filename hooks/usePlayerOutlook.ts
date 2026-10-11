import type { PlayerProfile } from '../services/nhl/player';
import type { PlayerForm } from '../services/fantasy/form';
import { fetchTeamSchedule } from '../services/nhl/teamSchedule';
import { fetchTeamStrength } from '../services/nhl/teams';
import { appNow, seasonIdFor } from '../services/nhl/dates';
import {
  estimateRemainingSeason,
  remainingTeamGames,
  upcomingAssessments,
} from '../services/fantasy/playerOutlook';
import { useNhlToday } from './useCoach';
import { useResource } from './useResource';

export function usePlayerOutlook(
  profile: PlayerProfile | null,
  form: PlayerForm | null,
) {
  const today = useNhlToday();
  const team = profile?.team ?? '';
  const schedule = useResource(
    team ? `season-schedule|${team}|${seasonIdFor(today)}` : null,
    (force) => fetchTeamSchedule(team, seasonIdFor(today), force),
  );
  const strength = useResource(team ? `strength|${today}` : null, () =>
    fetchTeamStrength(today),
  );
  const remaining = remainingTeamGames(
    schedule.data ?? [],
    today,
    appNow().getTime(),
  );
  return {
    loading: schedule.loading || strength.loading,
    error: schedule.error ?? strength.error,
    estimate: schedule.data
      ? estimateRemainingSeason(form, remaining.length)
      : null,
    upcoming: upcomingAssessments(
      remaining,
      team,
      strength.data ?? new Map(),
      profile?.position === 'G',
    ),
    strength: strength.data ?? undefined,
    refresh: async () => {
      await Promise.all([schedule.refresh(), strength.refresh()]);
    },
  };
}
