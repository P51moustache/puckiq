import React, { useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useNight, useNhlToday } from '../../hooks/useCoach';
import { useLineupActions } from '../../hooks/useLineupActions';
import { daysBetween, shortDate } from '../../services/nhl/dates';
import { lineupValue } from '../../services/fantasy/lineupPlan';
import { freeLineupCall } from '../../services/fantasy/freeLineupCall';
import { startedPlayerIds } from '../../services/fantasy/loadNight';
import { FreeLineupCallCard } from '../lineup/FreeLineupCallCard';
import { nightCallReasons } from '../../hooks/lineupCallReasons';
import { hasSamplePlayers } from '../../constants/sampleTeam';
import SampleTeamNotice from '../coach/SampleTeamNotice';
import { formatValue } from '../../services/fantasy/scoring';
import { hostLinkFor } from '../../services/fantasy/hostLinks';
import { openFantasyHost } from '../../services/native/deviceLinks';
import { rosterContext } from '../../services/analytics/rosterContext';
import { useBehaviorSnapshot } from '../../hooks/useBehaviorSnapshot';
import PageHeader from '../PageHeader';
import { useTeams } from '../TeamsProvider';
import { useSubscription } from '../SubscriptionProvider';
import { usePaywall } from '../PaywallProvider';
import { usePlayerSheet } from '../sheets/PlayerSheet';
import TeamSwitcher from '../coach/TeamSwitcher';
import { SectionTabs } from '../coach/SectionTabs';
import {
  Card,
  colors,
  contentFrame,
  ErrorBanner,
  GhostButton,
  LoadingRows,
  PrimaryButton,
  ProLockCard,
} from '../coach/ui';
import { LineupList } from '../lineup/LineupList';
import { LineupActionsFooter } from '../lineup/LineupActionsFooter';
import { LineupDatePicker } from '../lineup/LineupDatePicker';
import { useBottomTabOverflow } from '../ui/TabBarBackground';
import { CoachMovesSection } from '../tonight/CoachMovesSection';

export default function LineupScreen() {
  const { team, ready } = useTeams();
  const { isPremium } = useSubscription();
  const { openPaywall } = usePaywall();
  const { openPlayer } = usePlayerSheet();
  const router = useRouter();
  const tabHeight = useBottomTabOverflow();
  const today = useNhlToday();
  const params = useLocalSearchParams<{ date?: string }>();
  const initialOffset = params.date ? daysBetween(today, params.date) : 0;
  const [offset, setOffset] = useState(
    Number.isFinite(initialOffset)
      ? Math.max(0, Math.min(13, initialOffset))
      : 0,
  );
  const [tab, setTab] = useState<'best' | 'plan'>('best');
  const view = useNight(team, offset);
  const actions = useLineupActions(view);
  const best = view.bestDay;
  const planned = view.day;
  const saved = !!team?.lineupChoices?.[view.date];
  const gain =
    best && planned
      ? Math.max(
          0,
          lineupValue(best, view.lineupValues) -
            lineupValue(planned, view.lineupValues),
        )
      : 0;
  const shown = tab === 'best' ? best : planned;
  const host = team ? hostLinkFor(team) : null;
  const freeCall = team && best ? freeLineupCall(team, best, view.lineupValues, view.night.data ? startedPlayerIds(view.night.data) : undefined) : null;
  useBehaviorSnapshot('lineup', ready ? {
    ...rosterContext(team), tab, day_offset: offset,
    state: !team?.players.length ? 'empty_roster' : view.error ? 'error' : view.loading ? 'loading' : !best ? 'unavailable' : 'ready',
    free_call_available: !!freeCall,
    saved_plan: saved, locked: actions.locked,
    available_starters: isPremium ? best?.starters.length ?? 0 : 0,
  } : null);
  const openHost = () => {
    if (!host) return;
    void openFantasyHost(host, 'lineup');
  };
  return (
    <View style={styles.container} testID="lineup-screen">
      <PageHeader
        compact
        title="Lineup Optimizer"
        accessory={<TeamSwitcher compact />}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          contentFrame,
          { paddingBottom: tabHeight + 90 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={view.refreshing}
            onRefresh={view.refresh}
            tintColor={colors.accent}
          />
        }
      >
        <SampleTeamNotice />
        <SectionTabs
          comfortable
          value={tab}
          onChange={setTab}
          options={[
            { value: 'best', label: 'Best lineup' },
            { value: 'plan', label: 'Edit my lineup' },
          ]}
          testID="lineup-tab"
        />
        {!ready ? (
          <LoadingRows count={5} />
        ) : !team?.players.length ? (
          <Card>
            <Text style={styles.copy}>
              Add your roster so the optimizer can fill your league’s positions.
            </Text>
            <PrimaryButton
              label="Build my roster"
              onPress={() => router.push('/myteam' as Href)}
            />
          </Card>
        ) : (
          <>
            {view.error ? (
              <ErrorBanner
                message="Lineup inputs didn’t fully load. Your saved choices are safe."
                onRetry={view.refresh}
              />
            ) : null}
            {view.loading && !best ? (
              <LoadingRows count={5} />
            ) : !best ? (
              <Card>
                <Text style={styles.copy}>
                  A published schedule and player stats are needed to build this
                  lineup.
                </Text>
              </Card>
            ) : !isPremium ? (
              <>
              {freeCall ? (
                <FreeLineupCallCard call={freeCall} team={team} locked={actions.locked} pending={!actions.loaded} onSave={() => actions.applyFreeCall(freeCall)} onOpenHost={openHost} reasons={nightCallReasons(view, team, freeCall)} />
              ) : (
                <Card testID="free-lineup-none">
                  <Text style={styles.copy}>
                    {actions.locked ? 'Today’s lineup is locked. Your next lineup call comes tomorrow.' : 'No lineup call for this date.'}
                  </Text>
                </Card>
              )}
              {!hasSamplePlayers(team) ? <ProLockCard
                title="Your best lineup, every night"
                detail={`Go beyond one call: optimize all ${best.starters.length + best.empty.length} active slots and compare every start/sit option.`}
                onPress={() => openPaywall('tonight_lineup', { kind: 'lineup', date: view.date, emptySlots: best.empty.length })}
              /> : null}
              </>
            ) : (
              <>
                <Card style={styles.summary} testID="lineup-summary">
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gain}>
                      {gain > 0
                        ? `+${formatValue(gain)}`
                        : formatValue(lineupValue(best, view.lineupValues))}
                    </Text>
                    <Text style={styles.copy}>
                      {gain > 0
                        ? 'Estimated value over your saved plan'
                        : 'Best lineup · estimated value'}
                    </Text>
                    <Text style={styles.note}>
                      {best.starters.length} starters
                      {saved ? ' · Plan saved' : ''}
                    </Text>
                  </View>
                  <LineupDatePicker
                    today={today}
                    offset={offset}
                    onChange={setOffset}
                  />
                </Card>
                {actions.locked ? (
                  <Text style={styles.note}>
                      Locked after the first puck drop. Pick another date to plan
                    ahead.
                  </Text>
                ) : null}
                {tab === 'plan' ? (
                  <Card style={styles.compare}>
                    <View style={styles.compareHeading}>
                      <Text style={styles.copy}>
                        My plan{' '}
                        {formatValue(lineupValue(planned!, view.lineupValues))}{' '}
                        · Best{' '}
                        {formatValue(lineupValue(best, view.lineupValues))}
                      </Text>
                      {!actions.locked ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Reset to recommendation"
                          testID="lineup-reset"
                          style={({ pressed }) => [
                            styles.reset,
                            pressed && { backgroundColor: colors.raised },
                          ]}
                          onPress={actions.reset}
                        >
                          <Text style={styles.resetLabel}>Reset ↺</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <Text style={styles.note}>
                      {actions.locked
                        ? 'Saved starters for this date.'
                        : 'Tap Start or Bench to adjust. Reset restores the recommendation.'}
                    </Text>
                  </Card>
                ) : null}
                {shown ? (
                  <LineupList
                    day={shown}
                    players={team.players}
                    values={view.lineupValues}
                    planned={tab === 'plan'}
                    editable={actions.loaded && !actions.locked}
                    onEdit={actions.edit}
                    onOpen={(id) => openPlayer(id, 'roster', 'lineup')}
                  />
                ) : null}
                <Text style={styles.note}>
                  Based on your league’s scoring and recent form. Verify goalie
                  starters before lock.
                </Text>
                {best.empty.length > 0 ? (
                  <Card style={styles.compare}>
                    <Text style={styles.copy}>
                      {best.empty.length} open slots · find someone who plays
                    </Text>
                    <GhostButton
                      label="Find pickups for this date"
                      icon="add-circle-outline"
                      onPress={() =>
                        router.push({
                          pathname: '/pickups',
                          params: { date: view.date },
                        } as Href)
                      }
                      testID="lineup-pickups"
                    />
                  </Card>
                ) : null}
                {view.moves.length ? (
                  <CoachMovesSection
                    title="Your lineup insights"
                    moves={view.moves}
                    hiddenCount={0}
                    when={
                      offset === 0
                        ? 'tonight'
                        : offset === 1
                          ? 'tomorrow'
                          : `on ${shortDate(view.date)}`
                    }
                    byId={new Map(team.players.map((p) => [p.playerId, p]))}
                    host={null}
                    onFindPickup={(move) =>
                      router.push({
                        pathname: '/pickups',
                        params: { date: view.date, slot: move.slot },
                      } as Href)
                    }
                    onUnlock={() => openPaywall('tonight_moves')}
                  />
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>
      {ready && team?.players.length && best && isPremium ? (
        <LineupActionsFooter
          bottom={tabHeight}
          locked={actions.locked}
          disabled={
            actions.locked || !actions.loaded || best.playing.length === 0
          }
          onApply={() => {
            actions.applyBest();
            setTab('plan');
          }}
          hostName={host?.name}
          onOpenHost={host ? openHost : undefined}
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 12 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 4,
    padding: 10,
  },
  gain: {
    fontSize: 25,
    fontWeight: '700',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  copy: { fontSize: 13, lineHeight: 18, color: colors.text, marginBottom: 3 },
  note: { fontSize: 12, lineHeight: 17, color: colors.sub, marginVertical: 3 },
  compare: { marginTop: 8, gap: 4 },
  compareHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  reset: {
    minHeight: 44,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderRadius: 6,
  },
  resetLabel: { fontSize: 13, fontWeight: '600', color: colors.accent },
});
