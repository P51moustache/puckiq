/**
 * A category league's tallies for one night, or null in a points league (or before there is a
 * score). Same players as the night's headline: the lineup for Pro, everyone who played for free.
 */

import { useMemo } from 'react';
import type { FantasyTeam } from '../types/fantasy';
import { headlineRows, type NightScore } from '../services/fantasy/nightScore';
import { nightTallies, type CategoryTally } from '../services/fantasy/nightTallies';
import { isCategoryLeague } from '../services/fantasy/categories';
import type { GameLine } from '../services/nhl/gamecenter';

export function useNightTallies(
  team: FantasyTeam | null,
  score: NightScore | null,
  lines: Map<number, GameLine> | undefined,
  isPro: boolean,
): CategoryTally[] | null {
  const categories = isCategoryLeague(team) ? team?.categories ?? null : null;
  return useMemo(
    () => (categories && score && lines ? nightTallies(headlineRows(score, isPro), lines, categories) : null),
    [categories, score, lines, isPro],
  );
}
