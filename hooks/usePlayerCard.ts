/**
 * The player card's coaching layer: his week, the verdict on his next game, and similar players
 * who are probably available. Every load is one the tabs already make, so the cache is shared:
 * the week schedule, Tonight's team forms (opponent strength) and night (statuses, best lineup),
 * and the Pickups pool (same resource key as usePickups).
 */

import { useMemo } from 'react';
import type { FantasyTeam } from '../types/fantasy';
import type { PlayerForm } from '../services/fantasy/form';
import { loadPickupPool } from '../services/fantasy/loaders';
import type { PickupCandidate } from '../services/fantasy/pickups';
import { buildPlayerVerdict, playerWeek, type PlayerVerdict, type PlayerWeekDay, type RosterTonight } from '../services/fantasy/playerVerdict';
import { normalizePosition } from '../services/fantasy/positions';
import { similarPlayers } from '../services/fantasy/similarPlayers';
import { appNow, mondayOf } from '../services/nhl/dates';
import type { GameLogRow, PlayerProfile } from '../services/nhl/player';
import type { TeamStrength } from '../services/nhl/teams';
import { useNhlToday, useNight, useWeekSchedule } from './useCoach';
import { useResource } from './useResource';

export interface PlayerCardInput {
  playerId: number;
  /** Null until his profile loads. */
  profile: Pick<PlayerProfile, 'team' | 'position'> | null;
  form: PlayerForm | null;
  /** His form has loaded (or failed), so the verdict won't change under the reader. */
  formSettled: boolean;
  /** This season's games, newest first (empty when the log is last season's). */
  log: GameLogRow[];
  team: FantasyTeam | null;
  isPro: boolean;
  /** Players a League Room knows are rostered in this league (never suggested). */
  takenIds: ReadonlySet<number>;
}

export interface PlayerCard {
  /** His team's week, one entry per day; empty until the schedule loads. */
  week: PlayerWeekDay[];
  /** Opponent strength for matchup tags; undefined without a team or until it loads. */
  strength: Map<string, TeamStrength> | undefined;
  verdict: PlayerVerdict | null;
  /** The verdict's inputs are still loading (show a placeholder, not a call that will change). */
  verdictLoading: boolean;
  /** Up to three probably-available players like him; empty without a team. */
  similar: PickupCandidate[];
}

export function usePlayerCard({ playerId, profile, form, formSettled, log, team, isPro, takenIds }: PlayerCardInput): PlayerCard {
  const today = useNhlToday();
  const schedule = useWeekSchedule(mondayOf(today));
  const nhlTeam = profile?.team ?? '';
  const goalie = profile ? normalizePosition(profile.position) === 'G' : false;
  const week = schedule.data && nhlTeam ? playerWeek(schedule.data, nhlTeam, today, appNow().getTime()) : [];
  const playsTonight = week.some((day) => day.date === today && day.game !== null && !day.game.started);

  const rosterPlayer = team?.players.find((player) => player.playerId === playerId) ?? null;
  // Tonight's night (statuses, best lineup) can only change the call for my own player before
  // his game starts, so it loads (and polls with live games) only then. Its team forms are
  // Tonight's (same key) and carry the opponent strength behind the matchup tags.
  const nightNeeded = rosterPlayer !== null && playsTonight;
  const tonight = useNight(team, 0, nightNeeded);
  const strength = tonight.forms.data?.teamStrength;
  // The pool is the Pickups tab's whole list from the rate-limited stats API: start it once his
  // own form is in, so his numbers never queue behind it. Same key as usePickups, shared cache.
  const pool = useResource(
    team && formSettled ? `pool|${today}|${JSON.stringify(team.scoring)}` : null,
    (force) => loadPickupPool(today, team!.scoring, new Set<number>(), { force }),
  );

  const nightLoading = nightNeeded && tonight.night.loading;
  const verdictLoading = !!nhlTeam && (schedule.loading || tonight.forms.loading || nightLoading || !formSettled);
  const roster: RosterTonight | undefined = rosterPlayer
    ? {
        injuredReserve: rosterPlayer.injuredReserve === true,
        status: tonight.night.data?.statuses.get(playerId),
        slot: (tonight.bestDay ?? tonight.day)?.starters.find((seat) => seat.playerId === playerId)?.slot,
        benched: (tonight.bestDay ?? tonight.day)?.bench.includes(playerId) ?? false,
      }
    : undefined;
  const verdict = verdictLoading ? null : buildPlayerVerdict({ week, today, goalie, form, strength, log, isPro, roster });

  const position = profile?.position ?? '';
  // No NHL numbers at all (basis 'none'): nobody is "similar" to a blank.
  const value = form && form.basis !== 'none' ? form.value : null;
  const similar = useMemo(() => {
    if (!team || !pool.data || !position || value === null) return [];
    return similarPlayers({ player: { playerId, position, value }, candidates: pool.data.candidates, team, takenIds });
  }, [team, pool.data, position, value, playerId, takenIds]);

  return { week, strength, verdict, verdictLoading, similar };
}
