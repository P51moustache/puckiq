/**
 * The Monday recap as a share card for the league's group chat: the room's name, the winning
 * number of games that counted, the headline, and the leader's players who started most.
 */

import type { RoomSnapshot } from '../../types/league';
import type { WeekSchedule } from '../../services/nhl/schedule';
import { addDays, shortDate } from '../../services/nhl/dates';
import { uniformWeekPlan, type RoomWeekRecap } from '../../services/league';
import type { ShareCardContent, ShareCardPlayer } from '../share/ShareCards';
import { countText } from './format';

/** The leader's roster, most starts first (starts = games that filled a lineup slot). */
function leaderPlayers(snapshot: RoomSnapshot, userId: string, schedule: WeekSchedule): ShareCardPlayer[] {
  const member = snapshot.members.find((row) => row.userId === userId);
  if (!member) return [];
  // Planned as of the Monday after, like the recap, so every day of the week counts.
  const plan = uniformWeekPlan({ schedule, roster: member.roster, slots: snapshot.room.slots, today: addDays(schedule.monday, 7) });
  return member.roster
    .map((player) => ({ player, starts: plan.players[player.playerId]?.starts ?? 0 }))
    .filter(({ starts }) => starts > 0)
    .sort((a, b) => b.starts - a.starts || a.player.playerName.localeCompare(b.player.playerName))
    .map(({ player, starts }) => ({
      playerId: player.playerId,
      name: player.playerName,
      team: player.teamAbbrev,
      position: player.position,
      detail: countText(starts, 'start'),
    }));
}

/** Null when nobody had a game that counted (no card worth sharing). */
export function roomRecapShareContent(recap: RoomWeekRecap, snapshot: RoomSnapshot, schedule: WeekSchedule): ShareCardContent | null {
  const lead = recap.awards.mostGamesThatCount;
  if (!lead || lead.winners.length === 0) return null;
  return {
    kind: 'room',
    kicker: `WEEK OF ${shortDate(recap.monday).toUpperCase()}`,
    teamName: snapshot.room.name,
    count: lead.value,
    countSuffix: 'GAMES',
    caption: recap.headline,
    players: leaderPlayers(snapshot, lead.winners[0].userId, schedule),
  };
}
