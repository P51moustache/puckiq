/**
 * The lineup call's reasons from a loaded night: Tonight and Lineup show the same "why" for the same call.
 */

import type { FantasyTeam } from '../types/fantasy';
import { lineupCallReasons, type CallReason } from '../services/fantasy/callReasons';
import type { FreeLineupCall } from '../services/fantasy/freeLineupCall';
import type { NightView } from './useCoach';

const NONE: CallReason[] = [];

export function nightCallReasons(view: Pick<NightView, 'night' | 'forms' | 'lineupValues' | 'goalieOutlooks'>, team: FantasyTeam | null, call: FreeLineupCall | null): CallReason[] {
  const games = view.night.data?.playerGames;
  if (!team || !call || !games) return NONE;
  return lineupCallReasons({
    call,
    players: team.players,
    games,
    values: view.lineupValues,
    forms: view.forms.data?.forms,
    strength: view.forms.data?.teamStrength,
    goalieOutlooks: view.goalieOutlooks,
  });
}
