/**
 * Tonight — home. Before lock: who plays, the moves to make, the best lineup. Once pucks drop:
 * the night's scoreboard, a timing-tower player list and live points on the lineup board.
 * Mornings until noon ET: last night's recap leads the screen. New users get a guided first night;
 * a game-night reminder is offered when it matters; "up next" closes the screen with one next step.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { trackedChoice } from '../../services/analytics/selection';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import type { FantasyPlayer, LeagueFormat, SlotKey } from '../../types/fantasy';
import { useNight } from '../../hooks/useCoach';
import { useGoalHaptics, useNightPublisher } from '../../hooks/useNightLive';
import { useTonightGuidance } from '../../hooks/useTonightGuidance';
import { useNightTallies } from '../../hooks/useNightTallies';
import { visibleMoves, type CoachMove } from '../../services/fantasy/coach';
import { isNhlLinked } from '../../services/fantasy/positions';
import { hasRecap, performerLine, recapWindowOpen } from '../../services/fantasy/recap';
import { isGameStarted } from '../../services/nhl/schedule';
import { isCategoryLeague, leagueFormatChosen } from '../../services/fantasy/categories';
import { withLeagueFormat } from '../../services/teams';
import { hostLinkFor } from '../../services/fantasy/hostLinks';
import { track } from '../../services/analytics/track';
import PageHeader from '../PageHeader';
import { useTeams } from '../TeamsProvider';
import { useSubscription } from '../SubscriptionProvider';
import { usePaywall } from '../PaywallProvider';
import { usePlayerSheet } from '../sheets/PlayerSheet';
import PlayerSearchSheet from '../sheets/PlayerSearchSheet';
import { RosterImportSheet } from '../rosterImport/RosterImportSheet';
import TeamSwitcher from '../coach/TeamSwitcher';
import SampleTeamNotice from '../coach/SampleTeamNotice';
import { ShareCardSheet, type ShareCardContent } from '../share/ShareCards';
import { useNow } from '../coach/format';
import { Card, colors, Columns, contentFrame, EmptyState, ErrorState, GhostButton, LoadingRows, PrimaryButton, ProLockCard, SectionLabel, SegmentedControl, useWide } from '../coach/ui';
import { ART } from '../../constants/art';
import { HockeyHero } from '../coach/HockeyHero';
import { TonightHero } from '../tonight/TonightHero';
import { CoachMovesSection } from '../tonight/CoachMovesSection';
import { LineupBoard } from '../tonight/LineupBoard';
import { matchupTagFor } from '../../services/fantasy/matchupTag';
import { PlayerNightCard } from '../tonight/PlayerNightCard';
import { RecapCard } from '../tonight/RecapCard';
import { FirstNightGuide } from '../tonight/FirstNightGuide';
import { NextUpCard } from '../tonight/NextUpCard';
import { ReminderPromptCard } from '../tonight/ReminderPromptCard';
import { LeagueFormatPrompt } from '../tonight/LeagueFormatPrompt';
import { recapShareContent, tonightShareContent } from '../tonight/shareContent';

type Night = 'tonight' | 'tomorrow';
type Sharing = 'night' | 'recap' | null;

/** Room above "Your players tonight" when the first-night guide scrolls to it. */
const PLAYERS_SCROLL_MARGIN = 12;

export default function TonightScreen() {
  const wide = useWide();
  const router = useRouter();
  const { team, ready, updateTeam } = useTeams();
  const { isPremium } = useSubscription();
  const { openPaywall } = usePaywall();
  const { openPlayer } = usePlayerSheet();
  const [night, setNight] = useState<Night>('tonight');
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sharing, setSharing] = useState<Sharing>(null);
  const now = useNow();
  const isTonight = night === 'tonight';
  const view = useNight(team, isTonight ? 0 : 1);
  const recapOpen = isTonight && recapWindowOpen(now);
  const recap = useNight(team, -1, recapOpen);
  const follow = useNightPublisher(team, view, isPremium, isTonight);
  useGoalHaptics(view.night.data?.liveLines, isTonight);

  const players = useMemo(() => (team?.players ?? []).filter((player) => !player.injuredReserve), [team]);
  const unlinked = useMemo(() => (team?.players ?? []).filter((player) => !isNhlLinked(player)), [team]);
  const byId = useMemo(() => new Map((team?.players ?? []).map((player) => [player.playerId, player])), [team]);
  const data = view.night.data;
  const forms = view.forms.data?.forms;
  const strength = view.forms.data?.teamStrength;
  const score = isTonight ? view.score : null;
  const started = !!score && score.phase !== 'pre';
  const gamesById = useMemo(() => new Map((data?.games ?? []).map((game) => [game.id, game])), [data]);
  const nightById = useMemo(() => new Map((score?.players ?? []).map((row) => [row.playerId, row])), [score]);

  const playing = useMemo(() => {
    if (!data) return [] as FantasyPlayer[];
    const list = players.filter((player) => data.playerGames[player.playerId]);
    if (started) {
      // Timing tower: the score's order (points, then puck drop).
      const order = new Map(score!.players.map((row, index) => [row.playerId, index]));
      return list.sort((a, b) => (order.get(a.playerId) ?? 999) - (order.get(b.playerId) ?? 999));
    }
    return list.sort((a, b) => {
      const ga = data.playerGames[a.playerId]?.startTimeUTC ?? '';
      const gb = data.playerGames[b.playerId]?.startTimeUTC ?? '';
      return ga.localeCompare(gb) || (forms?.get(b.playerId)?.value ?? 0) - (forms?.get(a.playerId)?.value ?? 0);
    });
  }, [data, players, forms, started, score]);
  const idle = useMemo(() => players.filter((player) => isNhlLinked(player) && !data?.playerGames[player.playerId]), [players, data]);

  const scroll = useRef<ScrollView>(null);
  const playersY = useRef(0);
  const showTomorrow = useCallback(() => {
    setNight('tomorrow');
    scroll.current?.scrollTo({ y: 0, animated: true });
  }, []);
  const showPlayers = useCallback(() => {
    scroll.current?.scrollTo({ y: Math.max(0, playersY.current - PLAYERS_SCROLL_MARGIN), animated: true });
  }, []);
  const guidance = useTonightGuidance({ team, view, night, playing, isPro: isPremium, showTomorrow, showPlayers });

  const recapScore = recapOpen && hasRecap(recap.score) ? recap.score : null;
  const categories = isCategoryLeague(team) ? team?.categories ?? null : null;
  const tallies = useNightTallies(team, score, data?.liveLines, isPremium);
  const recapTallies = useNightTallies(team, recapScore, recap.night.data?.liveLines, isPremium);
  useAnalyticsOnce('recap_view', recapScore ? recap.date : null);
  useAnalyticsOnce('live_view', score?.phase === 'live' ? view.date : null);

  const problems = view.moves.filter((move) => move.severity <= 1).length;
  const firstPuck = playing
    .map((player) => data?.playerGames[player.playerId])
    .filter((game) => game && !isGameStarted(gamesById.get(game.gameId) ?? game))
    .map((game) => game!.startTimeUTC)
    .filter((time): time is string => !!time)
    .sort()[0] ?? null;
  const startersById = new Map((view.day?.starters ?? []).map((seat) => [seat.playerId, seat.slot]));
  const moves = visibleMoves(view.moves, isPremium);

  // Teams set up before category leagues existed get asked once how their league scores.
  const askFormat = !!team && !leagueFormatChosen(team) && players.length > 0;
  const answerFormat = (format: LeagueFormat) => {
    track('league_format_set', { format, source: 'tonight_prompt' });
    updateTeam((current) => withLeagueFormat(current, format));
  };

  const findPickup = (move: CoachMove, slot?: SlotKey) => {
    if (!isPremium) {
      openPaywall('pickups');
      return;
    }
    const params: Record<string, string> = {};
    const target = slot ?? move.slot;
    if (target) params.slot = target;
    if (view.date) params.date = view.date;
    router.push({ pathname: '/pickups', params } as unknown as Href);
  };

  const header = (
    <PageHeader
      title={isTonight ? 'PuckIQ' : 'Tomorrow'}
      accessory={<TeamSwitcher />}
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
          body="Import your Yahoo, ESPN, or Fantrax roster from a screenshot, or search players. PuckIQ tells you who plays, who’s scratched, and what to change before lock."
          action={(
            <View style={styles.emptyActions}>
              <PrimaryButton label="Import from screenshots" icon="scan-outline" onPress={() => setImporting(true)} testID="tonight-import" />
              <GhostButton label="Search players" icon="search" tone="neutral" onPress={() => setAdding(true)} testID="tonight-add-players" />
            </View>
          )}
        />
        <PlayerSearchSheet visible={adding} mode={{ kind: 'add', list: 'players' }} onClose={() => setAdding(false)} />
        <RosterImportSheet visible={importing} source="tonight" onClose={() => setImporting(false)} />
      </View>
    );
  }

  const total = players.filter((player) => isNhlLinked(player)).length;
  const topLine = score?.top ? performerLine(score.top, byId.get(score.top.playerId), data?.liveLines.get(score.top.playerId), { withLabel: false }) : null;
  const nightShare: ShareCardContent | null = !data
    ? null
    : score?.phase === 'final' && hasRecap(score)
      ? recapShareContent({ team, data, score, isPro: isPremium })
      : tonightShareContent({ team, data, date: view.date, playing, total, forms, when: night });
  const recapShare = recapScore && recap.night.data ? recapShareContent({ team, data: recap.night.data, score: recapScore, isPro: isPremium }) : null;
  // Moves only help while something can still change: once every game has started, nothing can.
  const locked = !!score && score.phase !== 'pre' && score.upcoming === 0;
  const movesTitle = firstPuck ? 'Before lock' : started && score!.phase === 'live' ? 'Tonight · live' : isTonight ? 'Tonight’s calls' : 'Tomorrow’s calls';

  return (
    <View style={styles.container} testID="tonight-screen">
      {header}
      <View style={styles.nightControl}>
        <SegmentedControl<Night>
          value={night}
          onChange={trackedChoice<Night>('tonight', 'night', setNight)}
          options={[{ value: 'tonight', label: 'Today' }, { value: 'tomorrow', label: 'Tomorrow' }]}
          testID="night-toggle"
        />
      </View>
      <ScrollView
        ref={scroll}
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentFrame]}
        refreshControl={<RefreshControl refreshing={view.refreshing} onRefresh={view.refresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={{flexDirection:'row',gap:10,marginBottom:16}}>
          <Card onPress={() => router.push('/lineup' as Href)} style={{flex:1,gap:7}}><Ionicons name="sparkles" size={20} color={colors.accent}/><Text style={{color:colors.text,fontSize:14,fontWeight:'600'}}>Best lineup</Text><Text style={{color:colors.sub,fontSize:11}}>Compare & save your plan →</Text></Card>
          <Card onPress={() => router.push('/insights' as Href)} style={{flex:1,gap:7}}><Ionicons name="trending-up" size={20} color={colors.accent}/><Text style={{color:colors.text,fontSize:14,fontWeight:'600'}}>Your insights</Text><Text style={{color:colors.sub,fontSize:11}}>Players, pickups & trades →</Text></Card>
        </View>
        {unlinked.length > 0 ? (
          <Card onPress={() => router.push('/myteam' as Href)} style={styles.linkBanner} testID="tonight-unlinked">
            <View style={styles.linkIcon}>
              <Ionicons name="link" size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.linkText}>
              {unlinked.length} {unlinked.length === 1 ? 'name needs' : 'names need'} linking to an NHL player
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Card>
        ) : null}

        {view.error ? <ErrorState body={view.error} onRetry={view.refresh} /> : null}

        <Columns
          left={(
            <>
              {guidance.firstNight.visible ? (
                <FirstNightGuide
                  done={guidance.firstNight.done}
                  quietNight={guidance.firstNight.quietNight}
                  onStep={guidance.firstNight.onStep}
                  onDismiss={guidance.firstNight.onDismiss}
                />
              ) : null}
              <SampleTeamNotice />
              {recapScore ? (
                <RecapCard
                  date={recap.date}
                  score={recapScore}
                  tallies={recapTallies}
                  lines={recap.night.data?.liveLines ?? new Map()}
                  isPro={isPremium}
                  byId={byId}
                  onShare={recapShare ? () => setSharing('recap') : null}
                  onOpenPlayer={(id) => openPlayer(id, 'roster', 'recap')}
                  onUnlock={() => openPaywall('recap')}
                />
              ) : null}
              <TonightHero
                date={view.date}
                night={night}
                loading={view.loading && !data}
                playingCount={playing.length}
                total={total}
                problems={problems}
                starters={view.day ? view.day.starters.length : null}
                emptySlots={view.day ? view.day.empty.length : null}
                firstPuck={firstPuck}
                now={now}
                score={score}
                tallies={tallies}
                isPro={isPremium}
                topLine={topLine}
                quiet={data ? { preseasonGames: data.games.length === 0 ? data.preseasonGames : 0, nextDate: data.nextDate } : null}
                onShare={nightShare ? () => setSharing('night') : null}
                follow={isTonight ? follow : null}
              />
              {askFormat ? <LeagueFormatPrompt onAnswer={answerFormat} /> : null}
              {guidance.reminderPrompt.visible ? (
                <ReminderPromptCard onAccept={guidance.reminderPrompt.accept} onDismiss={guidance.reminderPrompt.dismiss} />
              ) : null}
              {data && playing.length === 0 ? (
                <Image source={ART.noGames} style={styles.quietArt} contentFit="contain" accessible={false} testID="tonight-no-games-art" />
              ) : null}
              {playing.length > 0 && view.moves.length > 0 && !locked ? (
                <CoachMovesSection
                  title={movesTitle}
                  moves={moves}
                  hiddenCount={view.moves.length - moves.length}
                  when={night}
                  byId={byId}
                  host={hostLinkFor(team)}
                  onFindPickup={findPickup}
                  onUnlock={() => openPaywall('tonight_moves')}
                />
              ) : null}
            </>
          )}
          right={(
            <>
              {playing.length > 0 && view.day ? (
                <>
                  <SectionLabel title={team.lineupChoices?.[view.date] ? "Your saved lineup" : "Best lineup"} flush={wide} right={<GhostButton label="Optimize" onPress={() => router.push('/lineup' as Href)} />} />
                  {isPremium ? (
                    <LineupBoard
                      day={view.day}
                      values={view.lineupValues}
                      byId={byId}
                      games={data?.playerGames ?? {}}
                      score={score}
                      lines={categories ? data?.liveLines ?? null : null}
                      onOpenPlayer={(id) => openPlayer(id, 'roster', 'lineup')}
                    />
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

              <View onLayout={(event) => { playersY.current = event.nativeEvent.layout.y; }}>
                {playing.length > 0 ? <SectionLabel title={isTonight ? 'Your players tonight' : 'Your players'} /> : null}
                {view.loading && !data ? <LoadingRows count={5} /> : null}
                <View style={styles.stack}>
                  {playing.map((player) => {
                    const game = data!.playerGames[player.playerId]!;
                    const form = forms?.get(player.playerId);
                    return (
                      <PlayerNightCard
                        key={player.playerId}
                        player={player}
                        game={game}
                        fullGame={gamesById.get(game.gameId)}
                        status={data!.statuses.get(player.playerId)}
                        line={data!.liveLines.get(player.playerId)}
                        form={form}
                        night={nightById.get(player.playerId)}
                        slot={startersById.get(player.playerId)}
                        matchupTag={matchupTagFor(form, strength?.get(game.opponent))}
                        goalieOutlook={view.goalieOutlooks.get(player.playerId)}
                        categories={categories}
                        isPro={isPremium}
                        onPress={() => openPlayer(player.playerId, 'roster', 'tonight')}
                      />
                    );
                  })}
                </View>
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
        {guidance.nextUp.item ? <NextUpCard item={guidance.nextUp.item} onPress={guidance.nextUp.onPress} /> : null}
        <HockeyHero compact />
      </ScrollView>
      <ShareCardSheet visible={sharing === 'night'} content={nightShare} onClose={() => setSharing(null)} />
      <ShareCardSheet visible={sharing === 'recap'} content={recapShare} onClose={() => setSharing(null)} />
    </View>
  );
}

/** Fire an event once per distinct key (e.g. once per night), never on re-renders. */
function useAnalyticsOnce(event: string, key: string | null): void {
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!key || sent.current === key) return;
    sent.current = key;
    track(event, {});
  }, [event, key]);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  emptyActions: { alignSelf: 'stretch', gap: 10 },
  padded: { paddingHorizontal: 16 },
  nightControl: { paddingHorizontal: 12, marginBottom: 8 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 12, paddingBottom: 100, gap: 0 },
  stack: { gap: 10 },
  linkBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  linkIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warn },
  linkText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  quietArt: { width: '100%', aspectRatio: 1, marginTop: 4 },
  idleNames: { fontSize: 14, lineHeight: 21, color: colors.sub },
});
