/**
 * What Tonight's share cards say: tonight's lineup before lock, last night's result after
 * (points, or a category league's tallies).
 */

import type { FantasyPlayer, FantasyTeam } from '../../types/fantasy';
import type { NightData } from '../../services/fantasy/loaders';
import type { PlayerForm } from '../../services/fantasy/form';
import { headlinePoints, headlineRows, type NightScore } from '../../services/fantasy/nightScore';
import { nightTallies, talliesLine, tileLineText } from '../../services/fantasy/nightTallies';
import { performerLine, recapLeaders } from '../../services/fantasy/recap';
import { formatValue } from '../../services/fantasy/scoring';
import { isCategoryLeague } from '../../services/fantasy/categories';
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

/** Tallies after the lead one in a category recap's caption; more wraps past the card's count row. */
const CAPTION_TALLIES = 5;

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
  const tallies = isCategoryLeague(team) ? nightTallies(headlineRows(score, isPro), data.liveLines, team.categories ?? []) : [];
  const [lead, ...rest] = tallies;
  return {
    kind: 'recap',
    kicker: `LAST NIGHT · ${niceDate(data.date).toUpperCase()}`,
    teamName: team.name,
    count: lead ? lead.text : formatValue(headlinePoints(score, isPro)),
    countSuffix: lead ? lead.short : 'PTS',
    caption: lead ? talliesLine(rest, CAPTION_TALLIES) : performerLine(top, byId.get(top.playerId), data.liveLines.get(top.playerId)),
    players: leaders.map((row) => {
      const player = byId.get(row.playerId);
      const line = data.liveLines.get(row.playerId);
      return {
        playerId: row.playerId,
        name: player?.playerName ?? '',
        team: player?.teamAbbrev ?? '',
        position: player?.position ?? '',
        detail: lead ? (line ? tileLineText(line) : undefined) : `${formatValue(row.points ?? 0)} PTS`,
      };
    }),
  };
}
