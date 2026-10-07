/**
 * The Monday recap: last week's games that counted for every team, the leaders, and the three
 * awards (most games that count, bench of shame, emptiest lineup). Shareable as a card.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RecapAward, RoomWeekRecap } from '../../services/league';
import { shortDate } from '../../services/nhl/dates';
import { colors, DarkCard, display } from '../coach/ui';
import { ShareButton } from '../share/ShareCards';
import { countText } from './format';
import { Kicker } from './Kicker';

/** Rows in the recap table; my row is added below them when I'm not among the leaders. */
const LEADERS = 3;

export function RoomRecapCard({ recap, onShare }: { recap: RoomWeekRecap; onShare: (() => void) | null }) {
  const leaders = recap.members.slice(0, LEADERS);
  const mine = recap.members.find((member) => member.isMe);
  const rows = mine && !leaders.includes(mine) ? [...leaders, mine] : leaders;
  const { mostGamesThatCount, benchOfShame, emptiestLineup } = recap.awards;
  return (
    <DarkCard style={styles.card} testID="room-recap">
      <Kicker
        dark
        label={`Monday recap · week of ${shortDate(recap.monday)}`}
        right={onShare ? <ShareButton onPress={onShare} testID="room-recap-share" /> : null}
      />
      <Text style={styles.headline}>{recap.headline}</Text>
      <View>
        <View style={styles.head}>
          <Text style={[styles.headText, styles.posCol]}>POS</Text>
          <Text style={[styles.headText, styles.nameCol]}>TEAM</Text>
          <Text style={styles.headText}>COUNTED</Text>
        </View>
        {rows.map((member) => (
          <View key={member.userId} style={[styles.row, member.isMe && styles.rowMe]}>
            <Text style={[styles.pos, styles.posCol]}>{recap.members.indexOf(member) + 1}</Text>
            <Text style={[styles.name, styles.nameCol]} numberOfLines={1}>
              {member.teamName.toUpperCase()}
            </Text>
            <Text style={styles.value}>{member.gamesThatCounted}</Text>
          </View>
        ))}
      </View>
      <View style={styles.awards}>
        <Award label="Most games that count" award={mostGamesThatCount} unit={(value) => countText(value, 'game')} />
        <Award label="Bench of shame" award={benchOfShame} unit={(value) => `${countText(value, 'game')} lost to the bench`} />
        <Award label="Emptiest lineup" award={emptiestLineup} unit={(value) => countText(value, 'empty slot')} />
      </View>
    </DarkCard>
  );
}

function Award({ label, award, unit }: { label: string; award: RecapAward | null; unit: (value: number) => string }) {
  if (!award) return null;
  return (
    <View style={styles.award}>
      <Text style={styles.awardLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.awardText} numberOfLines={2}>
        {award.winners.map((winner) => winner.teamName).join(' · ')} — {unit(award.value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  headline: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: colors.onInk },
  head: { flexDirection: 'row', alignItems: 'center', paddingBottom: 4 },
  headText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, color: colors.onInkSub },
  posCol: { width: 34 },
  nameCol: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  rowMe: { backgroundColor: colors.inkRaised },
  pos: { ...display(16), color: colors.onInk, paddingLeft: 4 },
  name: { fontSize: 14, fontWeight: '900', color: colors.onInk },
  value: { ...display(20), color: colors.onInk, minWidth: 44, textAlign: 'right' },
  awards: { gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.14)', paddingTop: 12 },
  award: { gap: 2 },
  awardLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: colors.accent },
  awardText: { fontSize: 14, fontWeight: '700', color: colors.onInk },
});
