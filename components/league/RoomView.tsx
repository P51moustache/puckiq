/**
 * Inside a room: the hero (name, code, invite, coverage), the game-night board, this week's
 * opponent, last week's recap, trade ideas (Pro) and dues — two columns on iPad, stacked on
 * phones. Owns the room's sheets (menu, dues editor, recap share card).
 */

import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Share, StyleSheet } from 'react-native';
import type { FantasyTeam } from '../../types/fantasy';
import type { RoomSnapshot } from '../../types/league';
import { buildRoomWeekRecap, inviteMessage, opponentChoices, otherMembers, roomCoverage, roomOpponent } from '../../services/league';
import { addDays, mondayOf, weekdayAbbrev } from '../../services/nhl/dates';
import { track } from '../../services/analytics/track';
import { useWeekSchedule } from '../../hooks/useCoach';
import { useSubscription } from '../SubscriptionProvider';
import { usePaywall } from '../PaywallProvider';
import { usePlayerSheet } from '../sheets/PlayerSheet';
import { ShareCardSheet } from '../share/ShareCards';
import { useNow } from '../coach/format';
import { colors, Columns, contentFrame, ErrorBanner, ProBadge, SectionLabel, useWide } from '../coach/ui';
import { boardRowViews } from './boardView';
import { DuesCard } from './DuesCard';
import { DuesEditor } from './DuesEditor';
import { useLeague } from './LeagueProvider';
import { OpponentPicker } from './OpponentPicker';
import { RoomBoard } from './RoomBoard';
import { RoomHero } from './RoomHero';
import { RoomMenu } from './RoomMenu';
import { RoomRecapCard } from './RoomRecapCard';
import { roomRecapShareContent } from './shareContent';
import { TradeIdeasCard, type TradeSide } from './TradeIdeasCard';
import type { RoomTradeIdea } from './tradeIdeas';
import { useRoomBoard } from './useRoomBoard';
import { useRoomFocus } from './useRoomFocus';
import { useTradeIdeas } from './useTradeIdeas';

/** The board's countdown and "updated 3 d ago" labels re-render this often. */
const CLOCK_TICK_MS = 30 * 1000;

export function RoomView({ snapshot, team }: { snapshot: RoomSnapshot; team: FantasyTeam }) {
  const league = useLeague();
  const wide = useWide();
  const { isPremium } = useSubscription();
  const { openPaywall } = usePaywall();
  const { openPlayer } = usePlayerSheet();
  const focused = useRoomFocus();
  const now = useNow(CLOCK_TICK_MS);
  const board = useRoomBoard(snapshot, focused, now);
  const lastWeek = useWeekSchedule(addDays(mondayOf(board.date), -7));
  const [menuOpen, setMenuOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [editingDues, setEditingDues] = useState(false);
  const [tradesRequested, setTradesRequested] = useState(false);
  const trades = useTradeIdeas(snapshot, team.players, isPremium && tradesRequested);

  // Roster ages compare with the room's server timestamps, so they read the real clock (not the
  // dev-adjustable app clock); `now` is the tick that re-reads it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const serverNow = useMemo(() => new Date(), [now]);
  const rows = useMemo(() => boardRowViews(board.rows, snapshot, serverNow), [board.rows, snapshot, serverNow]);
  const recap = useMemo(
    () => (lastWeek.data ? buildRoomWeekRecap({ snapshot, schedule: lastWeek.data, slots: snapshot.room.slots }) : null),
    [snapshot, lastWeek.data],
  );
  const recapShare = useMemo(() => (recap && lastWeek.data ? roomRecapShareContent(recap, snapshot, lastWeek.data) : null), [recap, snapshot, lastWeek.data]);

  const { room } = snapshot;
  const isOwner = room.ownerId === snapshot.me;
  const showRecap = !!recap?.awards.mostGamesThatCount;
  // Monday is recap day: the card leads until the new week's games take over.
  const recapFirst = showRecap && weekdayAbbrev(board.date) === 'MON';
  const showDues = isOwner || room.dues.amount !== null;
  const hasPartners = otherMembers(snapshot).some((member) => member.roster.length > 0);

  const invite = () => {
    Share.share({ message: inviteMessage(room.name, room.code) }).catch(() => undefined);
  };
  const findTrades = () => {
    track('trade_finder_open', { pro: true });
    setTradesRequested(true);
  };
  const unlockTrades = () => {
    track('trade_finder_open', { pro: false });
    openPaywall('trade_finder');
  };
  const openIdea = (idea: RoomTradeIdea, side: TradeSide, rank: number) => {
    track('trade_idea_view', { rank: rank + 1, side });
    if (side === 'give') openPlayer(idea.give.playerId, 'roster');
    else openPlayer(idea.get.playerId, 'browse');
  };
  const refresh = async () => {
    await Promise.all([league.refresh(), board.refresh()]);
  };

  const recapCard = showRecap && recap ? (
    <>
      <SectionLabel title="Last week" flush={wide && !recapFirst} />
      <RoomRecapCard recap={recap} onShare={recapShare ? () => setSharing(true) : null} />
    </>
  ) : null;

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentFrame]}
        refreshControl={<RefreshControl refreshing={league.refreshing} onRefresh={refresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
        testID="room-view"
      >
        {league.error ? <ErrorBanner message={league.error.message} onRetry={() => void league.refresh()} /> : null}
        <Columns
          left={
            <>
              <RoomHero room={room} coverage={roomCoverage(snapshot)} onInvite={invite} onMenu={() => setMenuOpen(true)} />
              {recapFirst ? recapCard : null}
              <SectionLabel title="Game night" />
              <RoomBoard rows={rows} summary={board.summary} date={board.date} now={now} onReact={league.react} />
              <SectionLabel title="This week’s opponent" />
              <OpponentPicker choices={opponentChoices(snapshot)} opponent={roomOpponent(snapshot)} onPick={league.setOpponent} />
            </>
          }
          right={
            <>
              {recapFirst ? null : recapCard}
              <SectionLabel title="Trade ideas" right={<ProBadge small />} flush={wide && (recapFirst || !showRecap)} />
              <TradeIdeasCard
                isPro={isPremium}
                hasPartners={hasPartners}
                state={{ requested: tradesRequested, ideas: trades.data, loading: trades.loading, error: trades.error }}
                onFind={findTrades}
                onRetry={() => void trades.refresh()}
                onUnlock={unlockTrades}
                onOpen={openIdea}
              />
              {showDues ? (
                <>
                  <SectionLabel title="Dues" />
                  <DuesCard snapshot={snapshot} isOwner={isOwner} today={board.date} onEdit={() => setEditingDues(true)} onTogglePaid={league.setDuesPaid} />
                </>
              ) : null}
            </>
          }
        />
      </ScrollView>
      <RoomMenu
        visible={menuOpen}
        snapshot={snapshot}
        onClose={() => setMenuOpen(false)}
        onRename={league.rename}
        onRotateCode={league.rotateCode}
        onRemove={league.removeMember}
        onLeave={league.leave}
      />
      <ShareCardSheet visible={sharing} content={recapShare} onClose={() => setSharing(false)} />
      <DuesEditor visible={editingDues} dues={room.dues} leagueSize={room.leagueSize} onSave={league.saveDues} onClose={() => setEditingDues(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 130 },
});
