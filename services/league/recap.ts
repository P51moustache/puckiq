/**
 * The Monday recap card for a finished week (Mon–Sun): per member, games that counted, games
 * lost to the bench and empty slot-days, plus three awards. Pure and schedule-based — no box
 * scores. Rosters are today's: the room keeps no history, so a mid-week add counts as if he'd
 * been there all week.
 */

import type { LineupSlots } from '../../types/fantasy';
import type { RoomSnapshot } from '../../types/league';
import { addDays } from '../nhl/dates';
import type { WeekSchedule } from '../nhl/schedule';
import { byTeamName } from './members';
import { uniformWeekPlan } from './plans';

export interface RoomWeekRecapInput {
  snapshot: RoomSnapshot;
  /** The finished week. */
  schedule: WeekSchedule;
  slots: LineupSlots;
}

export interface RecapMember {
  userId: string;
  teamName: string;
  isMe: boolean;
  /** Games that filled a lineup slot. */
  gamesThatCounted: number;
  /** Games played with every eligible slot already full (overflow). */
  gamesLostToBench: number;
  /** Lineup slots left empty on nights with NHL games. */
  emptySlotDays: number;
  /** Members with no roster in the room get no awards. */
  hasRoster: boolean;
}

export interface RecapAward {
  /** Everyone tied for it, by team name. */
  winners: { userId: string; teamName: string }[];
  value: number;
}

export interface RoomWeekRecap {
  monday: string;
  /** Most games that counted first, then team name. */
  members: RecapMember[];
  awards: {
    mostGamesThatCount: RecapAward | null;
    benchOfShame: RecapAward | null;
    emptiestLineup: RecapAward | null;
  };
  headline: string;
}

/** Highest value wins; ties share it. No award when nobody reached 1. */
function award(members: RecapMember[], valueOf: (member: RecapMember) => number): RecapAward | null {
  const eligible = members.filter((member) => member.hasRoster);
  const best = Math.max(0, ...eligible.map(valueOf));
  if (best <= 0) return null;
  const winners = eligible
    .filter((member) => valueOf(member) === best)
    .sort(byTeamName)
    .map(({ userId, teamName }) => ({ userId, teamName }));
  return { winners, value: best };
}

function gamesPhrase(count: number): string {
  return `${count} ${count === 1 ? 'game' : 'games'} that counted`;
}

function headlineFor(leader: RecapAward | null): string {
  if (!leader) return 'No games counted this week.';
  const names = leader.winners.map((winner) => winner.teamName);
  if (names.length === 1) return `${names[0]} led the room with ${gamesPhrase(leader.value)}.`;
  if (names.length === 2) return `${names[0]} and ${names[1]} tied for the lead with ${gamesPhrase(leader.value)}.`;
  return `${names.length} teams tied for the lead with ${gamesPhrase(leader.value)}.`;
}

export function buildRoomWeekRecap({ snapshot, schedule, slots }: RoomWeekRecapInput): RoomWeekRecap {
  // Plan as of the Monday after, so every day is past and `week` totals are the whole week.
  const after = addDays(schedule.monday, 7);
  const members = snapshot.members
    .map((member): RecapMember => {
      const { week } = uniformWeekPlan({ schedule, roster: member.roster, slots, today: after });
      return {
        userId: member.userId,
        teamName: member.teamName,
        isMe: member.userId === snapshot.me,
        gamesThatCounted: week.starts,
        gamesLostToBench: week.benched,
        emptySlotDays: week.emptySlots,
        hasRoster: member.roster.length > 0,
      };
    })
    .sort((a, b) => b.gamesThatCounted - a.gamesThatCounted || byTeamName(a, b));

  const mostGamesThatCount = award(members, (member) => member.gamesThatCounted);
  return {
    monday: schedule.monday,
    members,
    awards: {
      mostGamesThatCount,
      benchOfShame: award(members, (member) => member.gamesLostToBench),
      emptiestLineup: award(members, (member) => member.emptySlotDays),
    },
    headline: headlineFor(mostGamesThatCount),
  };
}
