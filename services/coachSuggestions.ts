/**
 * Honest coach: sit / start / drop from MY roster + public NHL signals only.
 * Matchup (has a game) + injury/scratch. Not a neural net.
 */

import type { TonightPlayerStatus } from '../types/fantasy';

export type CoachAction = 'START' | 'SIT' | 'DROP';

export interface CoachSuggestion {
  id: string;
  action: CoachAction;
  playerId: number;
  playerName: string;
  detail: string;
}

export function buildCoachSuggestions(statuses: TonightPlayerStatus[]): CoachSuggestion[] {
  const drops: CoachSuggestion[] = [];
  const sits: CoachSuggestion[] = [];
  const starts: TonightPlayerStatus[] = [];
  const off: TonightPlayerStatus[] = [];

  for (const row of statuses) {
    if (row.injurySignal === 'out') {
      drops.push({
        id: `drop-${row.playerId}`,
        action: 'DROP',
        playerId: row.playerId,
        playerName: row.playerName,
        detail: 'Out / IR — drop or park on IR',
      });
      continue;
    }
    if (row.injurySignal === 'scratch') {
      sits.push({
        id: `sit-${row.playerId}`,
        action: 'SIT',
        playerId: row.playerId,
        playerName: row.playerName,
        detail: 'Scratched tonight',
      });
      continue;
    }
    if (row.recommendation === 'SIT' && row.opponentAbbrev) {
      sits.push({
        id: `sit-${row.playerId}`,
        action: 'SIT',
        playerId: row.playerId,
        playerName: row.playerName,
        detail: row.reason,
      });
      continue;
    }
    if (row.recommendation === 'START') {
      starts.push(row);
      continue;
    }
    if (!row.opponentAbbrev) {
      off.push(row);
    }
  }

  const suggestions = [...drops, ...sits];

  if (starts[0] && (drops.length > 0 || sits.length > 0 || off.length > 0)) {
    const contrast = drops[0] ?? sits[0];
    const vsOff = !contrast && off[0] ? off[0].playerName : contrast?.playerName;
    suggestions.push({
      id: `start-${starts[0].playerId}`,
      action: 'START',
      playerId: starts[0].playerId,
      playerName: starts[0].playerName,
      detail: vsOff
        ? `Playing tonight — start over ${vsOff}`
        : starts[0].reason,
    });
  }

  if (suggestions.length === 0 && starts[0]) {
    suggestions.push({
      id: `start-${starts[0].playerId}`,
      action: 'START',
      playerId: starts[0].playerId,
      playerName: starts[0].playerName,
      detail: starts[0].reason,
    });
  }

  return suggestions;
}

/** Free sees one sample. Pro sees the full coach list. */
export function visibleCoachSuggestions(
  suggestions: CoachSuggestion[],
  isPremium: boolean,
): CoachSuggestion[] {
  if (isPremium) return suggestions;
  return suggestions.slice(0, 1);
}

/** v1 never writes the host lineup. Tell them what to change in their app. */
export const LINEUP_HOST_NOTE =
  'Change this in Yahoo or ESPN. PuckIQ never writes your lineup.';

/** Last-minute scratches are a physics problem. Do not promise earlier than the NHL. */
export const NHL_TIMING_NOTE =
  'We do not beat the NHL to last-minute scratches. Quieter, personal, on time.';

export const COACH_ALERT_COPY = [
  {
    id: 'goalie',
    title: 'Your goalie isn’t confirmed',
    body: 'Alert before that start locks. Sit or flex until the NHL posts the starter.',
  },
  {
    id: 'scratch',
    title: 'Your winger is a scratch',
    body: 'When the NHL posts it, we tell you before that game locks — not the whole league.',
  },
  {
    id: 'stream',
    title: 'Better stream available',
    body: 'A roster mate has a game — start them over an off-night or injury. Change it in Yahoo or ESPN.',
  },
] as const;
