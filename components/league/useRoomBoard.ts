/**
 * Live inputs for the game-night board: this week's schedule (shared with the Week tab), today's
 * slate, and box scores for only the games the room's players are in (`boardGameIds`), only once
 * they start. It polls only while the board is on screen and a room game is live or about to drop
 * the puck, which keeps a busy night well inside the NHL API's limits.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import type { RoomSnapshot } from '../../types/league';
import { boardGameIds, buildRoomBoard, type RoomBoardRow } from '../../services/league';
import { fetchGameLines, type GameLine } from '../../services/nhl/gamecenter';
import { fetchDaySlate, isGameFinal, isGameStarted, type NhlGame } from '../../services/nhl/schedule';
import { mondayOf } from '../../services/nhl/dates';
import { useNhlToday, useWeekSchedule } from '../../hooks/useCoach';
import { useResource } from '../../hooks/useResource';
import { nightSummary, type NightSummary } from './boardView';

/** Live boxes refresh each minute, like Tonight. */
export const BOARD_POLL_MS = 60 * 1000;
/** Start polling this long before the first room puck drop, so the board turns live by itself. */
export const BOARD_WARMUP_MS = 15 * 60 * 1000;

export interface RoomNight {
  /** Today's whole slate with states and scores (`buildRoomBoard`'s `finals`). */
  slate: NhlGame[];
  lines: Map<number, GameLine>;
}

/**
 * Today's slate and the box scores of the room's started games. Live games are re-fetched when
 * forced (polling); a final is fetched fresh once, right after it was live, then from cache.
 */
export async function loadRoomNight(
  date: string,
  gameIds: number[],
  options: { force: boolean; wasLive: ReadonlySet<number> },
): Promise<RoomNight> {
  const slate = await fetchDaySlate(date, { force: options.force });
  const wanted = new Set(gameIds);
  const started = slate.filter((game) => wanted.has(game.id) && isGameStarted(game));
  const boxes = await Promise.all(
    started.map((game) =>
      fetchGameLines(game.id, { final: isGameFinal(game), force: isGameFinal(game) ? options.wasLive.has(game.id) : options.force }),
    ),
  );
  const lines = new Map<number, GameLine>();
  for (const box of boxes) for (const [playerId, line] of box) lines.set(playerId, line);
  return { slate, lines };
}

export interface RoomBoardView {
  /** The NHL game day the board is for. */
  date: string;
  rows: RoomBoardRow[];
  /** The room's games today. */
  summary: NightSummary;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useRoomBoard(snapshot: RoomSnapshot | null, focused: boolean, now: Date): RoomBoardView {
  const today = useNhlToday();
  const schedule = useWeekSchedule(mondayOf(today));
  const ids = useMemo(() => (snapshot && schedule.data ? boardGameIds(snapshot, schedule.data, today) : []), [snapshot, schedule.data, today]);
  const idsKey = ids.join(',');
  const wasLive = useRef<ReadonlySet<number>>(new Set());
  const night = useResource(idsKey ? `room-night|${today}|${idsKey}` : null, async (force) => {
    const result = await loadRoomNight(today, ids, { force, wasLive: wasLive.current });
    wasLive.current = new Set(result.slate.filter((game) => isGameStarted(game) && !isGameFinal(game)).map((game) => game.id));
    return result;
  });

  // The room's games: live states from the slate once it's in, the schedule's start times before.
  const roomGames = useMemo(() => {
    const wanted = new Set(ids);
    const source = night.data?.slate ?? schedule.data?.days.find((day) => day.date === today)?.games ?? [];
    return source.filter((game) => wanted.has(game.id));
  }, [ids, night.data, schedule.data, today]);
  const summary = useMemo(() => nightSummary(roomGames), [roomGames]);

  const firstPuckAt = summary.firstPuck ? Date.parse(summary.firstPuck) : Number.POSITIVE_INFINITY;
  const active = summary.live > 0 || firstPuckAt - now.getTime() <= BOARD_WARMUP_MS;
  const { refresh: refreshNight } = night;
  useEffect(() => {
    if (!focused || !active || !idsKey) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refreshNight();
    }, BOARD_POLL_MS);
    return () => clearInterval(timer);
  }, [focused, active, idsKey, refreshNight]);

  const rows = useMemo(() => {
    if (!snapshot || !schedule.data) return [];
    return buildRoomBoard({
      snapshot,
      schedule: schedule.data,
      today,
      lines: night.data?.lines,
      finals: night.data?.slate ?? [],
      scoring: snapshot.room.scoring,
    });
  }, [snapshot, schedule.data, today, night.data]);

  const { refresh: refreshSchedule } = schedule;
  const refresh = useCallback(async () => {
    await Promise.all([refreshSchedule(), refreshNight()]);
  }, [refreshSchedule, refreshNight]);

  return { date: today, rows, summary, loading: schedule.loading && !schedule.data, refresh };
}
