/**
 * What the home-screen widgets and the Live Activity show, built from the same night data and
 * score as Tonight. Pure: the publisher hook decides when to send it to the native side.
 */

import type { FantasyTeam } from '../../types/fantasy';
import type { NightData } from '../fantasy/loaders';
import { isNhlLinked } from '../fantasy/positions';
import { gameClockText, headlinePoints, lineText, type NightScore } from '../fantasy/nightScore';
import { isGameStarted } from '../nhl/schedule';
import type { LiveActivityState, WidgetSnapshot } from '../native/widgetBridge';

/** The medium widget lists four; eight leaves room for a future large size. */
export const MAX_WIDGET_PLAYERS = 8;

function lastName(name: string): string {
  return name.trim().split(/\s+/).slice(-1)[0] ?? name;
}

function topOf(score: NightScore, night: NightData, team: FantasyTeam): { name: string; line: string } | null {
  if (!score.top) return null;
  const player = team.players.find((row) => row.playerId === score.top!.playerId);
  const line = night.liveLines.get(score.top.playerId);
  if (!player) return null;
  return { name: lastName(player.playerName), line: line ? lineText(line) : '' };
}

export function buildWidgetSnapshot(input: {
  team: FantasyTeam;
  night: NightData;
  score: NightScore | null;
  isPro: boolean;
  now: Date;
}): WidgetSnapshot {
  const { team, night, score, isPro, now } = input;
  const roster = team.players.filter((player) => !player.injuredReserve && isNhlLinked(player));
  const playing = roster
    .filter((player) => night.playerGames[player.playerId])
    .map((player) => ({ player, game: night.playerGames[player.playerId]! }))
    .sort((a, b) => (a.game.startTimeUTC ?? '').localeCompare(b.game.startTimeUTC ?? '') || a.player.playerId - b.player.playerId);
  const gamesById = new Map(night.games.map((game) => [game.id, game]));
  const firstPuckUTC = playing
    .map(({ game }) => gamesById.get(game.gameId) ?? game)
    .filter((game) => !isGameStarted(game))
    .map((game) => game.startTimeUTC)
    .filter((time): time is string => !!time)
    .sort()[0] ?? null;

  return {
    updatedAt: now.toISOString(),
    date: night.date,
    teamName: team.name,
    playing: playing.length,
    total: roster.length,
    firstPuckUTC,
    players: playing.slice(0, MAX_WIDGET_PLAYERS).map(({ player, game }) => ({
      name: player.playerName,
      team: player.teamAbbrev,
      opponent: game.opponent,
      home: game.isHome,
      startUTC: game.startTimeUTC,
    })),
    live: score && score.phase !== 'pre'
      ? {
          points: headlinePoints(score, isPro),
          live: score.live,
          final: score.final,
          upcoming: score.upcoming,
          top: topOf(score, night, team),
        }
      : null,
  };
}

/** The Live Activity's dynamic state; null before puck drop (nothing to follow yet). */
export function buildLiveActivityState(input: {
  team: FantasyTeam;
  night: NightData;
  score: NightScore | null;
  isPro: boolean;
}): LiveActivityState | null {
  const { team, night, score, isPro } = input;
  if (!score || score.phase === 'pre') return null;
  const top = topOf(score, night, team);
  return {
    points: headlinePoints(score, isPro),
    live: score.live,
    final: score.final,
    upcoming: score.upcoming,
    topName: top?.name ?? null,
    topLine: top?.line || null,
    clock: score.phase === 'final' ? 'Final' : score.leadGame ? gameClockText(score.leadGame) : null,
  };
}
