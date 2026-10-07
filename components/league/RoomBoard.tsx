/**
 * The game-night board: a carbon timing tower of the room. Before puck drop each row shows who
 * plays tonight and games that count left this week; once box scores are in it shows live points
 * and the gap to the leader. Tap a league-mate's row for the preset reactions.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ROOM_REACTIONS, type RoomReaction } from '../../types/league';
import { formatValue } from '../../services/fantasy/scoring';
import { colors, CountdownBar, DarkCard, display } from '../coach/ui';
import { CountUp } from '../coach/motion';
import { countdownText, niceDate } from '../tonight/nightText';
import { rowDetail, type BoardRowView, type NightSummary } from './boardView';
import { Kicker } from './Kicker';
import type { LeagueResult } from './useRoomActions';

/** Under an hour to the first puck drop, the countdown turns red (as on Tonight). */
const URGENT_MS = 60 * 60 * 1000;

export function RoomBoard({
  rows,
  summary,
  date,
  now,
  onReact,
}: {
  rows: BoardRowView[];
  summary: NightSummary;
  date: string;
  now: Date;
  onReact: (toUserId: string, emoji: RoomReaction) => Promise<LeagueResult>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const live = rows.some((row) => row.livePoints !== null);

  const react = async (userId: string, emoji: RoomReaction) => {
    setOpen(null);
    Haptics.selectionAsync().catch(() => undefined);
    const failed = await onReact(userId, emoji);
    setMessage(failed ? failed.message : null);
  };

  return (
    <DarkCard style={styles.board} testID="room-board">
      <Kicker dark live={summary.live > 0} label={`${summary.live > 0 ? 'Live · ' : ''}Game night · ${niceDate(date)}`} />
      <View style={styles.head}>
        <Text style={[styles.headText, styles.posCol]}>POS</Text>
        <Text style={[styles.headText, styles.teamCol]}>TEAM</Text>
        <Text style={[styles.headText, styles.midCol]}>{live ? 'GAP' : 'TONIGHT'}</Text>
        <Text style={[styles.headText, styles.bigCol]}>{live ? 'PTS' : 'LEFT'}</Text>
      </View>
      {rows.map((row) => (
        <BoardRow
          key={row.userId}
          row={row}
          live={live}
          open={open === row.userId}
          onToggle={() => setOpen((current) => (current === row.userId ? null : row.userId))}
          onReact={(emoji) => react(row.userId, emoji)}
        />
      ))}
      {rows.length <= 1 ? <Text style={styles.alone}>Just you so far. Invite your league to fill the board.</Text> : null}
      <BoardClock summary={summary} now={now} />
      {message ? (
        <Text style={styles.message} testID="room-board-message">
          {message}
        </Text>
      ) : null}
    </DarkCard>
  );
}

function BoardRow({
  row,
  live,
  open,
  onToggle,
  onReact,
}: {
  row: BoardRowView;
  live: boolean;
  open: boolean;
  onToggle: () => void;
  onReact: (emoji: RoomReaction) => void;
}) {
  const detail = rowDetail(row, live);
  const leader = row.position === 1;
  return (
    <View>
      <Pressable
        onPress={row.isMe ? undefined : onToggle}
        disabled={row.isMe}
        accessibilityRole={row.isMe ? undefined : 'button'}
        accessibilityLabel={`${row.position}. ${row.teamName}${row.isMe ? ', you' : '. Send a reaction'}`}
        style={[styles.row, row.isMe && styles.rowMe]}
        testID={`board-row-${row.userId}`}
      >
        <View style={[styles.pos, leader && styles.posLeader]}>
          <Text style={[styles.posText, leader && styles.posLeaderText]}>{row.position}</Text>
        </View>
        <View style={[styles.stripe, row.isMe && styles.stripeMe]} />
        <View style={styles.teamCol}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {row.teamName.toUpperCase()}
            </Text>
            {row.isMe ? <Text style={styles.you}>YOU</Text> : null}
          </View>
          {detail || row.reactions.length > 0 ? (
            <View style={styles.detailRow}>
              {detail ? (
                <Text style={[styles.detail, (row.noRoster || row.staleNote) && styles.detailWarn]} numberOfLines={1}>
                  {detail}
                </Text>
              ) : null}
              {row.reactions.map((count) => (
                <Text key={count.emoji} style={styles.reaction} testID={`board-reaction-${row.userId}`}>
                  {count.emoji}
                  {count.count > 1 ? <Text style={styles.reactionCount}>{count.count}</Text> : null}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
        <Text style={[styles.mid, live && row.gap === 'LEAD' && styles.midLead]}>{live ? row.gap : row.playingToday}</Text>
        {live ? (
          <CountUp value={row.livePoints ?? 0} format={formatValue} style={styles.big} testID={`board-points-${row.userId}`} />
        ) : (
          <Text style={styles.big} testID={`board-left-${row.userId}`}>
            {row.gamesLeft}
          </Text>
        )}
      </Pressable>
      {open ? <ReactionStrip teamName={row.teamName} onPick={onReact} /> : null}
    </View>
  );
}

function ReactionStrip({ teamName, onPick }: { teamName: string; onPick: (emoji: RoomReaction) => void }) {
  return (
    <View style={styles.strip} testID="reaction-strip">
      <Text style={styles.stripLabel} numberOfLines={1}>
        SEND {teamName.toUpperCase()} A REACTION
      </Text>
      <View style={styles.emojis}>
        {ROOM_REACTIONS.map((emoji) => (
          <Pressable
            key={emoji}
            onPress={() => onPick(emoji)}
            accessibilityRole="button"
            accessibilityLabel={`React ${emoji}`}
            style={({ pressed }) => [styles.emoji, pressed && styles.pressed]}
            testID={`react-${emoji}`}
          >
            <Text style={styles.emojiText}>{emoji}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function BoardClock({ summary, now }: { summary: NightSummary; now: Date }) {
  if (summary.live > 0) {
    return <CountdownBar onDark urgent label="Games in progress" value={`${summary.live} LIVE`} testID="board-clock-live" />;
  }
  if (summary.games === 0) {
    return (
      <Text style={styles.quiet} testID="board-clock-quiet">
        No games for the room tonight.
      </Text>
    );
  }
  if (summary.upcoming === 0) {
    return <CountdownBar onDark flag label="All room games final" value="FINAL" testID="board-clock-final" />;
  }
  const untilPuck = summary.firstPuck ? Date.parse(summary.firstPuck) - now.getTime() : Number.POSITIVE_INFINITY;
  return (
    <CountdownBar
      onDark
      urgent={untilPuck < URGENT_MS}
      label={summary.final > 0 ? 'Next puck drop' : 'First puck drop'}
      value={countdownText(summary.firstPuck, now)}
      testID="board-clock-countdown"
    />
  );
}

const styles = StyleSheet.create({
  board: { gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  headText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, color: colors.onInkSub },
  // Position box (3 + 28) plus the stripe (6 + 3), so TEAM lines up with the names below.
  posCol: { width: 40 },
  teamCol: { flex: 1, minWidth: 0, paddingLeft: 10 },
  midCol: { width: 58, textAlign: 'right' },
  bigCol: { width: 52, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 46, paddingVertical: 6, borderRadius: 10 },
  rowMe: { backgroundColor: colors.inkRaised },
  pos: { width: 28, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginLeft: 3 },
  posLeader: { backgroundColor: colors.onInk },
  posText: { ...display(16), color: colors.onInk },
  posLeaderText: { color: colors.ink },
  stripe: { width: 3, height: 28, borderRadius: 1.5, marginLeft: 6, backgroundColor: 'rgba(255,255,255,0.16)' },
  stripeMe: { backgroundColor: colors.accent },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: 14, fontWeight: '900', letterSpacing: 0.2, color: colors.onInk },
  you: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.onAccent,
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  detail: { flexShrink: 1, fontSize: 11, fontWeight: '700', color: colors.onInkSub },
  detailWarn: { color: colors.warn },
  reaction: { fontSize: 12 },
  reactionCount: { fontSize: 10, fontWeight: '900', color: colors.onInkSub },
  mid: { ...display(15), width: 58, textAlign: 'right', color: colors.onInkSub },
  midLead: { color: colors.onInk },
  big: { ...display(22), width: 52, textAlign: 'right', color: colors.onInk },
  strip: { backgroundColor: colors.inkRaised, borderRadius: 12, padding: 12, marginTop: 4, marginBottom: 6, gap: 10 },
  stripLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: colors.onInkSub },
  emojis: { flexDirection: 'row', justifyContent: 'space-between' },
  emoji: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 22 },
  pressed: { opacity: 0.6, transform: [{ scale: 0.94 }] },
  alone: { fontSize: 13, fontWeight: '700', color: colors.onInkSub, paddingVertical: 8 },
  quiet: { fontSize: 13, fontWeight: '700', color: colors.onInkSub, paddingTop: 6 },
  message: { fontSize: 13, fontWeight: '700', color: colors.warn, paddingTop: 4 },
});
