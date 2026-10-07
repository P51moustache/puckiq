/**
 * The room's game-night board: for every member, who plays today, games that count left this
 * week, and tonight's live points. Pure — the screen feeds it the week's schedule, tonight's
 * box-score lines and the day's slate.
 */

import type { FantasyPlayer, LineupSlots, ScoringWeights } from '../../types/fantasy';
import type { RoomSnapshot } from '../../types/league';
import { assignLineup } from '../fantasy/lineup';
import { linePoints, teamWon } from '../fantasy/nightScore';
import { eligibleSlots, isNhlLinked } from '../fantasy/positions';
import type { GameLine } from '../nhl/gamecenter';
import { fantasyGamesOn, gameForTeam, isGameFinal, type NhlGame, type WeekSchedule } from '../nhl/schedule';
import { byTeamName } from './members';
import { uniformWeekPlan } from './plans';

export interface RoomBoardInput {
  snapshot: RoomSnapshot;
  /** This week, Monday–Sunday. */
  schedule: WeekSchedule;
  /** The NHL game day (YYYY-MM-DD). */
  today: string;
  /** Box-score lines for today's games (fetch the games in `boardGameIds`). Omit before puck drop. */
  lines?: Map<number, GameLine>;
  /**
   * Today's slate with live states and scores (e.g. `fetchDaySlate(today)`). A goalie's win and
   * shutout only count once his game is final; without the slate they aren't counted.
   */
  finals?: NhlGame[];
  scoring: ScoringWeights;
}

export interface RoomBoardRow {
  userId: string;
  teamName: string;
  isMe: boolean;
  /** Players with an NHL game today (IR excluded). */
  playingToday: number;
  /** How many of them fit in the lineup — the rest are overflow. */
  startersToday: number;
  /** Lineup slots filled from today through Sunday: the head-to-head currency. */
  gamesThatCountLeft: number;
  /** Tonight's points (see `bestLineupPoints`); null until there are box scores. */
  livePoints: number | null;
}

interface PointsContext {
  lines: Map<number, GameLine>;
  finals: NhlGame[];
  scoring: ScoringWeights;
  slots: LineupSlots;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function playerPoints(player: FantasyPlayer, context: PointsContext): number {
  const line = context.lines.get(player.playerId);
  if (!line) return 0;
  const game = gameForTeam(context.finals, player.teamAbbrev);
  const final = !!game && isGameFinal(game);
  const won = final && !!game && teamWon(game, player.teamAbbrev);
  return round1(linePoints(line, context.scoring, { final, won }));
}

/**
 * Tonight's points for one member: the best lineup from the players they have playing today.
 *
 * Why these starters: PuckIQ never reads the host, so nobody's real Yahoo / ESPN / Fantrax
 * lineup is known — and bench points never count there. Every team gets the same rule: fill the
 * slots with tonight's players, best scorers first (the engine's own lineup assignment, valued
 * by points so far). It never counts more players than the slots hold, never lets an arbitrary
 * tie-break bench a hat trick, and is the same "best lineup in hindsight" Tonight grades my own
 * night against. Players whose game hasn't started are worth 0 until it does.
 */
function bestLineupPoints(players: FantasyPlayer[], context: PointsContext): number {
  const points = new Map(players.map((player) => [player.playerId, playerPoints(player, context)]));
  const lineup = assignLineup(
    players.map((player) => ({ playerId: player.playerId, slots: eligibleSlots(player), value: points.get(player.playerId) ?? 0 })),
    context.slots,
  );
  return round1(lineup.starters.reduce((total, seat) => total + (points.get(seat.playerId) ?? 0), 0));
}

function boardOrder(live: boolean) {
  return (a: RoomBoardRow, b: RoomBoardRow): number =>
    (live ? (b.livePoints ?? Number.NEGATIVE_INFINITY) - (a.livePoints ?? Number.NEGATIVE_INFINITY) : 0) ||
    b.gamesThatCountLeft - a.gamesThatCountLeft ||
    byTeamName(a, b);
}

/**
 * One row per member, sorted by live points once any box score is in, otherwise by games that
 * count left (then team name). Games that count come from the uniform-value week plan, so no
 * form loads are needed for other teams.
 */
export function buildRoomBoard({ snapshot, schedule, today, lines, finals = [], scoring }: RoomBoardInput): RoomBoardRow[] {
  const live = !!lines && lines.size > 0;
  const { slots } = snapshot.room;
  const rows = snapshot.members.map((member): RoomBoardRow => {
    const plan = uniformWeekPlan({ schedule, roster: member.roster, slots, today });
    const day = plan.days.find((entry) => entry.date === today);
    const byId = new Map(member.roster.map((player) => [player.playerId, player]));
    const playing = (day?.playing ?? []).map((id) => byId.get(id)).filter((player): player is FantasyPlayer => !!player);
    return {
      userId: member.userId,
      teamName: member.teamName,
      isMe: member.userId === snapshot.me,
      playingToday: playing.length,
      startersToday: day?.starters.length ?? 0,
      gamesThatCountLeft: plan.remaining.starts,
      livePoints: live && lines ? bestLineupPoints(playing, { lines, finals, scoring, slots }) : null,
    };
  });
  return rows.sort(boardOrder(live));
}

/**
 * Today's games involving any room roster player (IR excluded) — the box scores the board needs.
 * Fetching only these keeps a busy night well under the NHL API's rate limits.
 */
export function boardGameIds(snapshot: RoomSnapshot, schedule: WeekSchedule, date: string): number[] {
  const day = schedule.days.find((entry) => entry.date === date);
  if (!day) return [];
  const games = fantasyGamesOn(day);
  const ids = new Set<number>();
  for (const member of snapshot.members) {
    for (const player of member.roster) {
      if (player.injuredReserve || !isNhlLinked(player)) continue;
      const game = gameForTeam(games, player.teamAbbrev);
      if (game) ids.add(game.id);
    }
  }
  return [...ids].sort((a, b) => a - b);
}
