/**
 * The carbon hero at the top of Tonight. Before puck drop it counts who plays and runs the
 * lock countdown; once games start it becomes the night's scoreboard — points, live / final
 * / to-go, the top performer — and after the last horn, the hindsight grade (Pro).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BIG_NIGHT_LABEL, gameClockText, headlinePoints, type NightScore } from '../../services/fantasy/nightScore';
import { formatValue } from '../../services/fantasy/scoring';
import { ShareButton } from '../share/ShareCards';
import { colors, CountdownBar, DarkCard, display, StatCell } from '../coach/ui';
import { CountUp, LiveDot } from '../coach/motion';
import type { FollowLive } from '../../hooks/useNightLive';
import { countdownText, niceDate } from './nightText';

type Night = 'tonight' | 'tomorrow';

export interface TonightHeroProps {
  date: string;
  night: Night;
  loading: boolean;
  playingCount: number;
  total: number;
  problems: number;
  starters: number | null;
  emptySlots: number | null;
  firstPuck: string | null;
  now: Date;
  score: NightScore | null;
  isPro: boolean;
  /** "McDavid · 2G · 1A · 4 SOG" for the top performer. */
  topLine: string | null;
  /** Shown when nobody plays: preseason or the next game date. */
  quiet: { preseasonGames: number; nextDate: string | null } | null;
  onShare: (() => void) | null;
  follow: FollowLive | null;
}

export function TonightHero(props: TonightHeroProps) {
  const { date, loading, score, onShare } = props;
  const started = !!score && score.phase !== 'pre' && props.night === 'tonight';
  return (
    <DarkCard texture style={styles.hero} testID="tonight-headline">
      <View style={styles.kickerRow}>
        {started && score!.phase === 'live' ? <LiveDot /> : <View style={styles.kickerDot} />}
        <Text style={styles.kicker}>
          {started ? `${score!.phase === 'live' ? 'LIVE' : 'FINAL'} · ` : ''}
          {niceDate(date).toUpperCase()}
        </Text>
        <View style={styles.kickerSpacer} />
        {onShare ? <ShareButton onPress={onShare} testID="tonight-share" /> : null}
      </View>
      {loading ? (
        <Text style={styles.quiet}>Loading your night…</Text>
      ) : started ? (
        <LiveBody {...props} score={score!} />
      ) : props.playingCount > 0 ? (
        <PreBody {...props} />
      ) : (
        <QuietBody {...props} />
      )}
    </DarkCard>
  );
}

function PreBody({ night, playingCount, total, problems, starters, emptySlots, firstPuck, now }: TonightHeroProps) {
  return (
    <>
      <View style={styles.countRow}>
        <Text style={styles.bigCount}>{playingCount}</Text>
        <View style={styles.countText}>
          <Text style={styles.of}>OF {total}</Text>
          <Text style={styles.caption}>{night === 'tonight' ? 'of your players play tonight' : 'of your players play tomorrow'}</Text>
        </View>
      </View>
      <View style={styles.stats}>
        <StatCell dark value={String(problems)} label={problems === 1 ? 'Problem' : 'Problems'} tone={problems > 0 ? 'accent' : 'neutral'} testID="tonight-problems" size={26} />
        <StatCell dark value={starters === null ? '—' : String(starters)} label="Starters" size={26} />
        <StatCell dark value={emptySlots === null ? '—' : String(emptySlots)} label="Empty slots" tone={emptySlots ? 'warn' : 'neutral'} size={26} />
      </View>
      {firstPuck ? (
        <CountdownBar
          onDark
          urgent={Date.parse(firstPuck) - now.getTime() < 60 * 60 * 1000}
          label="First lock"
          value={countdownText(firstPuck, now)}
          testID="tonight-countdown"
        />
      ) : null}
    </>
  );
}

function LiveBody({ score, isPro, topLine, follow }: TonightHeroProps & { score: NightScore }) {
  const points = headlinePoints(score, isPro);
  const lineupSplit = isPro && score.players.some((row) => row.role === 'starter');
  const topBig = score.top?.bigNight ?? null;
  return (
    <>
      <View style={styles.countRow}>
        <CountUp value={points} format={formatValue} style={styles.bigPoints} testID="tonight-points" />
        <View style={styles.countText}>
          <Text style={styles.of}>PTS</Text>
          <Text style={styles.caption}>{lineupSplit ? 'from your lineup' : 'from your players'}</Text>
        </View>
      </View>
      <View style={styles.stats}>
        <StatCell dark value={String(score.live)} label="Live" tone={score.live > 0 ? 'accent' : 'neutral'} size={26} testID="tonight-live-count" />
        <StatCell dark value={String(score.final)} label="Final" size={26} />
        <StatCell dark value={String(score.upcoming)} label="To go" size={26} />
      </View>
      {lineupSplit && score.benchPoints > 0 ? (
        <Text style={styles.bench} testID="tonight-bench-points">
          +{formatValue(score.benchPoints)} scored with no slot — overflow your lineup couldn’t use
        </Text>
      ) : null}
      {topLine ? (
        <View style={styles.top} testID="tonight-top">
          <Text style={styles.topLabel}>TOP</Text>
          <Text style={styles.topText} numberOfLines={1}>{topLine}</Text>
          {topBig ? (
            <View style={styles.bigPill}>
              <Text style={styles.bigPillText}>{BIG_NIGHT_LABEL[topBig]}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {score.phase === 'live' ? (
        <CountdownBar
          onDark
          urgent
          label="Games in progress"
          value={score.leadGame ? gameClockText(score.leadGame).toUpperCase() : 'LIVE'}
          testID="tonight-live-bar"
        />
      ) : (
        <CountdownBar
          onDark
          flag
          label={score.hindsight && isPro ? `Hindsight · ${Math.round(score.hindsight.share * 100)}%` : 'All games final'}
          value="FINAL"
          testID="tonight-final-bar"
        />
      )}
      {follow?.supported && score.phase === 'live' ? (
        <Pressable
          onPress={() => follow.setFollowing(!follow.following)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.follow, follow.following && styles.following, pressed && styles.pressed]}
          testID="tonight-follow"
        >
          <Ionicons name={follow.following ? 'checkmark' : 'phone-portrait-outline'} size={14} color={colors.onInk} />
          <Text style={styles.followText}>{follow.following ? 'ON YOUR LOCK SCREEN' : 'FOLLOW ON LOCK SCREEN'}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

function QuietBody({ night, quiet }: TonightHeroProps) {
  const when = night === 'tonight' ? 'tonight' : 'tomorrow';
  if (quiet && quiet.preseasonGames > 0) {
    return (
      <>
        <Text style={styles.quiet} testID="tonight-preseason">Preseason {when}.</Text>
        <Text style={styles.sub}>
          {quiet.preseasonGames} exhibition {quiet.preseasonGames === 1 ? 'game doesn’t' : 'games don’t'} count in fantasy.
          {quiet.nextDate ? ` Fantasy starts ${niceDate(quiet.nextDate)}.` : ''}
        </Text>
      </>
    );
  }
  return (
    <>
      <Text style={styles.quiet}>No games for your roster {when}.</Text>
      <Text style={styles.sub}>{quiet?.nextDate ? `Next games: ${niceDate(quiet.nextDate)}` : 'Check the Week tab for the schedule.'}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 14 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kickerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: colors.onInk },
  kickerSpacer: { flex: 1 },
  countRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  bigCount: { ...display(76), color: colors.onInk, lineHeight: 80, letterSpacing: -3 },
  bigPoints: { ...display(72), color: colors.onInk, lineHeight: 78, letterSpacing: -3 },
  countText: { flex: 1, paddingBottom: 10 },
  of: { ...display(22), color: colors.onInkSub },
  caption: { fontSize: 15, fontWeight: '700', color: colors.onInk },
  stats: { flexDirection: 'row' },
  bench: { fontSize: 13, fontWeight: '700', color: colors.warn, marginTop: -4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: colors.accent },
  topText: { flexShrink: 1, fontSize: 14, fontWeight: '800', color: colors.onInk },
  bigPill: { backgroundColor: colors.elite, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  bigPillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6, color: colors.onInk },
  follow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  following: { backgroundColor: colors.inkRaised, borderColor: colors.inkRaised },
  followText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8, color: colors.onInk },
  pressed: { opacity: 0.7 },
  quiet: { ...display(26), color: colors.onInk },
  sub: { fontSize: 15, color: colors.onInkSub },
});
