/**
 * The morning recap: last night's points, the players who carried it, and (Pro) how much of
 * the best possible lineup PuckIQ's pre-game lineup captured. Leads Tonight until noon ET.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FantasyPlayer } from '../../types/fantasy';
import { headlinePoints, type NightScore } from '../../services/fantasy/nightScore';
import { hindsightText, recapLeaders } from '../../services/fantasy/recap';
import { formatValue } from '../../services/fantasy/scoring';
import { PlayerAvatar } from '../coach/PlayerAvatar';
import { ShareButton } from '../share/ShareCards';
import { colors, DarkCard, display } from '../coach/ui';
import { lastNameOf, niceDate } from './nightText';

export function RecapCard({
  date,
  score,
  isPro,
  byId,
  onShare,
  onOpenPlayer,
  onUnlock,
}: {
  date: string;
  score: NightScore;
  isPro: boolean;
  byId: Map<number, FantasyPlayer>;
  onShare: (() => void) | null;
  onOpenPlayer: (playerId: number) => void;
  onUnlock: () => void;
}) {
  const leaders = recapLeaders(score);
  const lineupSplit = isPro && score.players.some((row) => row.role === 'starter');
  const hindsight = isPro ? hindsightText(score) : null;
  return (
    <DarkCard style={styles.card} testID="tonight-recap">
      <View style={styles.kickerRow}>
        <View style={styles.kickerDot} />
        <Text style={styles.kicker}>LAST NIGHT · {niceDate(date).toUpperCase()}</Text>
        <View style={styles.spacer} />
        {onShare ? <ShareButton onPress={onShare} testID="recap-share" /> : null}
      </View>
      <View style={styles.countRow}>
        <Text style={styles.points} testID="recap-points">{formatValue(headlinePoints(score, isPro))}</Text>
        <View style={styles.countText}>
          <Text style={styles.pts}>PTS</Text>
          <Text style={styles.caption}>{lineupSplit ? 'from your lineup' : 'from your players'}</Text>
        </View>
      </View>
      {leaders.length > 0 ? (
        <View style={styles.leaders}>
          {leaders.map((row) => {
            const player = byId.get(row.playerId);
            return (
              <Pressable key={row.playerId} style={styles.leader} onPress={() => onOpenPlayer(row.playerId)} accessibilityLabel={player?.playerName}>
                <PlayerAvatar playerId={row.playerId} team={player?.teamAbbrev ?? ''} position={player?.position ?? ''} size={44} />
                <Text style={styles.leaderName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {lastNameOf(player?.playerName ?? '').toUpperCase()}
                </Text>
                <Text style={[styles.leaderPoints, row.bigNight && styles.leaderBig]}>{formatValue(row.points ?? 0)}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {hindsight ? (
        <View style={styles.grade} testID="recap-hindsight">
          <Text style={styles.gradeLabel}>HINDSIGHT</Text>
          <Text style={styles.gradeText}>
            {hindsight}
            {score.benchPoints > 0 ? ` · ${formatValue(score.benchPoints)} scored with no slot` : ''}
          </Text>
        </View>
      ) : !isPro ? (
        <Pressable onPress={onUnlock} style={styles.unlock} accessibilityRole="button" testID="recap-unlock">
          <Text style={styles.unlockText}>See how your lineup graded with Pro</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.onInk} />
        </Pressable>
      ) : null}
    </DarkCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14, marginBottom: 12 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kickerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: colors.onInk },
  spacer: { flex: 1 },
  countRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  points: { ...display(60), color: colors.onInk, lineHeight: 64, letterSpacing: -2 },
  countText: { flex: 1, paddingBottom: 8 },
  pts: { ...display(20), color: colors.onInkSub },
  caption: { fontSize: 14, fontWeight: '700', color: colors.onInk },
  leaders: { flexDirection: 'row', gap: 10 },
  leader: { width: 64, alignItems: 'center', gap: 4 },
  leaderName: { width: 64, textAlign: 'center', fontSize: 10, fontWeight: '900', color: colors.onInk },
  leaderPoints: { ...display(15), color: colors.onInk },
  leaderBig: { color: colors.elite },
  grade: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.inkRaised, borderRadius: 12, padding: 12 },
  gradeLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: colors.accent },
  gradeText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.onInk },
  unlock: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  unlockText: { fontSize: 13, fontWeight: '800', color: colors.onInk },
});
