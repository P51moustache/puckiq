import type { CoachMove } from '../../services/fantasy/coach';
import type { FantasyPlayer } from '../../types/fantasy';
import type { PickupRow } from '../../services/fantasy/pickups';

export interface InsightPlayer {
  id: number;
  name: string;
  team: string;
  position: string;
  owned: boolean;
}

export interface InsightDetail {
  title: string;
  detail: string;
  players: InsightPlayer[];
  action: 'lineup' | 'pickups';
}

/** Present every affected roster player, in the coach move's order. */
export function detailForMove(
  move: CoachMove,
  roster: FantasyPlayer[],
): InsightDetail {
  const byId = new Map(roster.map((player) => [player.playerId, player]));
  return {
    title: move.title,
    detail: move.detail,
    action: move.kind === 'empty' ? 'pickups' : 'lineup',
    players: [...new Set(move.playerIds)].flatMap((id) => {
      const player = byId.get(id);
      return player
        ? [
            {
              id,
              name: player.playerName,
              team: player.teamAbbrev,
              position: player.position,
              owned: true,
            },
          ]
        : [];
    }),
  };
}

/** The card and detail sheet share the same real schedule assessment. */
export function detailForWaiver(
  player: Pick<
    PickupRow,
    | 'playerId'
    | 'name'
    | 'team'
    | 'position'
    | 'usableGames'
    | 'offNightGames'
    | 'emptyFills'
  >,
): InsightDetail {
  return {
    title: `Waiver target · ${player.name}`,
    detail: `${player.usableGames} usable games left this week, ${player.offNightGames} off-night games, and ${player.emptyFills} empty slots filled. Estimated availability; check your league.`,
    players: [
      {
        id: player.playerId,
        name: player.name,
        team: player.team,
        position: player.position,
        owned: false,
      },
    ],
    action: 'pickups',
  };
}
