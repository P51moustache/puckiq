import type { FantasyPlayer, RosterNewsItem, ScoringWeights } from '../types/fantasy';
import { fetchRosterNews } from '../services/rosterNews';
import { loadPlayerForms } from '../services/fantasy/loaders';
import type { PlayerForm } from '../services/fantasy/form';
import { previousSeasonId, seasonIdFor } from '../services/nhl/dates';
import { fetchPlayerGameLog, fetchPlayerProfile, type PlayerGameLog, type PlayerProfile } from '../services/nhl/player';
import { useNhlToday } from './useCoach';
import { useResource, type Resource } from './useResource';

export interface PlayerDetail {
  profile: PlayerProfile;
  log: PlayerGameLog | null;
  form: PlayerForm | null;
  /** True when the log is last season's (before this season's first game). */
  logIsPrevious: boolean;
  /** ESPN headlines that mention him (shown as-is, linked, credited). */
  news: RosterNewsItem[];
}

interface CoreDetail {
  profile: PlayerProfile;
  log: PlayerGameLog | null;
  logIsPrevious: boolean;
  news: RosterNewsItem[];
}

/**
 * Profile + game log (fast, api-web) render first; the stats-API form fills in after,
 * so a busy stats API never blanks the whole sheet.
 */
export function usePlayerDetail(playerId: number | null, scoring: ScoringWeights): Resource<PlayerDetail> {
  const today = useNhlToday();

  const core = useResource<CoreDetail>(playerId ? `player|${playerId}|${today}` : null, async (force) => {
    const id = playerId as number;
    const profile = await fetchPlayerProfile(id);
    const seasonId = seasonIdFor(today);
    const asRosterPlayer: FantasyPlayer = {
      playerId: id,
      playerName: profile.name,
      teamAbbrev: profile.team,
      position: profile.position,
      rosterPosition: 'BN',
    };
    const [current, news] = await Promise.all([
      fetchPlayerGameLog(id, seasonId, { force }).catch(() => null),
      fetchRosterNews([asRosterPlayer]).catch(() => [] as RosterNewsItem[]),
    ]);
    let log = current;
    let logIsPrevious = false;
    if (!log || log.games.filter((game) => game.date < today).length === 0) {
      log = await fetchPlayerGameLog(id, previousSeasonId(seasonId)).catch(() => null);
      logIsPrevious = !!log && log.games.length > 0;
    }
    // Only games already played (matters when "today" is pinned in dev builds).
    if (log) log = { ...log, games: log.games.filter((game) => game.date < today || logIsPrevious) };
    return { profile, log, logIsPrevious, news: news.slice(0, 5) };
  });

  const profile = core.data?.profile ?? null;
  const formKey = profile ? `playerform|${profile.playerId}|${profile.team}|${profile.position}|${today}|${JSON.stringify(scoring)}` : null;
  const form = useResource<PlayerForm | null>(formKey, async (force) => {
    const asRosterPlayer: FantasyPlayer = {
      playerId: profile!.playerId,
      playerName: profile!.name,
      teamAbbrev: profile!.team,
      position: profile!.position,
      rosterPosition: 'BN',
    };
    const forms = await loadPlayerForms([asRosterPlayer], scoring, today, { force });
    return forms.forms.get(profile!.playerId) ?? null;
  });

  return {
    data: core.data ? { ...core.data, form: form.data ?? null } : null,
    error: core.error,
    loading: core.loading,
    refreshing: core.refreshing || form.refreshing,
    refresh: async () => {
      await Promise.all([core.refresh(), form.refresh()]);
    },
  };
}
