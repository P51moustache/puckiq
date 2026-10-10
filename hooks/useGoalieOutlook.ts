/**
 * Start outlooks for Tonight's goalie rows: for the active team's goalies who play on `date`,
 * likely / split / unlikely with one reason (services/fantasy/goalieOutlook). Estimates only —
 * the NHL names starters at puck drop. Empty until the forms and the night's back-to-back read
 * load, and a goalie they don't cover has no entry, so his row shows what it showed before.
 */

import { useMemo } from 'react';
import type { FantasyTeam } from '../types/fantasy';
import { goalieRefs, nightOutlooks, type GoalieOutlook, type OutlookNight } from '../services/fantasy/goalieOutlook';
import { addDays } from '../services/nhl/dates';
import { loadGoalieNights } from '../services/nhl/goalieStarts';
import { goaliesKey, useNhlToday, useTeamForms } from './useTeamData';
import { useResource } from './useResource';

const NONE: ReadonlyMap<number, GoalieOutlook> = new Map();

/** Tomorrow's first night is today, so its reasons say "today", not "last night". */
function outlookNight(date: string, today: string): OutlookNight {
  return date === addDays(today, 1) ? 'tomorrow' : 'tonight';
}

/** Player id → his outlook on `date` (an NHL date, e.g. Tonight's `view.date`). */
export function useGoalieOutlook(team: FantasyTeam | null, date: string): ReadonlyMap<number, GoalieOutlook> {
  const today = useNhlToday();
  // Same key as Tonight's and the Week tab's forms, so the stats requests are shared.
  const forms = useTeamForms(team, today, true);
  const goalies = useMemo(() => goalieRefs(team?.players ?? []), [team]);
  const key = goalies.length > 0 ? `goalie-night|${date}|${today}|${goaliesKey(goalies)}` : null;
  // The date rides along: after a switch to another night, the last night's read never shows.
  const nights = useResource(key, async (force) => ({ date, nights: await loadGoalieNights(goalies, date, today, { force }) }));

  const loaded = nights.data?.date === date ? nights.data.nights : null;
  const formsById = forms.data?.forms;
  return useMemo(
    () => (loaded && formsById ? nightOutlooks(loaded, formsById, outlookNight(date, today)) : NONE),
    [loaded, formsById, date, today],
  );
}
