/**
 * Gathers what Tonight already knows (plus this week's plan, shared with the Week tab's cache)
 * and asks services/fantasy/nextUp for the one next step to offer.
 */

import { useMemo } from 'react';
import type { FantasyPlayer, FantasyTeam } from '../types/fantasy';
import { addDays } from '../services/nhl/dates';
import { matchupTagFor } from '../services/fantasy/matchupTag';
import { pickNextUp, type NextUpItem } from '../services/fantasy/nextUp';
import { useWeekData, type NightView } from './useCoach';

export interface NextUpArgs {
  team: FantasyTeam | null;
  view: NightView;
  night: 'tonight' | 'tomorrow';
  /** My players with a game on the viewed night, as Tonight lists them. */
  playing: FantasyPlayer[];
  isPro: boolean;
}

export function useNextUp({ team, view, night, playing, isPro }: NextUpArgs): NextUpItem | null {
  const week = useWeekData(team);
  const data = view.night.data;
  const forms = view.forms.data?.forms;
  const strength = view.forms.data?.teamStrength;
  const phase = night === 'tonight' ? view.score?.phase ?? null : null;

  return useMemo(() => {
    if (!team || !data) return null;
    const tomorrow = night === 'tonight' ? addDays(view.date, 1) : null;
    return pickNextUp({
      night,
      date: view.date,
      phase,
      emptySlots: view.day?.empty ?? [],
      playing: playing.flatMap((player) => {
        const game = data.playerGames[player.playerId];
        if (!game) return [];
        const form = forms?.get(player.playerId);
        return [{
          playerId: player.playerId,
          name: player.playerName,
          trend: form?.trend ?? null,
          opponent: `${game.isHome ? '' : '@'}${game.opponent}`,
          softMatchup: matchupTagFor(form, strength?.get(game.opponent))?.tone === 'good',
        }];
      }),
      tomorrowPlaying: tomorrow ? week.plan?.days.find((day) => day.date === tomorrow)?.playing.length ?? 0 : 0,
      weekLeft: week.plan ? { games: week.plan.remaining.games, starts: week.plan.remaining.starts } : null,
      matchup: week.matchup,
      isPro,
    });
  }, [team, data, night, view.date, view.day, phase, playing, forms, strength, week.plan, week.matchup, isPro]);
}
