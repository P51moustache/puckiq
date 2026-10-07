/**
 * Keeps the room and this device's team in step.
 *
 * Up: when the room's copy of my team is behind — a roster edit, a renamed team, or a day without
 * a re-confirm — push it once edits settle (`ROSTER_PUSH_DEBOUNCE_MS`). A push still waiting when
 * the app leaves the foreground goes out right away, so a last-second add isn't lost.
 *
 * Down: the opponent the room implies fills the team's matchup for the Week tab.
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { FantasyTeam } from '../../types/fantasy';
import type { RoomSnapshot } from '../../types/league';
import { hasSamplePlayers } from '../../constants/sampleTeam';
import { myMember, ROSTER_PUSH_DEBOUNCE_MS, rosterNeedsPush, type LeagueApi } from '../../services/league';
import { teamWithRoomOpponent } from './leagueState';

/**
 * A push the server took that still reads as behind (say, a name it tidies differently) waits
 * this long before the same team version is pushed again, so a mismatch can't become an RPC on
 * every poll.
 */
export const ROSTER_RETRY_MS = 10 * 60 * 1000;

export interface RoomSyncInput {
  api: Pick<LeagueApi, 'updateMembership'>;
  team: FantasyTeam | null;
  /** The snapshot of the team's own room, or null. */
  snapshot: RoomSnapshot | null;
  updateTeam: (update: (team: FantasyTeam) => FantasyTeam, teamId?: string) => void;
  /** After a push lands (reload the room so the next check sees it). */
  onPushed: () => void;
  onError: (error: unknown) => void;
}

export function useRoomSync({ api, team, snapshot, updateTeam, onPushed, onError }: RoomSyncInput): void {
  const lastPush = useRef<{ signature: string; at: number } | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const callbacks = useRef({ onPushed, onError });
  callbacks.current = { onPushed, onError };

  // Up: my roster and team name.
  useEffect(() => {
    // A sample roster is the demo, not the user's team: never show it to the league.
    if (!team || !snapshot || team.roomId !== snapshot.room.id || hasSamplePlayers(team)) return;
    const mine = myMember(snapshot);
    // `new Date()`: the room's timestamps are server time, so compare with the real clock.
    if (!rosterNeedsPush(team, mine, new Date())) return;
    const signature = `${snapshot.room.id}|${team.updatedAt}`;
    const last = lastPush.current;
    if (last && last.signature === signature && Date.now() - last.at < ROSTER_RETRY_MS) return;

    const roomId = snapshot.room.id;
    // Always send my current pick: updateMembership replaces the whole row.
    const opponentUserId = mine?.opponentUserId ?? null;
    const push = () => {
      pending.current = null;
      lastPush.current = { signature, at: Date.now() };
      api.updateMembership(roomId, team, opponentUserId).then(
        () => callbacks.current.onPushed(),
        (error: unknown) => callbacks.current.onError(error),
      );
    };
    const timer = setTimeout(push, ROSTER_PUSH_DEBOUNCE_MS);
    pending.current = () => {
      clearTimeout(timer);
      push();
    };
    return () => {
      clearTimeout(timer);
      pending.current = null;
    };
  }, [api, team, snapshot]);

  // Leaving the foreground flushes a waiting push.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pending.current?.();
    });
    return () => subscription.remove();
  }, []);

  // Down: this week's opponent from the room.
  useEffect(() => {
    if (!team || !snapshot || team.roomId !== snapshot.room.id) return;
    if (teamWithRoomOpponent(team, snapshot) === team) return;
    const roomId = snapshot.room.id;
    updateTeam((current) => (current.roomId === roomId ? teamWithRoomOpponent(current, snapshot) : current), team.id);
  }, [team, snapshot, updateTeam]);
}
