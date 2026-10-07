/**
 * What Tonight's share cards say: tonight's lineup before lock, last night's result after.
 */

import type { FantasyPlayer, FantasyTeam } from '../../types/fantasy';
import type { NightData } from '../../services/fantasy/loaders';
import type { PlayerForm } from '../../services/fantasy/form';
import { headlinePoints, type NightScore } from '../../services/fantasy/nightScore';
import { performerLine, recapLeaders } from '../../services/fantasy/recap';
import { formatValue } from '../../services/fantasy/scoring';
import type { ShareCardContent } from '../share/ShareCards';
import { niceDate } from './nightText';

export function tonightShareContent(input: {
  team: FantasyTeam;
  data: NightData;
  date: string;
  playing: FantasyPlayer[];
  total: number;
  forms: Map<number, PlayerForm> | undefined;
  when: 'tonight' | 'tomorrow';
}): ShareCardContent | null {
  const { team, data, date, playing, total, forms, when } = input;
  if (playing.length === 0) return null;
  return {
    kind: 'tonight',
    kicker: niceDate(date).toUpperCase(),
    teamName: team.name,
    count: playing.length,
    countSuffix: `OF ${total}`,
    caption: when === 'tonight' ? 'playing tonight' : 'playing tomorrow',
    players: [...playing]
      .sort((a, b) => (forms?.get(b.playerId)?.value ?? 0) - (forms?.get(a.playerId)?.value ?? 0))
      .map((player) => {
        const game = data.playerGames[player.playerId];
        return {
          playerId: player.playerId,
          name: player.playerName,
          team: player.teamAbbrev,
          position: player.position,
          detail: game ? `${game.isHome ? 'vs' : '@'} ${game.opponent}` : undefined,
        };
      }),
  };
}

export function recapShareContent(input: {
  team: FantasyTeam;
  data: NightData;
  score: NightScore;
  isPro: boolean;
}): ShareCardContent | null {
  const { team, data, score, isPro } = input;
  const leaders = recapLeaders(score);
  if (leaders.length === 0) return null;
  const byId = new Map(team.players.map((player) => [player.playerId, player]));
  const top = leaders[0];
  return {
    kind: 'recap',
    kicker: `LAST NIGHT · ${niceDate(data.date).toUpperCase()}`,
    teamName: team.name,
    count: formatValue(headlinePoints(score, isPro)),
    countSuffix: 'PTS',
    caption: performerLine(top, byId.get(top.playerId), data.liveLines.get(top.playerId)),
    players: leaders.map((row) => {
      const player = byId.get(row.playerId);
      return {
        playerId: row.playerId,
        name: player?.playerName ?? '',
        team: player?.teamAbbrev ?? '',
        position: player?.position ?? '',
        detail: `${formatValue(row.points ?? 0)} PTS`,
      };
    }),
  };
}
