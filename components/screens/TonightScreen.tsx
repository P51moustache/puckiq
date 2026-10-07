/**
 * Tonight — home. A carbon hero ("13 of 16 play · first lock 02H 14M"), the moves to
 * make before lock, the best lineup as a grid of player tiles, and every player's night.
 */

import React, { useMemo, useState } from 'react';
import { trackedChoice } from '../../services/analytics/selection';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import type { FantasyPlayer, SlotKey } from '../../types/fantasy';
import { useNight } from '../../hooks/useCoach';
import { HOST_NOTE, visibleMoves, type CoachMove } from '../../services/fantasy/coach';
import { isNhlLinked, positionLabel, SLOT_ORDER } from '../../services/fantasy/positions';
import { isGameFinal, isGameStarted } from '../../services/nhl/schedule';
import { shortDate, weekdayAbbrev } from '../../services/nhl/dates';
import { STARTING_GOALIES_URL } from '../../constants/legal';
import PageHeader from '../PageHeader';
import { useTeams } from '../TeamsProvider';
import { useSubscription } from '../SubscriptionProvider';
import { usePaywall } from '../PaywallProvider';
import { usePlayerSheet } from '../sheets/PlayerSheet';
import PlayerSearchSheet from '../sheets/PlayerSearchSheet';
import TeamSwitcher from '../coach/TeamSwitcher';
import SampleTeamNotice from '../coach/SampleTeamNotice';
import { ShareButton, ShareCardSheet, type ShareCardContent } from '../share/ShareCards';
import { PlayerAvatar, PlayerName, TeamChip } from '../coach/PlayerAvatar';
import { formatPuckDrop, formatValue, gameClock, liveLineText, liveLineValue, useNow } from '../coach/format';
import {
  Card,
  ColdBadge,
  colors,
  Columns,
  contentFrame,
  CountdownBar,
  DarkCard,
  display,
  EmptyState,
  ErrorState,
  HotBadge,
  LoadingRows,
  Pill,
  PrimaryButton,
  ProLockCard,
  SectionLabel,
  SegmentedControl,
  StatCell,
  useWide,
} from '../coach/ui';
import { ART, ART_ASPECT } from '../../constants/art';

type Night = 'tonight' | 'tomorrow';

const MOVE_ICON: Record<CoachMove['kind'], keyof typeof Ionicons.glyphMap> = {
  scratch: 'close',
  injury: 'medkit',
  overflow: 'swap-vertical',
  empty: 'add',
  goalie: 'help',
  off: 'moon',
  clean: 'checkmark',
};

function moveColor(move: CoachMove): string {
  if (move.kind === 'clean') return colors.good;
  if (move.severity <= 1) return colors.accent;
  if (move.severity === 2) return colors.warn;
  return colors.muted;
}

function niceDate(date: string): string {
  const day = weekdayAbbrev(date);
  return `${day.slice(0, 1)}${day.slice(1).toLowerCase()} ${shortDate(date)}`;
}

/** "02H : 14M" style countdown, F1 lock-deadline format. */
function countdownText(startTimeUTC: string | null, now: Date): string {
  if (!startTimeUTC) return '—';
  const ms = Date.parse(startTimeUTC) - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 'LOCKED';
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return days > 0 ? `${pad(days)}D : ${pad(hours)}H` : `${pad(hours)}H : ${pad(mins % 60)}M`;
}

export default function TonightScreen() {
  const wide = useWide();
  const router = useRouter();
  const { team, ready } = useTeams();
  const { isPremium } = useSubscription();
  const { openPaywall } = usePaywall();
  const { openPlayer } = usePlayerSheet();
  const [night, setNight] = useState<Night>('tonight');
  const [adding, setAdding] = useState(false);
  const [sharing, setSharing] = useState(false);
  const view = useNight(team, night === 'tonight' ? 0 : 1);
  const now = useNow();

  const players = useMemo(() => (team?.players ?? []).filter((player) => !player.injuredReserve), [team]);
  const unlinked = useMemo(() => (team?.players ?? []).filter((player) => !isNhlLinked(player)), [team]);
  const byId = useMemo(() => new Map((team?.players ?? []).map((player) => [player.playerId, player])), [team]);
  const data = view.night.data;
  const forms = view.forms.data?.forms;
  const strength = view.forms.data?.teamStrength;
  const gamesById = useMemo(() => new Map((data?.games ?? []).map((game) => [game.id, game])), [data]);

  const playing = useMemo(() => {
    if (!data) return [] as FantasyPlayer[];
    return players
      .filter((player) => data.playerGames[player.playerId])
      .sort((a, b) => {
        const ga = data.playerGames[a.playerId]?.startTimeUTC ?? '';
        const gb = data.playerGames[b.playerId]?.startTimeUTC ?? '';
        return ga.localeCompare(gb) || (forms?.get(b.playerId)?.value ?? 0) - (forms?.get(a.playerId)?.value ?? 0);
      });
  }, [data, players, forms]);
  const idle = useMemo(() => players.filter((player) => isNhlLinked(player) && !data?.playerGames[player.playerId]), [players, data]);

  const problems = view.moves.filter((move) => move.severity <= 1).length;
  const firstPuck = playing
    .map((player) => data?.playerGames[player.playerId])
    .filter((game) => game && !isGameStarted(game))
    .map((game) => game!.startTimeUTC)
    .filter((time): time is string => !!time)
    .sort()[0] ?? null;
  const startersById = new Map((view.day?.starters ?? []).map((seat) => [seat.playerId, seat.slot]));
  const moves = visibleMoves(view.moves, isPremium);
  const hiddenMoves = view.moves.length - moves.length;

  const goToPickups = (move?: CoachMove) => {
    const params: Record<string, string> = {};
    if (move?.slot) params.slot = move.slot;
    if (view.date) params.date = view.date;
    router.push({ pathname: '/pickups', params } as unknown as Href);
  };

  const header = (
    <PageHeader
      title={night === 'tonight' ? 'Tonight' : 'Tomorrow'}
      accessory={<TeamSwitcher />}
      right={team && team.players.length > 0 ? (
        <SegmentedControl<Night>
          value={night}
          onChange={trackedChoice<Night>('tonight', 'night', setNight)}
          options={[{ value: 'tonight', label: 'Today' }, { value: 'tomorrow', label: 'Next' }]}
          testID="night-toggle"
          style={styles.toggle}
        />
      ) : undefined}
    />
  );

  if (!ready) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.padded}><LoadingRows count={6} /></View>
      </View>
    );
  }

  if (!team || team.players.length === 0) {
    return (
      <View style={styles.container} testID="tonight-empty">
        {header}
        <EmptyState
          art={ART.emptyRoster}
          title="Build your team"
          body="Add the players on your Yahoo, ESPN, or Fantrax roster. PuckIQ tells you who plays, who’s scratched, and what to change before lock."
          action={<PrimaryButton label="Add players" icon="add" onPress={() => setAdding(true)} testID="tonight-add-players" />}
        />
        <PlayerSearchSheet visible={adding} mode={{ kind: 'add', list: 'players' }} onClose={() => setAdding(false)} />
      </View>
    );
  }

  const headlineCount = playing.length;
  const total = players.filter((player) => isNhlLinked(player)).length;

  const shareContent: ShareCardContent | null = headlineCount > 0 && data ? {
    kind: 'tonight',
    kicker: niceDate(view.date).toUpperCase(),
    teamName: team.name,
    count: headlineCount,
    countSuffix: `OF ${total}`,
    caption: night === 'tonight' ? 'playing tonight' : 'playing tomorrow',
    players: [...playing]
      .sort((a, b) => (forms?.get(b.playerId)?.value ?? 0) - (forms?.get(a.playerId)?.value ?? 0))
      .map((player) => {
        const game = data.playerGames[player.playerId];
        return {
          playerId: player.playerId,
          name: player.playerName,
          team: player.teamAbbrev,
          position: player.position,
          detail: game ? `${game.isHome ? 'vs' : '@'} ${game.opponent}` : undefined,
        };
      }),
  } : null;

  // Best-lineup grid rows, in slot order.
  const lineupRows = view.day
    ? SLOT_ORDER.map((slot) => ({
        slot,
        seats: view.day!.starters.filter((seat) => seat.slot === slot).map((seat) => seat.playerId),
        empty: view.day!.empty.filter((value) => value === slot).length,
      })).filter((row) => row.seats.length + row.empty > 0)
    : [];

  return (
    <View style={styles.container} testID="tonight-screen">
      {header}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentFrame]}
        refreshControl={<RefreshControl refreshing={view.refreshing} onRefresh={view.refresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {unlinked.length > 0 ? (
          <Card onPress={() => router.push('/myteam' as Href)} style={styles.linkBanner} testID="tonight-unlinked">
            <View style={[styles.moveIcon, { backgroundColor: colors.warn }]}>
              <Ionicons name="link" size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.linkText}>
              {unlinked.length} {unlinked.length === 1 ? 'name needs' : 'names need'} linking to an NHL player
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Card>
        ) : null}

        {view.error && !data ? <ErrorState body="Tonight’s games didn’t load. Check your connection and try again." onRetry={view.refresh} /> : null}

        <Columns
          left={(
            <>
        <SampleTeamNotice />

        {/* Hero */}
        <DarkCard texture style={styles.hero} testID="tonight-headline">
          <View style={styles.kickerRow}>
            <View style={styles.kickerDot} />
            <Text style={styles.kicker}>{niceDate(view.date).toUpperCase()}</Text>
            {shareContent ? <View style={styles.kickerSpacer} /> : null}
            {shareContent ? <ShareButton onPress={() => setSharing(true)} testID="tonight-share" /> : null}
          </View>
          {view.loading && !data ? (
            <Text style={styles.heroQuiet}>Loading your night…</Text>
          ) : headlineCount > 0 ? (
            <>
              <View style={styles.heroCountRow}>
                <Text style={styles.heroCount}>{headlineCount}</Text>
                <View style={styles.heroCountText}>
                  <Text style={styles.heroOf}>OF {total}</Text>
                  <Text style={styles.heroPlay}>{night === 'tonight' ? 'of your players play tonight' : 'of your players play tomorrow'}</Text>
                </View>
              </View>
              <View style={styles.heroStats}>
                <StatCell dark value={String(problems)} label={problems === 1 ? 'Problem' : 'Problems'} tone={problems > 0 ? 'accent' : 'neutral'} testID="tonight-problems" size={26} />
                <StatCell dark value={view.day ? String(view.day.starters.length) : '—'} label="Starters" size={26} />
                <StatCell dark value={view.day ? String(view.day.empty.length) : '—'} label="Empty slots" tone={view.day && view.day.empty.length > 0 ? 'warn' : 'neutral'} size={26} />
              </View>
              {firstPuck ? (
                <CountdownBar
                  onDark
                  urgent={Date.parse(firstPuck) - now.getTime() < 60 * 60 * 1000}
                  label="First lock"
                  value={countdownText(firstPuck, now)}
                  testID="tonight-countdown"
                />
              ) : (
                <CountdownBar onDark urgent={view.liveGames} flag={!view.liveGames} label={view.liveGames ? 'Games in progress' : 'All games final'} value={view.liveGames ? 'LIVE' : 'FINAL'} />
              )}
            </>
          ) : (
            <>
              {data && data.games.length === 0 && data.preseasonGames > 0 ? (
                <>
                  <Text style={styles.heroQuiet} testID="tonight-preseason">Preseason {night === 'tonight' ? 'tonight.' : 'tomorrow.'}</Text>
                  <Text style={styles.heroSub}>
                    {data.preseasonGames} exhibition {data.preseasonGames === 1 ? 'game doesn’t' : 'games don’t'} count in fantasy.
                    {data.nextDate ? ` Fantasy starts ${niceDate(data.nextDate)}.` : ''}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.heroQuiet}>No games for your roster {night === 'tonight' ? 'tonight.' : 'tomorrow.'}</Text>
                  <Text style={styles.heroSub}>
                    {data?.nextDate ? `Next games: ${niceDate(data.nextDate)}` : 'Check the Week tab for the schedule.'}
                  </Text>
                </>
              )}
            </>
          )}
        </DarkCard>

        {data && headlineCount === 0 ? (
          <Image source={ART.noGames} style={styles.quietArt} contentFit="contain" accessible={false} testID="tonight-no-games-art" />
        ) : null}

        {/* Coach moves */}
        {headlineCount > 0 && view.moves.length > 0 ? (
          <>
            <SectionLabel title={firstPuck ? 'Before lock' : view.liveGames ? `${night === 'tonight' ? 'Tonight' : 'Tomorrow'} · live` : night === 'tonight' ? 'Tonight’s calls' : 'Tomorrow’s calls'} />
            <View style={styles.stack}>
              {moves.map((move) => (
                <Card key={move.id} style={styles.move} testID={`move-${move.kind}`}>
                  {move.kind === 'clean' ? (
                    <Image source={ART.goalLampBadge} style={styles.cleanArt} contentFit="contain" accessible={false} testID="move-clean-art" />
                  ) : (
                    <View style={[styles.moveIcon, { backgroundColor: moveColor(move) }]}>
                      <Ionicons name={MOVE_ICON[move.kind]} size={16} color="#FFFFFF" />
                    </View>
                  )}
                  <View style={styles.moveText}>
                    <Text style={styles.moveTitle}>{move.title}</Text>
                    <Text style={styles.moveDetail}>{move.detail}</Text>
                    {move.kind === 'goalie' ? (
                      <Pressable onPress={() => Linking.openURL(STARTING_GOALIES_URL)} hitSlop={6} accessibilityRole="link">
                        <Text style={styles.moveLink}>Projected starters · Daily Faceoff ↗</Text>
                      </Pressable>
                    ) : null}
                    {move.kind === 'empty' ? (
                      <Pressable onPress={() => (isPremium ? goToPickups(move) : openPaywall('pickups'))} hitSlop={6}>
                        <Text style={styles.moveLink}>Find a {move.slot === 'UTIL' ? 'skater' : move.slot} who plays {night === 'tonight' ? 'tonight' : 'tomorrow'} →</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Card>
              ))}
              {hiddenMoves > 0 ? (
                <ProLockCard
                  title={`${hiddenMoves} more ${hiddenMoves === 1 ? 'move' : 'moves'} ${night === 'tonight' ? 'tonight' : 'tomorrow'}`}
                  detail="Overflow sits, empty slots, goalie start rates, and every injury check — the full list before lock."
                  onPress={() => openPaywall('tonight_moves')}
                  testID="tonight-more-moves"
                />
              ) : null}
            </View>
            <Text style={styles.hostNote}>{HOST_NOTE}</Text>
          </>
        ) : null}

            </>
          )}
          right={(
            <>
        {/* Best lineup */}
        {headlineCount > 0 && view.day ? (
          <>
            <SectionLabel title="Best lineup" flush={wide} />
            {isPremium ? (
              <DarkCard style={styles.lineup} testID="tonight-lineup">
                {lineupRows.map((row) => (
                  <View key={row.slot} style={styles.lineupRow}>
                    <Text style={styles.lineupSlot} numberOfLines={1}>{row.slot}</Text>
                    <View style={styles.lineupTiles}>
                      {row.seats.map((id) => {
                        const player = byId.get(id);
                        const game = data?.playerGames[id];
                        return (
                          <Pressable key={id} style={styles.lineupTile} onPress={() => openPlayer(id, 'roster')} accessibilityLabel={player?.playerName}>
                            <PlayerAvatar playerId={id} team={player?.teamAbbrev ?? ''} position={player?.position ?? ''} size={52} />
                            <Text style={styles.lineupName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                              {(player?.playerName ?? '').split(' ').slice(-1)[0].toUpperCase()}
                            </Text>
                            <Text style={styles.lineupOpp}>{game ? `${game.isHome ? 'vs' : '@'} ${game.opponent}` : ''}</Text>
                          </Pressable>
                        );
                      })}
                      {Array.from({ length: row.empty }, (_, index) => (
                        <View key={`empty-${index}`} style={styles.lineupTile}>
                          <View style={styles.emptyTile}>
                            <Ionicons name="add" size={18} color={colors.warn} />
                          </View>
                          <Text style={styles.emptyLabel}>EMPTY</Text>
                          <Text style={styles.lineupOpp}>no game</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
                {view.day.bench.length > 0 ? (
                  <View style={styles.benchBlock}>
                    <Text style={styles.benchLabel}>BENCH · PLAYING, NO SLOT</Text>
                    <Text style={styles.benchNames}>
                      {view.day.bench.map((id) => byId.get(id)?.playerName).filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                ) : null}
              </DarkCard>
            ) : (
              <ProLockCard
                title="Tonight’s best lineup"
                detail={`Who goes in each of your ${view.day.starters.length + view.day.empty.length} active slots — built for your league’s positions, not just “has a game.”`}
                onPress={() => openPaywall('tonight_lineup')}
                testID="tonight-lineup-locked"
              />
            )}
          </>
        ) : null}

        {/* Players */}
        {headlineCount > 0 ? <SectionLabel title={night === 'tonight' ? 'Your players tonight' : 'Your players'} /> : null}
        {view.loading && !data ? <LoadingRows count={5} /> : null}
        <View style={styles.stack}>
          {playing.map((player) => {
            const game = data!.playerGames[player.playerId]!;
            const full = gamesById.get(game.gameId);
            const status = data!.statuses.get(player.playerId);
            const line = data!.liveLines.get(player.playerId);
            const form = forms?.get(player.playerId);
            const started = isGameStarted(game);
            const final = isGameFinal(game);
            const opp = strength?.get(game.opponent);
            // Skaters care how many goals the opponent allows; goalies care how many it scores.
            const matchupTag = !opp
              ? null
              : form?.isGoalie
                ? opp.offenseRank <= 8 ? { label: 'TOUGH O', tone: 'bad' as const } : opp.offenseRank >= 25 ? { label: 'WEAK O', tone: 'good' as const } : null
                : opp.matchupRank <= 8 ? { label: 'SOFT D', tone: 'good' as const } : opp.matchupRank >= 25 ? { label: 'TOUGH D', tone: 'bad' as const } : null;
            const slot = startersById.get(player.playerId) as SlotKey | undefined;
            const scratched = status?.signal === 'scratch' && status.confidence === 'confirmed';
            const value = line ? liveLineValue(line, team.scoring, final && full ? didGoalieWin(line.isGoalie, full, player.teamAbbrev) : false) : null;
            return (
              <Card key={player.playerId} onPress={() => openPlayer(player.playerId, 'roster')} style={styles.playerCard} testID={`tonight-player-${player.playerId}`}>
                <View style={styles.playerRow}>
                  <PlayerAvatar playerId={player.playerId} team={player.teamAbbrev} position={player.position} size={56} />
                  <View style={styles.playerText}>
                    <PlayerName name={player.playerName} size={17} style={scratched ? styles.struck : undefined} />
                    <View style={styles.metaRow}>
                      <Text style={styles.playerMeta}>{positionLabel(player)}</Text>
                      <TeamChip team={game.opponent} prefix={game.isHome ? 'vs' : '@'} />
                      {matchupTag ? <Pill label={matchupTag.label} tone={matchupTag.tone} /> : null}
                    </View>
                  </View>
                  <View style={styles.playerRight}>
                    {value !== null ? (
                      <Text style={styles.value}>{formatValue(value)}</Text>
                    ) : started && full ? (
                      <Text style={[styles.clock, !final && styles.clockLive]}>{gameClock(full)}</Text>
                    ) : (
                      <Text style={styles.puck}>{formatPuckDrop(game.startTimeUTC)}</Text>
                    )}
                    {started && full && value !== null ? (
                      <Text style={[styles.clockSmall, !final && styles.clockLive]}>{gameClock(full)}</Text>
                    ) : isPremium && slot ? (
                      <Text style={styles.slotTag}>{slot}</Text>
                    ) : null}
                  </View>
                </View>
                <StatusRow>
                  {scratched ? <Pill key="scr" label="SCRATCHED · NHL" tone="bad" solid /> : null}
                  {status && status.confidence === 'likely' ? <Pill key="inj" label={status.signal === 'dtd' ? 'DTD NEWS' : 'INJURY NEWS'} tone="warn" /> : null}
                  {!started && form?.isGoalie && !scratched ? <Pill key="gs" label={`STARTER TBD · ${Math.round(form.startShare * 100)}% GS`} tone="muted" /> : null}
                  {form && form.trend === 'hot' ? <HotBadge key="hot" /> : null}
                  {form && form.trend === 'cold' ? <ColdBadge key="cold" /> : null}
                  {line ? (
                    <Text key="line" style={styles.liveLine}>{liveLineText(line)}</Text>
                  ) : started && !scratched ? (
                    <Text key="none" style={styles.liveMuted}>Not in the box score yet</Text>
                  ) : null}
                </StatusRow>
              </Card>
            );
          })}
        </View>

        {idle.length > 0 && data ? (
          <>
            <SectionLabel title={`No game (${idle.length})`} />
            <Card>
              <Text style={styles.idleNames}>{idle.map((player) => player.playerName).join(' · ')}</Text>
            </Card>
          </>
        ) : null}

            </>
          )}
        />

        <Text style={styles.sourceNote}>
          Scratches come from the NHL game report. The NHL doesn’t announce starting goalies before puck drop, so we don’t either.
        </Text>
      </ScrollView>
      <ShareCardSheet visible={sharing} content={shareContent} onClose={() => setSharing(false)} />
    </View>
  );
}

function StatusRow({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  if (items.length === 0) return null;
  return <View style={styles.statusRow}>{items}</View>;
}

function didGoalieWin(isGoalie: boolean, game: { home: string; away: string; homeScore: number | null; awayScore: number | null }, team: string): boolean {
  if (!isGoalie || game.homeScore == null || game.awayScore == null) return false;
  const mine = game.home === team.toUpperCase() ? game.homeScore : game.awayScore;
  const theirs = game.home === team.toUpperCase() ? game.awayScore : game.homeScore;
  return mine > theirs;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  padded: {
    paddingHorizontal: 16,
  },
  toggle: {
    width: 150,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 130,
  },
  stack: {
    gap: 10,
  },
  linkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  linkText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  hero: {
    gap: 14,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cleanArt: {
    width: 34,
    height: 34 / ART_ASPECT.goalLampBadge,
  },
  quietArt: {
    width: '100%',
    aspectRatio: 1,
    marginTop: 4,
  },
  kickerSpacer: {
    flex: 1,
  },
  kickerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.onInk,
  },
  heroCountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  heroCount: {
    ...display(76),
    color: colors.onInk,
    lineHeight: 80,
    letterSpacing: -3,
  },
  heroCountText: {
    flex: 1,
    paddingBottom: 10,
  },
  heroOf: {
    ...display(22),
    color: colors.onInkSub,
  },
  heroPlay: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onInk,
  },
  heroStats: {
    flexDirection: 'row',
  },
  heroQuiet: {
    ...display(26),
    color: colors.onInk,
  },
  heroSub: {
    fontSize: 15,
    color: colors.onInkSub,
  },
  move: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  moveIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveText: {
    flex: 1,
    gap: 3,
  },
  moveTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  moveDetail: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.sub,
  },
  moveLink: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.accent,
    marginTop: 4,
  },
  hostNote: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
  },
  lineup: {
    gap: 14,
  },
  lineupRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  lineupSlot: {
    ...display(15),
    // Wide enough for "UTIL" once display()'s italic bleed padding is counted.
    width: 46,
    color: colors.accent,
    paddingTop: 16,
  },
  lineupTiles: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 12,
  },
  lineupTile: {
    width: 60,
    alignItems: 'center',
    gap: 4,
  },
  lineupName: {
    width: 60,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '900',
    color: colors.onInk,
  },
  lineupOpp: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.onInkSub,
  },
  emptyTile: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.warn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.warn,
    textAlign: 'center',
  },
  benchBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 12,
  },
  benchLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: colors.onInkSub,
  },
  benchNames: {
    fontSize: 14,
    color: colors.onInk,
    marginTop: 4,
  },
  playerCard: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playerText: {
    flex: 1,
    gap: 6,
  },
  struck: {
    textDecorationLine: 'line-through',
    color: colors.muted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  playerMeta: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.sub,
  },
  playerRight: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 56,
  },
  value: {
    ...display(26),
  },
  puck: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  clock: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.sub,
  },
  clockSmall: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
  },
  clockLive: {
    color: colors.accent,
  },
  slotTag: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.accent,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginLeft: 68,
  },
  liveLine: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  liveMuted: {
    fontSize: 13,
    color: colors.muted,
  },
  idleNames: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.sub,
  },
  sourceNote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 22,
  },
});
