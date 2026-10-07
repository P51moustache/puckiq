/**
 * Trade ideas (Pro): 1-for-1 swaps where both lineups gain, found across every roster in the
 * room — "+2.4 you · +1.6 them". Free members see the lock card. Tap a player for his sheet.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FantasyPlayer } from '../../types/fantasy';
import { PlayerAvatar, PlayerName } from '../coach/PlayerAvatar';
import { Card, colors, ErrorBanner, LoadingRows, PrimaryButton, ProLockCard } from '../coach/ui';
import { gainText } from './format';
import type { RoomTradeIdea } from './tradeIdeas';

export type TradeSide = 'give' | 'get';

export interface TradeIdeasState {
  /** The member asked for ideas (they load only then). */
  requested: boolean;
  ideas: RoomTradeIdea[] | null;
  loading: boolean;
  error: string | null;
}

export function TradeIdeasCard({
  isPro,
  hasPartners,
  state,
  onFind,
  onRetry,
  onUnlock,
  onOpen,
}: {
  isPro: boolean;
  /** Someone else is in the room. */
  hasPartners: boolean;
  state: TradeIdeasState;
  onFind: () => void;
  onRetry: () => void;
  onUnlock: () => void;
  onOpen: (idea: RoomTradeIdea, side: TradeSide, rank: number) => void;
}) {
  if (!isPro) {
    return (
      <ProLockCard
        title="Trade ideas"
        detail="Swaps where both lineups gain, found across every roster in your room."
        onPress={onUnlock}
        testID="trade-ideas-locked"
      />
    );
  }
  if (!hasPartners) {
    return (
      <Card testID="trade-ideas-alone">
        <Text style={styles.body}>Trade ideas need a league-mate in the room. Invite yours.</Text>
      </Card>
    );
  }
  if (!state.requested) {
    return (
      <Card style={styles.start} testID="trade-ideas-start">
        <Text style={styles.body}>1-for-1 swaps where both lineups gain over this week and next, using every roster in the room.</Text>
        <PrimaryButton label="Find trades" icon="swap-horizontal" variant="black" onPress={onFind} testID="trade-find" />
      </Card>
    );
  }
  if (state.loading && !state.ideas) return <LoadingRows count={3} />;
  if (state.error && !state.ideas) return <ErrorBanner message="Trade ideas didn’t load." onRetry={onRetry} />;
  if (!state.ideas || state.ideas.length === 0) {
    return (
      <Card testID="trade-ideas-none">
        <Text style={styles.body}>No swap helps both sides right now. Check back after your league makes moves.</Text>
      </Card>
    );
  }
  return (
    <Card style={styles.list} testID="trade-ideas">
      {state.ideas.map((idea, index) => (
        <View key={`${idea.partnerId}-${idea.give.playerId}-${idea.get.playerId}`} style={[styles.idea, index > 0 && styles.divided]} testID="trade-idea">
          <Text style={styles.partner} numberOfLines={1}>
            WITH {idea.partnerName.toUpperCase()}
          </Text>
          <View style={styles.swap}>
            <Side label="Give" player={idea.give} onPress={() => onOpen(idea, 'give', index)} />
            <Ionicons name="swap-horizontal" size={18} color={colors.muted} />
            <Side label="Get" player={idea.get} onPress={() => onOpen(idea, 'get', index)} />
          </View>
          <Text style={styles.gains} testID="trade-idea-gains">
            <Text style={styles.gainMine}>{gainText(idea.myGain)} you</Text>
            <Text style={styles.gainSep}> · </Text>
            <Text style={styles.gainTheirs}>{gainText(idea.theirGain)} them</Text>
          </Text>
        </View>
      ))}
    </Card>
  );
}

function Side({ label, player, onPress }: { label: 'Give' | 'Get'; player: FantasyPlayer; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${player.playerName}`}
      style={({ pressed }) => [styles.side, pressed && styles.pressed]}
      testID={`trade-${label.toLowerCase()}-${player.playerId}`}
    >
      <PlayerAvatar playerId={player.playerId} team={player.teamAbbrev} position={player.position} size={44} />
      <View style={styles.sideText}>
        <Text style={styles.sideLabel}>{label.toUpperCase()}</Text>
        <PlayerName name={player.playerName} size={14} initial />
        <Text style={styles.sideMeta}>
          {player.teamAbbrev} · {player.position}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14, lineHeight: 20, color: colors.sub },
  start: { gap: 12 },
  list: { paddingVertical: 4 },
  idea: { paddingVertical: 12, gap: 10 },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  partner: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: colors.muted },
  swap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  sideText: { flex: 1, minWidth: 0 },
  sideLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: colors.muted },
  sideMeta: { fontSize: 11, fontWeight: '700', color: colors.sub },
  pressed: { opacity: 0.7 },
  gains: { fontSize: 14, fontWeight: '900', fontStyle: 'italic' },
  gainMine: { color: colors.good },
  gainSep: { color: colors.muted },
  gainTheirs: { color: colors.sub },
});
