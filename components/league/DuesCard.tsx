/**
 * League dues — a checklist, never a wallet. Everyone sees the buy-in, the pot, the payouts and
 * who's paid; the owner sets them up and ticks teams off.
 */

import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RoomSnapshot } from '../../types/league';
import { byTeamName, summarizeDues } from '../../services/league';
import { Card, colors, display, GhostButton, StatCell } from '../coach/ui';
import { niceDate } from '../tonight/nightText';
import { moneyText, ordinal } from './format';
import type { LeagueResult } from './useRoomActions';

export const DUES_DISCLAIMER = 'Tracking only — PuckIQ never holds money.';

export function DuesCard({
  snapshot,
  isOwner,
  today,
  onEdit,
  onTogglePaid,
}: {
  snapshot: RoomSnapshot;
  isOwner: boolean;
  /** NHL game day, for "overdue". */
  today: string;
  onEdit: () => void;
  onTogglePaid: (userId: string, paid: boolean) => Promise<LeagueResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const { room, members } = snapshot;
  const summary = summarizeDues(room, snapshot.dues, members);
  const paidIds = new Set(snapshot.dues.filter((status) => status.paid).map((status) => status.userId));

  if (summary.amount === null) {
    return (
      <Card style={styles.card} testID="room-dues-empty">
        <Text style={styles.title}>No dues yet</Text>
        <Text style={styles.body}>Track the buy-in, the deadline and who’s paid. {DUES_DISCLAIMER}</Text>
        <GhostButton label="Set up dues" icon="cash-outline" onPress={onEdit} style={styles.setup} testID="room-dues-setup" />
      </Card>
    );
  }

  const overdue = summary.deadlinePassed(today) && summary.unpaid.length > 0;
  const toggle = async (userId: string) => {
    setError(null);
    const failed = await onTogglePaid(userId, !paidIds.has(userId));
    if (failed) setError(failed.message);
  };

  return (
    <Card style={styles.card} testID="room-dues">
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.amount}>
            {moneyText(summary.amount, summary.currency)}
            <Text style={styles.per}> per team</Text>
          </Text>
          {summary.deadline ? (
            <Text style={[styles.deadline, overdue && styles.overdue]} testID="room-dues-deadline">
              {overdue ? 'Overdue since ' : 'Due '}
              {niceDate(summary.deadline)}
            </Text>
          ) : null}
        </View>
        {isOwner ? <GhostButton label="Edit" icon="create-outline" onPress={onEdit} testID="room-dues-edit" /> : null}
      </View>
      <View style={styles.stats}>
        <StatCell value={moneyText(summary.potTotal, summary.currency)} label="Pot" size={22} />
        <StatCell value={moneyText(summary.collected, summary.currency)} label="Collected" size={22} />
        <StatCell
          value={`${summary.paidCount}/${summary.memberCount}`}
          label="Paid"
          size={22}
          tone={summary.unpaid.length === 0 ? 'good' : 'neutral'}
          testID="room-dues-paid"
        />
      </View>
      {room.dues.payouts.length > 0 ? (
        <Text style={styles.payouts}>
          {room.dues.payouts.map((payout) => `${ordinal(payout.place)} ${moneyText(payout.amount, summary.currency)}`).join('  ·  ')}
        </Text>
      ) : null}
      {isOwner && !summary.payoutsValid ? <Text style={styles.warn}>The payouts don’t fit the pot. Edit them.</Text> : null}
      {room.dues.potLink ? (
        <Pressable
          onPress={() => Linking.openURL(room.dues.potLink ?? '').catch(() => undefined)}
          accessibilityRole="link"
          style={styles.potLink}
          testID="room-dues-pot-link"
        >
          <Ionicons name="open-outline" size={15} color={colors.accent} />
          <Text style={styles.potLinkText}>Where the pot lives</Text>
        </Pressable>
      ) : null}
      <View style={styles.list}>
        {[...members].sort(byTeamName).map((member) => {
          const paid = paidIds.has(member.userId);
          return (
            <Pressable
              key={member.userId}
              onPress={isOwner ? () => toggle(member.userId) : undefined}
              disabled={!isOwner}
              accessibilityRole={isOwner ? 'checkbox' : undefined}
              accessibilityState={{ checked: paid }}
              accessibilityLabel={`${member.teamName}, ${paid ? 'paid' : 'not paid'}`}
              style={styles.member}
              testID={`dues-${member.userId}`}
            >
              <Ionicons name={paid ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={paid ? colors.good : colors.muted} />
              <Text style={styles.memberName} numberOfLines={1}>
                {member.teamName}
                {member.userId === snapshot.me ? ' (you)' : ''}
              </Text>
              <Text style={[styles.status, paid && styles.statusPaid]}>{paid ? 'PAID' : 'UNPAID'}</Text>
            </Pressable>
          );
        })}
      </View>
      {isOwner ? <Text style={styles.hint}>Tap a team to mark it paid.</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.footnote}>{DUES_DISCLAIMER}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  body: { fontSize: 14, lineHeight: 20, color: colors.sub },
  setup: { alignSelf: 'flex-start' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headText: { flex: 1, gap: 2 },
  amount: { ...display(26) },
  per: { fontSize: 14, fontWeight: '700', fontStyle: 'normal', color: colors.sub, letterSpacing: 0 },
  deadline: { fontSize: 13, fontWeight: '700', color: colors.sub },
  overdue: { color: colors.bad },
  stats: { flexDirection: 'row' },
  payouts: { fontSize: 14, fontWeight: '800', color: colors.text },
  warn: { fontSize: 13, fontWeight: '600', color: colors.warn },
  potLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  potLinkText: { fontSize: 14, fontWeight: '800', color: colors.accent },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  memberName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  status: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8, color: colors.muted },
  statusPaid: { color: colors.good },
  hint: { fontSize: 12, color: colors.muted },
  error: { fontSize: 13, fontWeight: '600', color: colors.bad },
  footnote: { fontSize: 12, fontWeight: '700', color: colors.sub },
});
