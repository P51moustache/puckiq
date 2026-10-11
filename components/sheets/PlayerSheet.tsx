/**
 * Player detail sheet: who he is, the call on his next game, this week's games, season + recent
 * form, similar players (one card leads to the next), game log, and the roster actions that make
 * sense from where it was opened. The sections live in components/player/.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { GameLogRow } from '../../services/nhl/player';
import { usePlayerDetail } from '../../hooks/usePlayerDetail';
import { usePlayerCard } from '../../hooks/usePlayerCard';
import { normalizePosition } from '../../services/fantasy/positions';
import { DEFAULT_SCORING } from '../../services/fantasy/scoring';
import { daysBetween, seasonLabel, shortDate } from '../../services/nhl/dates';
import { track } from '../../services/analytics/track';
import { useNight, useNhlToday } from '../../hooks/useCoach';
import { useLineupActions } from '../../hooks/useLineupActions';
import { usePlayerOutlook } from '../../hooks/usePlayerOutlook';
import { SectionTabs } from '../coach/SectionTabs';
import { PerformanceChart } from '../player/PerformanceChart';
import { ProjectionSection } from '../player/ProjectionSection';
import { ScheduleAssessment } from '../player/ScheduleAssessment';
import type { PaywallSource } from '../../constants/monetization';
import { useTeams } from '../TeamsProvider';
import { useSubscription } from '../SubscriptionProvider';
import { usePaywall } from '../PaywallProvider';
import { useRoomTakenIds } from '../league/LeagueProvider';
import { colors, Card, PrimaryButton } from '../coach/ui';
import { GameLog } from '../player/GameLog';
import { PlayerActions } from '../player/PlayerActions';
import { PlayerHero, PlayerLoading } from '../player/PlayerHero';
import { PlayerNews } from '../player/PlayerNews';
import {
  HeadlineStats,
  RecentForm,
  SeasonSection,
} from '../player/PlayerStats';
import { RosterSettings } from '../player/RosterSettings';
import { SimilarPlayers } from '../player/SimilarPlayers';
import { TelemetrySection } from '../player/TelemetrySection';
import { useRosterActions } from '../player/useRosterActions';
import { VerdictCard } from '../player/VerdictCard';

export type PlayerSheetContext = 'roster' | 'opponent' | 'pickup' | 'browse';

/**
 * Where a card was opened from, for analytics only. `context` decides the card's actions;
 * `source` tells which screen or element led there (Tonight's cards and My Team both open
 * with context 'roster').
 */
export type PlayerOpenSource =
  | 'tonight'
  | 'lineup'
  | 'recap'
  | 'next_up'
  | 'first_night'
  | 'myteam'
  | 'week'
  | 'pickups'
  | 'league'
  | 'similar'
  | 'other';

interface OpenArgs {
  playerId: number;
  context: PlayerSheetContext;
}

interface PlayerSheetContextValue {
  openPlayer: (
    playerId: number,
    context?: PlayerSheetContext,
    source?: PlayerOpenSource,
  ) => void;
}

const SheetContext = createContext<PlayerSheetContextValue | undefined>(
  undefined,
);

export function PlayerSheetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState<OpenArgs | null>(null);
  const { openPaywall } = usePaywall();
  // iOS can't present the paywall modal over this sheet, so close the sheet first and
  // open the paywall once it has finished dismissing.
  const pendingPaywall = useRef<PaywallSource | null>(null);
  const upsell = useCallback(
    (source: PaywallSource) => {
      if (Platform.OS === 'ios') {
        pendingPaywall.current = source;
        setOpen(null);
      } else {
        setOpen(null);
        openPaywall(source);
      }
    },
    [openPaywall],
  );
  const handleDismiss = useCallback(() => {
    const source = pendingPaywall.current;
    pendingPaywall.current = null;
    if (source) openPaywall(source);
  }, [openPaywall]);
  const openPlayer = useCallback(
    (
      playerId: number,
      context: PlayerSheetContext = 'browse',
      source: PlayerOpenSource = 'other',
    ) => {
      track('player_open', { context, source });
      setOpen({ playerId, context });
    },
    [],
  );
  const value = useMemo(() => ({ openPlayer }), [openPlayer]);
  return (
    <SheetContext.Provider value={value}>
      {children}
      <Modal
        visible={open !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(null)}
        onDismiss={handleDismiss}
      >
        {/* Keyed by player: a card opened from another card starts fresh, scrolled to the top. */}
        {open ? (
          <PlayerSheetBody
            key={open.playerId}
            {...open}
            onClose={() => setOpen(null)}
            onUpsell={upsell}
          />
        ) : null}
      </Modal>
    </SheetContext.Provider>
  );
}

export function usePlayerSheet(): PlayerSheetContextValue {
  const value = useContext(SheetContext);
  if (!value)
    throw new Error('usePlayerSheet must be used within a PlayerSheetProvider');
  return value;
}

const NO_GAMES: GameLogRow[] = [];

function PlayerSheetBody({
  playerId,
  context,
  onClose,
  onUpsell,
}: OpenArgs & {
  onClose: () => void;
  onUpsell: (source: PaywallSource) => void;
}) {
  const { team } = useTeams();
  const { isPremium } = useSubscription();
  const { openPlayer } = usePlayerSheet();
  const takenIds = useRoomTakenIds();
  const scoring = team?.scoring ?? DEFAULT_SCORING;
  const detail = usePlayerDetail(playerId, scoring);

  const profile = detail.data?.profile ?? null;
  const form = detail.data?.form ?? null;
  const goalie = profile ? normalizePosition(profile.position) === 'G' : false;
  const rosterPlayer =
    team?.players.find((player) => player.playerId === playerId) ?? null;
  const onOpponent =
    team?.opponent.some((player) => player.playerId === playerId) ?? false;
  const log = detail.data?.log?.games ?? NO_GAMES;
  const logSeason =
    detail.data?.logIsPrevious && detail.data.log
      ? seasonLabel(detail.data.log.seasonId)
      : null;

  const card = usePlayerCard({
    playerId,
    profile,
    form,
    formSettled: detail.formSettled,
    // "His last 5" means this season; last season's log only fills the table.
    log: detail.data?.logIsPrevious ? NO_GAMES : log,
    team,
    isPro: isPremium,
    takenIds,
  });
  const [tab, setTab] = useState<'overview' | 'stats' | 'schedule' | 'news'>(
    'overview',
  );
  const today = useNhlToday();
  const outlook = usePlayerOutlook(profile, form);
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const nextDate = outlook.upcoming[0]?.game.date ?? today;
  const planDate = chosenDate ?? nextDate;
  const planView = useNight(team, daysBetween(today, planDate), !!rosterPlayer);
  const lineup = useLineupActions(planView);
  const isStarter =
    planView.day?.starters.some((seat) => seat.playerId === playerId) ?? false;
  const canPlay = planView.bestDay?.playing.includes(playerId) ?? false;
  const actionLabel = !rosterPlayer
    ? 'Add to my team'
    : rosterPlayer.injuredReserve
      ? 'Player on IR'
      : lineup.locked
        ? 'Lineup locked'
        : !canPlay
          ? 'No available game'
          : isStarter
            ? 'Move to bench'
            : 'Add to starters';
  const actions = useRosterActions({
    playerId,
    profile,
    rosterPlayer,
    isPro: isPremium,
    onClose,
    onUpsell,
  });

  return (
    <View style={styles.container} testID="player-sheet">
      <ScrollView
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={detail.refreshing}
            tintColor={colors.accent}
            onRefresh={() => {
              detail.refresh();
              outlook.refresh();
              planView.refresh();
            }}
          />
        }
      >
        {!profile ? (
          <PlayerLoading
            loading={detail.loading}
            error={!!detail.error}
            onRetry={detail.refresh}
            onClose={onClose}
          />
        ) : (
          <>
            <PlayerHero
              profile={profile}
              rosterPlayer={rosterPlayer}
              onClose={onClose}
            />
            <View style={styles.body}>
              <SectionTabs
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'overview', label: 'Overview' },
                  { value: 'stats', label: 'Stats' },
                  { value: 'schedule', label: 'Schedule' },
                  { value: 'news', label: 'News' },
                ]}
                testID="player-tab"
              />
              {tab === 'overview' ? (
                <>
                  <HeadlineStats form={form} goalie={goalie} />
                  <VerdictCard
                    verdict={card.verdict}
                    loading={card.verdictLoading}
                  />
                  <ProjectionSection
                    estimate={outlook.estimate}
                    loading={outlook.loading || !detail.formSettled}
                    error={outlook.error}
                  />
                  <PerformanceChart
                    log={log}
                    goalie={goalie}
                    scoring={scoring}
                    isPro={isPremium}
                    seasonLabel={logSeason}
                  />
                  <ScheduleAssessment
                    rows={outlook.upcoming}
                    loading={outlook.loading}
                    error={outlook.error}
                    goalie={goalie}
                    limit={4}
                  />
                  <SimilarPlayers
                    rows={card.similar}
                    onOpen={(id) => openPlayer(id, 'pickup', 'similar')}
                  />
                </>
              ) : tab === 'stats' ? (
                <>
                  <PerformanceChart
                    log={log}
                    goalie={goalie}
                    scoring={scoring}
                    isPro={isPremium}
                    seasonLabel={logSeason}
                  />
                  <SeasonSection form={form} />
                  <RecentForm
                    form={form}
                    goalie={goalie}
                    isPro={isPremium}
                    onUnlock={() => onUpsell('player_trends')}
                  />
                  <TelemetrySection
                    playerId={playerId}
                    goalie={goalie}
                    isPro={isPremium}
                    onUnlock={() => onUpsell('player_edge')}
                  />
                  <GameLog
                    log={log}
                    goalie={goalie}
                    scoring={scoring}
                    isPro={isPremium}
                    seasonLabel={logSeason}
                    onUnlock={() => onUpsell('player_trends')}
                  />
                  {rosterPlayer ? (
                    <RosterSettings
                      rosterPlayer={rosterPlayer}
                      onToggleEligible={actions.toggleEligible}
                      onToggleIr={actions.toggleIr}
                    />
                  ) : null}
                </>
              ) : tab === 'schedule' ? (
                <>
                  <ScheduleAssessment
                    rows={outlook.upcoming}
                    loading={outlook.loading}
                    error={outlook.error}
                    goalie={goalie}
                  />
                  {rosterPlayer ? (
                    <>
                      <Text style={styles.note}>
                        Choose a game date for your saved lineup plan.
                      </Text>
                      <SectionTabs
                        value={planDate}
                        onChange={setChosenDate}
                        options={outlook.upcoming.slice(0, 4).map((row) => ({
                          value: row.game.date,
                          label: shortDate(row.game.date),
                        }))}
                      />
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <PlayerNews items={detail.data?.news ?? []} />
                  {!detail.data?.news.length ? (
                    <Card style={{ marginTop: 18 }}>
                      <Text style={styles.note}>
                        No recent headlines mention this player. Pull to refresh
                        for new reports.
                      </Text>
                    </Card>
                  ) : null}
                </>
              )}
              <PlayerActions
                context={context}
                onMyRoster={!!rosterPlayer}
                onOpponent={onOpponent}
                hasTeam={!!team}
                actions={actions}
              />
            </View>
          </>
        )}
      </ScrollView>
      {profile && team && !onOpponent ? (
        <View style={styles.footer}>
          {rosterPlayer ? (
            <Text style={styles.footerNote}>
              {shortDate(planDate)} · Saved in PuckIQ · Apply in your fantasy host
            </Text>
          ) : (
            <Text style={styles.footerNote}>
              Adds to PuckIQ · Make the pickup in your fantasy host
            </Text>
          )}
          <PrimaryButton
            label={actionLabel}
            testID="player-lineup-action"
            onPress={() => {
              if (!rosterPlayer) {
                actions.addToMyTeam();
                return;
              }
              if (!isPremium) {
                onUpsell('tonight_lineup');
                return;
              }
              lineup.edit(playerId, isStarter ? 'sit' : 'start');
            }}
            disabled={
              !!rosterPlayer &&
              (!lineup.loaded ||
                lineup.locked ||
                !canPlay ||
                !!rosterPlayer.injuredReserve)
            }
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollBody: {
    paddingBottom: 24,
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  footerNote: {
    fontSize: 10,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 4,
  },
  note: { fontSize: 13, color: colors.sub, lineHeight: 19, marginVertical: 12 },
  body: {
    paddingHorizontal: 14,
  },
});
