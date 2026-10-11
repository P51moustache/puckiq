/**
 * The morning recap: last night's points (or a category league's tallies), the players who
 * carried it, and (Pro) how much of the best possible lineup PuckIQ's pre-game lineup captured.
 * Leads Tonight until noon ET.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FantasyPlayer } from '../../types/fantasy';
import { headlinePoints, type NightScore } from '../../services/fantasy/nightScore';
import { tileLineText, type CategoryTally } from '../../services/fantasy/nightTallies';
import type { GameLine } from '../../services/nhl/gamecenter';
import { hindsightText, recapLeaders } from '../../services/fantasy/recap';
import { formatValue } from '../../services/fantasy/scoring';
import { PlayerAvatar } from '../coach/PlayerAvatar';
import { ShareButton } from '../share/ShareCards';
import { colors, DarkCard, display } from '../coach/ui';
import { CategoryTallies } from './CategoryTallies';
import { Kicker } from './Kicker';
import { lastNameOf, niceDate } from './nightText';

export function RecapCard({
  date,
  score,
  tallies,
  lines,
  isPro,
  byId,
  onShare,
  onOpenPlayer,
  onUnlock,
}: {
  date: string;
  score: NightScore;
  /** A category league's tallies, shown instead of points (leaders then show their lines). */
  tallies: CategoryTally[] | null;
  lines: Map<number, GameLine>;
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
      <Kicker label={`LAST NIGHT · ${niceDate(date).toUpperCase()}`} right={onShare ? <ShareButton onPress={onShare} testID="recap-share" /> : null} />
      {tallies ? (
        <View style={styles.tallies}>
          <CategoryTallies tallies={tallies} size={22} testID="recap-tallies" />
          <Text style={styles.talliesCaption}>{lineupSplit ? 'FROM YOUR LINEUP' : 'FROM YOUR PLAYERS'}</Text>
        </View>
      ) : (
        <View style={styles.countRow}>
          <Text style={styles.points} testID="recap-points">{formatValue(headlinePoints(score, isPro))}</Text>
          <View style={styles.countText}>
            <Text style={styles.pts}>PTS</Text>
            <Text style={styles.caption}>{lineupSplit ? 'from your lineup' : 'from your players'}</Text>
          </View>
        </View>
      )}
      {leaders.length > 0 ? (
        <View style={styles.leaders}>
          {leaders.map((row) => {
            const player = byId.get(row.playerId);
            const line = lines.get(row.playerId);
            return (
              <Pressable key={row.playerId} style={styles.leader} onPress={() => onOpenPlayer(row.playerId)} accessibilityLabel={player?.playerName}>
                <PlayerAvatar playerId={row.playerId} team={player?.teamAbbrev ?? ''} position={player?.position ?? ''} size={44} />
                <Text style={styles.leaderName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {lastNameOf(player?.playerName ?? '').toUpperCase()}
                </Text>
                <Text style={[tallies ? styles.leaderLine : styles.leaderPoints, row.bigNight && styles.leaderBig]} numberOfLines={1}>
                  {tallies ? (line ? tileLineText(line) : '—') : formatValue(row.points ?? 0)}
                </Text>
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
            {!tallies && score.benchPoints > 0 ? ` · ${formatValue(score.benchPoints)} scored with no slot` : ''}
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
  card: { gap: 8, marginBottom: 12 },
  countRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  points: { ...display(36), color: colors.onInk, lineHeight: 40, letterSpacing: -0.8 },
  countText: { flex: 1, paddingBottom: 8 },
  pts: { ...display(20), color: colors.onInkSub },
  caption: { fontSize: 14, fontWeight: '700', color: colors.onInk },
  leaders: { flexDirection: 'row', gap: 10 },
  leader: { width: 64, alignItems: 'center', gap: 4 },
  leaderName: { width: 64, textAlign: 'center', fontSize: 10, fontWeight: '900', color: colors.onInk },
  leaderPoints: { ...display(15), color: colors.onInk },
  leaderLine: { fontSize: 12, fontWeight: '800', color: colors.onInk },
  tallies: { gap: 8 },
  talliesCaption: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.onInkSub },
  leaderBig: { color: colors.elite },
  grade: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.inkRaised, borderRadius: 12, padding: 12 },
  gradeLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: colors.accent },
  gradeText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.onInk },
  unlock: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  unlockText: { fontSize: 13, fontWeight: '800', color: colors.onInk },
});
