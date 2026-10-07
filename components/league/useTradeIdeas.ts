/**
 * Trade ideas on demand (Pro). Asking loads form for every rostered player in the room plus this
 * week's and next week's schedules — a stats request per ~80 players — so nothing loads until the
 * member opens the finder; after that it's cached like every other form load.
 */

import { useMemo } from 'react';
import type { FantasyPlayer } from '../../types/fantasy';
import type { RoomSnapshot } from '../../types/league';
import { otherMembers } from '../../services/league';
import { loadPlayerForms, loadWeekSchedule, startSharesOf, valuesOf } from '../../services/fantasy/loaders';
import { addDays, mondayOf } from '../../services/nhl/dates';
import { useNhlToday } from '../../hooks/useCoach';
import { useResource, type Resource } from '../../hooks/useResource';
import { roomTradeIdeas, type RoomTradeIdea } from './tradeIdeas';

function idList(players: FantasyPlayer[]): string {
  return players
    .map((player) => player.playerId)
    .sort((a, b) => a - b)
    .join('.');
}

/** Changes only when a roster does (mine or a league-mate's), so room polls don't re-run the search. */
function rosterSignature(snapshot: RoomSnapshot, mine: FantasyPlayer[]): string {
  return [idList(mine), ...otherMembers(snapshot).map((member) => `${member.userId}:${idList(member.roster)}`)].join('|');
}

function uniquePlayers(players: FantasyPlayer[]): FantasyPlayer[] {
  const seen = new Set<number>();
  return players.filter((player) => {
    if (seen.has(player.playerId)) return false;
    seen.add(player.playerId);
    return true;
  });
}

/** Lets the loading state paint before the search, which runs synchronously on the JS thread. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function useTradeIdeas(snapshot: RoomSnapshot | null, mine: FantasyPlayer[], requested: boolean): Resource<RoomTradeIdea[]> {
  const today = useNhlToday();
  const signature = useMemo(() => (snapshot ? rosterSignature(snapshot, mine) : ''), [snapshot, mine]);
  const key = requested && snapshot ? `room-trades|${snapshot.room.id}|${today}|${signature}` : null;
  return useResource(key, async (force) => {
    if (!snapshot) return [];
    const monday = mondayOf(today);
    const everyone = uniquePlayers([...mine, ...otherMembers(snapshot).flatMap((member) => member.roster)]);
    const [forms, thisWeek, nextWeek] = await Promise.all([
      loadPlayerForms(everyone, snapshot.room.scoring, today, { force }),
      loadWeekSchedule(monday, { force }),
      loadWeekSchedule(addDays(monday, 7), { force }),
    ]);
    await nextFrame();
    return roomTradeIdeas({
      snapshot,
      mine,
      values: valuesOf(forms.forms),
      startShares: startSharesOf(forms.forms),
      schedules: [thisWeek, nextWeek],
      today,
    });
  });
}
